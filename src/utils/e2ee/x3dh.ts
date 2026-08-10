import { ensureSodium } from './sodium';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * X3DH (Extended Triple Diffie-Hellman) - WhatsApp/Signal style session initiation.
 *
 * Each user publishes:
 *  - Identity Key (IK)       - long-term, same as existing publicKey
 *  - Signed PreKey (SPK)     - medium-term, rotated periodically, signed by IK
 *  - One-Time PreKeys (OPK)  - single-use, consumed on first contact, replenished
 *
 * The initiator (Alice) fetches Bob's key bundle and performs up to 4 DH
 * operations to derive a shared secret that seeds the Double Ratchet.
 * Bob, upon receiving Alice's first message, performs the mirrored DH
 * operations using his private keys to derive the same secret.
 */

export interface IdentityKeyPair {
    publicKey: string;  // Base64 X25519 public key (long-term identity)
    privateKey: string; // Base64 X25519 private key
}

export interface SignedPreKeyPair {
    keyId: number;
    publicKey: string;   // Base64
    privateKey: string;  // Base64
    signature: string;   // Base64 - Ed25519 signature over publicKey, signed by identity key
    createdAt: string;
}

export interface OneTimePreKeyPair {
    keyId: string;
    publicKey: string;  // Base64
    privateKey: string; // Base64
}

export interface PublicKeyBundle {
    identityKey: string;       // Base64 X25519
    identityKeySign: string;   // Base64 Ed25519 public key (for verifying SPK signature)
    signedPreKey: {
        keyId: number;
        publicKey: string;
        signature: string;
    };
    oneTimePreKey?: {
        keyId: string;
        publicKey: string;
    } | null;
}

export interface X3DHInitiatorResult {
    sharedSecret: Uint8Array;       // 32-byte root key seed for the ratchet
    ephemeralPublicKey: string;     // Base64 - must be sent to the recipient
    usedOneTimePreKeyId: string | null;
    usedSignedPreKeyId: number;
}

export interface X3DHRecipientResult {
    sharedSecret: Uint8Array;
}

const SPK_ROTATION_DAYS = 7;
const ONE_TIME_PREKEY_BATCH = 20;
const ONE_TIME_PREKEY_LOW_WATERMARK = 5;

/**
 * Generates a fresh Ed25519 signing keypair (used only to sign the SPK,
 * mirroring Signal's identity key having both X25519 + Ed25519 forms).
 */
async function generateSigningKeyPair() {
    const sodium = await ensureSodium();
    const kp = sodium.crypto_sign_keypair();
    return {
        publicKey: sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL),
        privateKey: sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL)
    };
}

/**
 * Generates a new Signed PreKey, signed with the identity signing key.
 */
export async function generateSignedPreKey(identitySignPrivateKeyBase64: string): Promise<SignedPreKeyPair> {
    const sodium = await ensureSodium();
    const kp = sodium.crypto_box_keypair();
    const publicKeyBase64 = sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL);

    const signPrivKey = sodium.from_base64(identitySignPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
    const signatureBytes = sodium.crypto_sign_detached(kp.publicKey, signPrivKey);

    return {
        keyId: Date.now(),
        publicKey: publicKeyBase64,
        privateKey: sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL),
        signature: sodium.to_base64(signatureBytes, sodium.base64_variants.ORIGINAL),
        createdAt: new Date().toISOString()
    };
}

/**
 * Generates a batch of One-Time PreKeys.
 */
export async function generateOneTimePreKeys(count: number = ONE_TIME_PREKEY_BATCH): Promise<OneTimePreKeyPair[]> {
    const sodium = await ensureSodium();
    const keys: OneTimePreKeyPair[] = [];
    for (let i = 0; i < count; i++) {
        const kp = sodium.crypto_box_keypair();
        keys.push({
            keyId: `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`,
            publicKey: sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL),
            privateKey: sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL)
        });
    }
    return keys;
}

/**
 * Publishes a full key bundle (identity signing key, signed prekey, one-time prekeys)
 * to Firestore under the user's profile, so other users can fetch it to start a session.
 * Private key halves are stored ONLY in local IndexedDB (via keyBundleStorage), never uploaded.
 */
export async function publishKeyBundle(uid: string, identitySignPublicKey: string): Promise<{
    signedPreKey: SignedPreKeyPair;
    oneTimePreKeys: OneTimePreKeyPair[];
}> {
    const sodium = await ensureSodium();

    // Generate a fresh signing keypair reference is passed in from caller (identity managed in keyBundleStorage)
    const identitySignPrivKey = await getLocalIdentitySignPrivateKey(uid);
    if (!identitySignPrivKey) {
        throw new Error('Identity signing key missing locally; cannot publish key bundle');
    }

    const signedPreKey = await generateSignedPreKey(identitySignPrivKey);
    const oneTimePreKeys = await generateOneTimePreKeys(ONE_TIME_PREKEY_BATCH);

    // Store private halves locally
    await storeLocalSignedPreKey(uid, signedPreKey);
    await storeLocalOneTimePreKeys(uid, oneTimePreKeys);

    // Publish public halves + signature to Firestore
    const bundleRef = doc(db, 'users', uid, 'e2ee', 'keyBundle');
    await setDoc(bundleRef, {
        identityKeySign: identitySignPublicKey,
        signedPreKey: {
            keyId: signedPreKey.keyId,
            publicKey: signedPreKey.publicKey,
            signature: signedPreKey.signature,
            createdAt: signedPreKey.createdAt
        },
        updatedAt: new Date().toISOString()
    }, { merge: true });

    const otpkCollRef = collection(db, 'users', uid, 'e2ee_one_time_prekeys');
    await Promise.all(oneTimePreKeys.map(k =>
        setDoc(doc(otpkCollRef, k.keyId), { keyId: k.keyId, publicKey: k.publicKey })
    ));

    return { signedPreKey, oneTimePreKeys };
}

/**
 * Ensures the current user has a published key bundle with a fresh (non-expired)
 * signed prekey and a healthy stock of one-time prekeys. Call this at app startup
 * / E2EE init, in addition to publishing on first setup.
 */
export async function ensureKeyBundleFresh(uid: string, identityPublicKey: string, identitySignPublicKey: string): Promise<void> {
    const bundleRef = doc(db, 'users', uid, 'e2ee', 'keyBundle');
    const snap = await getDoc(bundleRef);

    let needsNewSpk = true;
    if (snap.exists()) {
        const data = snap.data();
        if (data.signedPreKey?.createdAt) {
            const ageMs = Date.now() - new Date(data.signedPreKey.createdAt).getTime();
            needsNewSpk = ageMs > SPK_ROTATION_DAYS * 24 * 60 * 60 * 1000;
        }
    }

    if (needsNewSpk) {
        await publishKeyBundle(uid, identitySignPublicKey);
        return;
    }

    // Check one-time prekey stock, replenish if low
    const otpkCollRef = collection(db, 'users', uid, 'e2ee_one_time_prekeys');
    const otpkSnap = await getDocs(query(otpkCollRef, limit(ONE_TIME_PREKEY_LOW_WATERMARK + 1)));
    if (otpkSnap.size <= ONE_TIME_PREKEY_LOW_WATERMARK) {
        const fresh = await generateOneTimePreKeys(ONE_TIME_PREKEY_BATCH);
        await storeLocalOneTimePreKeys(uid, fresh);
        await Promise.all(fresh.map(k =>
            setDoc(doc(otpkCollRef, k.keyId), { keyId: k.keyId, publicKey: k.publicKey })
        ));
    }
}

/**
 * Fetches a recipient's public key bundle (identity, signed prekey, one consumed one-time prekey).
 * Also atomically deletes the consumed one-time prekey from Firestore so it can't be reused.
 */
export async function fetchKeyBundle(uid: string, identityPublicKeyBase64: string): Promise<PublicKeyBundle | null> {
    const bundleRef = doc(db, 'users', uid, 'e2ee', 'keyBundle');
    const bundleSnap = await getDoc(bundleRef);
    if (!bundleSnap.exists()) return null;
    const data = bundleSnap.data();
    if (!data.signedPreKey || !data.identityKeySign) return null;

    // Try to claim a one-time prekey (best-effort; sessions still work without one)
    let claimedOtpk: { keyId: string; publicKey: string } | null = null;
    try {
        const otpkCollRef = collection(db, 'users', uid, 'e2ee_one_time_prekeys');
        const otpkSnap = await getDocs(query(otpkCollRef, limit(1)));
        if (!otpkSnap.empty) {
            const docSnap = otpkSnap.docs[0];
            const otpkData = docSnap.data();
            claimedOtpk = { keyId: otpkData.keyId, publicKey: otpkData.publicKey };
            await deleteDoc(docSnap.ref);
        }
    } catch (e) {
        console.warn('Could not claim one-time prekey, proceeding without it:', e);
    }

    return {
        identityKey: identityPublicKeyBase64,
        identityKeySign: data.identityKeySign,
        signedPreKey: {
            keyId: data.signedPreKey.keyId,
            publicKey: data.signedPreKey.publicKey,
            signature: data.signedPreKey.signature
        },
        oneTimePreKey: claimedOtpk
    };
}

/**
 * Verifies the Signed PreKey's signature against the sender's identity signing key.
 */
export async function verifySignedPreKey(bundle: PublicKeyBundle): Promise<boolean> {
    const sodium = await ensureSodium();
    try {
        const signPubKey = sodium.from_base64(bundle.identityKeySign, sodium.base64_variants.ORIGINAL);
        const spkPubKey = sodium.from_base64(bundle.signedPreKey.publicKey, sodium.base64_variants.ORIGINAL);
        const signature = sodium.from_base64(bundle.signedPreKey.signature, sodium.base64_variants.ORIGINAL);
        return sodium.crypto_sign_verify_detached(signature, spkPubKey, signPubKey);
    } catch {
        return false;
    }
}

/**
 * INITIATOR SIDE (Alice starting a new session with Bob):
 * Performs X3DH: DH1 = DH(IKa, SPKb), DH2 = DH(EKa, IKb), DH3 = DH(EKa, SPKb), DH4 = DH(EKa, OPKb)
 * SK = KDF(DH1 || DH2 || DH3 || DH4)
 */
export async function initiateX3DH(
    myIdentityPrivateKeyBase64: string,
    theirBundle: PublicKeyBundle
): Promise<X3DHInitiatorResult> {
    const sodium = await ensureSodium();

    const verified = await verifySignedPreKey(theirBundle);
    if (!verified) {
        throw new Error('Signed PreKey signature verification failed - possible tampering or MITM');
    }

    const myIK = sodium.from_base64(myIdentityPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
    const theirIK = sodium.from_base64(theirBundle.identityKey, sodium.base64_variants.ORIGINAL);
    const theirSPK = sodium.from_base64(theirBundle.signedPreKey.publicKey, sodium.base64_variants.ORIGINAL);

    // Generate ephemeral keypair for this handshake
    const ephemeral = sodium.crypto_box_keypair();

    const dh1 = sodium.crypto_scalarmult(myIK, theirSPK);
    const dh2 = sodium.crypto_scalarmult(ephemeral.privateKey, theirIK);
    const dh3 = sodium.crypto_scalarmult(ephemeral.privateKey, theirSPK);

    let dh4: Uint8Array | null = null;
    if (theirBundle.oneTimePreKey) {
        const theirOPK = sodium.from_base64(theirBundle.oneTimePreKey.publicKey, sodium.base64_variants.ORIGINAL);
        dh4 = sodium.crypto_scalarmult(ephemeral.privateKey, theirOPK);
    }

    const combined = dh4
        ? concatBytes(dh1, dh2, dh3, dh4)
        : concatBytes(dh1, dh2, dh3);

    const sharedSecret = sodium.crypto_generichash(32, combined, null);

    return {
        sharedSecret,
        ephemeralPublicKey: sodium.to_base64(ephemeral.publicKey, sodium.base64_variants.ORIGINAL),
        usedOneTimePreKeyId: theirBundle.oneTimePreKey?.keyId || null,
        usedSignedPreKeyId: theirBundle.signedPreKey.keyId
    };
}

/**
 * RECIPIENT SIDE (Bob receiving Alice's first message):
 * Mirrors the same 4 DH operations using his private SPK/OPK and Alice's identity + ephemeral public keys.
 */
export async function receiveX3DH(
    myIdentityPrivateKeyBase64: string,
    mySignedPreKeyPrivateKeyBase64: string,
    myOneTimePreKeyPrivateKeyBase64: string | null,
    theirIdentityPublicKeyBase64: string,
    theirEphemeralPublicKeyBase64: string
): Promise<X3DHRecipientResult> {
    const sodium = await ensureSodium();

    const myIK = sodium.from_base64(myIdentityPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
    const mySPK = sodium.from_base64(mySignedPreKeyPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
    const theirIK = sodium.from_base64(theirIdentityPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const theirEK = sodium.from_base64(theirEphemeralPublicKeyBase64, sodium.base64_variants.ORIGINAL);

    const dh1 = sodium.crypto_scalarmult(mySPK, theirIK);
    const dh2 = sodium.crypto_scalarmult(myIK, theirEK);
    const dh3 = sodium.crypto_scalarmult(mySPK, theirEK);

    let dh4: Uint8Array | null = null;
    if (myOneTimePreKeyPrivateKeyBase64) {
        const myOPK = sodium.from_base64(myOneTimePreKeyPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
        dh4 = sodium.crypto_scalarmult(myOPK, theirEK);
    }

    const combined = dh4
        ? concatBytes(dh1, dh2, dh3, dh4)
        : concatBytes(dh1, dh2, dh3);

    const sharedSecret = sodium.crypto_generichash(32, combined, null);
    return { sharedSecret };
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// ---- Local storage helpers for private key halves (identity sign key, SPK, OPKs) ----
import { getE2EEStorageItem, setE2EEStorageItem, removeE2EEStorageItem } from './storage';

export async function getLocalIdentitySignPrivateKey(uid: string): Promise<string | null> {
    return getE2EEStorageItem<string>(`identity_sign_priv_${uid}`);
}
export async function setLocalIdentitySignKeyPair(uid: string, publicKey: string, privateKey: string): Promise<void> {
    await setE2EEStorageItem(`identity_sign_pub_${uid}`, publicKey);
    await setE2EEStorageItem(`identity_sign_priv_${uid}`, privateKey);
}
export async function getLocalIdentitySignPublicKey(uid: string): Promise<string | null> {
    return getE2EEStorageItem<string>(`identity_sign_pub_${uid}`);
}

async function storeLocalSignedPreKey(uid: string, spk: SignedPreKeyPair): Promise<void> {
    await setE2EEStorageItem(`spk_${uid}_${spk.keyId}`, spk);
    await setE2EEStorageItem(`spk_current_${uid}`, spk.keyId);
}
export async function getLocalSignedPreKey(uid: string, keyId: number): Promise<SignedPreKeyPair | null> {
    return getE2EEStorageItem<SignedPreKeyPair>(`spk_${uid}_${keyId}`);
}

async function storeLocalOneTimePreKeys(uid: string, keys: OneTimePreKeyPair[]): Promise<void> {
    const existingIdsRaw = await getE2EEStorageItem<string[]>(`otpk_ids_${uid}`);
    const existingIds = existingIdsRaw || [];
    for (const k of keys) {
        await setE2EEStorageItem(`otpk_${uid}_${k.keyId}`, k);
    }
    await setE2EEStorageItem(`otpk_ids_${uid}`, [...existingIds, ...keys.map(k => k.keyId)]);
}
export async function getLocalOneTimePreKey(uid: string, keyId: string): Promise<OneTimePreKeyPair | null> {
    return getE2EEStorageItem<OneTimePreKeyPair>(`otpk_${uid}_${keyId}`);
}
export async function consumeLocalOneTimePreKey(uid: string, keyId: string): Promise<void> {
    await removeE2EEStorageItem(`otpk_${uid}_${keyId}`);
}
