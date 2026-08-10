import { ensureSodium } from './sodium';
import { getLocalPrivateKey, getLocalPublicKey, setLocalPrivateKey, setLocalPublicKey } from './storage';
import { generateKeyPair, generateIdentityKeyBundle, deriveSharedSecret, encryptTextSymmetric, decryptTextSymmetric, generateRoomSymmetricKey, wrapRoomKeyForMember, unwrapRoomKeyForMember } from './crypto';
import { restorePrivateKeyFromBlob, EncryptedPrivateKeyBackupBlob } from './backup';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { registerDeviceInFirestore } from './deviceManagement';
import { setLocalIdentitySignKeyPair, publishKeyBundle, getLocalIdentitySignPublicKey, ensureKeyBundleFresh } from './x3dh';
import {
    RatchetState,
    EncryptedRatchetMessage,
    ratchetEncrypt as ratchetEncryptRaw,
    ratchetDecrypt as ratchetDecryptRaw
} from './ratchet';

export * from './sodium';
export * from './storage';
export * from './crypto';
export * from './backup';
export * from './safetyNumber';
export * from './deviceManagement';
export * from './mediaEncryption';
export * from './ratchet';
export * from './x3dh';
export * from './senderKeys';
export * from './sessionStore';

export interface UserE2EEStatus {
    initialized: boolean;
    publicKey?: string;
    privateKey?: string;
    identityKeySign?: string;
    isNewDevice?: boolean;
    /** @deprecated identity is now generated silently at login; this is
     * never returned by initUserE2EE anymore, kept only so any code that
     * still checks it doesn't break at compile time. */
    isFirstTime?: boolean;
    /** True when this call just silently created a brand-new identity
     * (no backup existed anywhere). Useful for UI that wants to show a
     * one-time "your chats are now encrypted" toast, without blocking on
     * a PIN like the old flow did. */
    justCreated?: boolean;
    backupBlob?: EncryptedPrivateKeyBackupBlob;
}

/**
 * Silently generates a brand-new identity (X25519 + Ed25519 keypairs),
 * saves the private halves locally, and publishes the public halves +
 * X3DH key bundle to Firestore - all WITHOUT requiring a PIN. This mirrors
 * how WhatsApp/Signal generate identity keys automatically at signup/first
 * login; the PIN there (and here) is only ever used for an OPTIONAL
 * encrypted backup of those keys, never as a gate on being able to send
 * or receive messages at all.
 */
async function createSilentIdentity(uid: string): Promise<{ publicKey: string; privateKey: string; identityKeySign: string }> {
    const identity = await generateIdentityKeyBundle();

    await setLocalPrivateKey(uid, identity.privateKey);
    await setLocalPublicKey(uid, identity.publicKey);
    await setLocalIdentitySignKeyPair(uid, identity.signPublicKey, identity.signPrivateKey);

    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
        publicKey: identity.publicKey,
        identityKeySign: identity.signPublicKey,
        e2eeEnabled: true,
        e2eeBackupEnabled: false,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    await publishKeyBundle(uid, identity.signPublicKey);

    return { publicKey: identity.publicKey, privateKey: identity.privateKey, identityKeySign: identity.signPublicKey };
}

/**
 * Call this once, right after login/signup resolves (before any chat UI
 * needs E2EE) - e.g. in App.tsx's onAuthStateChanged handler. It's cheap
 * to call on every login: if an identity already exists (locally or via
 * Firestore-only, meaning a previous device already has it), it's a no-op
 * beyond a couple of reads. It NEVER prompts for a PIN and never blocks -
 * fire-and-forget is fine, but callers can also await it if they want to
 * be sure identity exists before proceeding (e.g. before opening a chat
 * immediately after signup).
 *
 * IMPORTANT: this intentionally does NOT handle the "existing backup,
 * new device" case - if the user already has a backup blob (meaning
 * they set up a Backup PIN on another device before), we deliberately
 * leave that device's E2EE uninitialized here so the normal PIN-restore
 * prompt (via initUserE2EE's isNewDevice path) still appears - silently
 * generating a FRESH identity in that situation would silently break
 * their ability to ever restore their real one.
 */
export async function ensureSilentIdentity(uid: string): Promise<void> {
    try {
        await ensureSodium();

        const localPrivKey = await getLocalPrivateKey(uid);
        const localPubKey = await getLocalPublicKey(uid);
        const localSignPub = await getLocalIdentitySignPublicKey(uid);
        if (localPrivKey && localPubKey) {
            if (localSignPub) {
                ensureKeyBundleFresh(uid, localPubKey, localSignPub).catch(() => {});
            }
            return; // already have an identity on this device
        }

        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.encryptedPrivateKeyBackup && data.publicKey) {
                // A backup exists from another device - don't silently
                // overwrite it with a new identity. Let the PIN-restore
                // flow (isNewDevice) handle this device instead.
                return;
            }
            if (data.publicKey && !data.encryptedPrivateKeyBackup) {
                // Edge case: a publicKey was published (e.g. by this same
                // flow on a device that then lost local storage) but no
                // backup exists to restore it. We can't recover the old
                // private key, so - same as WhatsApp/Signal in this
                // situation - we generate a fresh identity. Existing
                // contacts will see a "security code changed" style reset
                // on next contact, which is expected and safe.
            }
        }

        await createSilentIdentity(uid);
    } catch (e) {
        // Never let identity generation block login. Log and move on -
        // initUserE2EE will retry this same logic (via its own fallback)
        // next time it's called, e.g. when a chat is opened.
        console.error('Silent E2EE identity generation failed:', e);
    }
}

/**
 * Initializes user E2EE state: Checks local IndexedDB, Firestore profile & backup blob.
 *
 * Identity is expected to already exist by the time this runs (see
 * ensureSilentIdentity, called at login). This function's job now is
 * mainly to load the local keys, or - as a fallback safety net for
 * accounts that reach a chat screen before ensureSilentIdentity has
 * finished (e.g. a slow network) - generate the identity here instead of
 * ever showing a blocking "first time setup" PIN prompt.
 */
export async function initUserE2EE(uid: string): Promise<UserE2EEStatus> {
    await ensureSodium();

    const localPrivKey = await getLocalPrivateKey(uid);
    const localPubKey = await getLocalPublicKey(uid);

    if (localPrivKey && localPubKey) {
        // Register device activity
        try {
            await registerDeviceInFirestore(uid);
        } catch {}
        return {
            initialized: true,
            publicKey: localPubKey,
            privateKey: localPrivKey
        };
    }

    // Check Firestore profile for existing keys / backup
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.encryptedPrivateKeyBackup && data.publicKey) {
            // User has a backup blob, prompt for PIN restoration on this new device
            return {
                initialized: false,
                isNewDevice: true,
                publicKey: data.publicKey,
                identityKeySign: data.identityKeySign,
                backupBlob: data.encryptedPrivateKeyBackup
            };
        }
    }

    // No local identity, no backup to restore from - generate one silently
    // right now rather than blocking the user with a PIN prompt. This is
    // the fallback safety net mentioned above.
    const identity = await createSilentIdentity(uid);
    return {
        initialized: true,
        publicKey: identity.publicKey,
        privateKey: identity.privateKey,
        identityKeySign: identity.identityKeySign,
        justCreated: true
    };
}

/**
 * Fetch or get public key of a user from Firestore profile
 */
export async function fetchUserPublicKey(uid: string): Promise<string | null> {
    try {
        if (!uid) return null;
        // Priority 1: Published public key in Firestore (canonical across all devices)
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists() && userSnap.data().publicKey) {
            return userSnap.data().publicKey;
        }

        // Priority 2: Local storage fallback if offline or not yet in profile document
        const myUid = auth.currentUser?.uid;
        if (myUid && uid === myUid) {
            const local = await getLocalPublicKey(uid);
            if (local) return local;
        }

        return null;
    } catch {
        const local = await getLocalPublicKey(uid);
        return local || null;
    }
}

/**
 * Encrypt message payload fields for 1v1 direct chat or room using symmetric key
 */
export async function encryptPayloadWithKey<T extends Record<string, any>>(payload: T, key: Uint8Array): Promise<T> {
    const encrypted: Record<string, any> = { ...payload };

    if (encrypted.text && typeof encrypted.text === 'string' && !encrypted.text.startsWith('🔒E2EE:')) {
        encrypted.text = await encryptTextSymmetric(encrypted.text, key);
    }
    if (encrypted.audioUrl && typeof encrypted.audioUrl === 'string' && !encrypted.audioUrl.startsWith('🔒E2EE:')) {
        encrypted.audioUrl = await encryptTextSymmetric(encrypted.audioUrl, key);
    }
    if (encrypted.imageUrl && typeof encrypted.imageUrl === 'string' && !encrypted.imageUrl.startsWith('🔒E2EE:')) {
        encrypted.imageUrl = await encryptTextSymmetric(encrypted.imageUrl, key);
    }
    if (encrypted.pollData) {
        encrypted.pollData = {
            ...encrypted.pollData,
            question: encrypted.pollData.question ? await encryptTextSymmetric(encrypted.pollData.question, key) : '',
            options: await Promise.all((encrypted.pollData.options || []).map(async (opt: string) => 
                await encryptTextSymmetric(opt, key)
            ))
        };
    }

    return encrypted as T;
}

/**
 * Decrypt message payload fields
 */
export async function decryptPayloadWithKey<T extends Record<string, any>>(payload: T, key: Uint8Array, legacyDecryptFn?: (text: string) => string): Promise<T> {
    const decrypted: Record<string, any> = { ...payload };

    const decryptField = async (val: string | undefined): Promise<string> => {
        if (!val) return '';
        if (val.startsWith('🔒E2EE:v1:')) {
            try {
                return await decryptTextSymmetric(val, key);
            } catch (e) {
                return '[Encrypted message - Decryption failed]';
            }
        }
        if (val.startsWith('🔒ENC:') && legacyDecryptFn) {
            return legacyDecryptFn(val);
        }
        return val; // Unencrypted plain text
    };

    if (decrypted.text) {
        decrypted.text = await decryptField(decrypted.text);
    }
    if (decrypted.audioUrl) {
        decrypted.audioUrl = await decryptField(decrypted.audioUrl);
    }
    if (decrypted.imageUrl) {
        decrypted.imageUrl = await decryptField(decrypted.imageUrl);
    }
    if (decrypted.pollData) {
        decrypted.pollData = {
            ...decrypted.pollData,
            question: await decryptField(decrypted.pollData.question),
            options: await Promise.all((decrypted.pollData.options || []).map(async (opt: string) => await decryptField(opt)))
        };
    }

    return decrypted as T;
}

/**
 * Ratchet-aware payload encryption. Unlike encryptPayloadWithKey (static
 * key), this MUST be called sequentially per-field because every call
 * advances the ratchet state - the returned `state` must be persisted
 * (via sessionStore.saveSession) before the next message is sent.
 *
 * Fields are wrapped as `🔒E2EE:v2:<json(EncryptedRatchetMessage)>` so the
 * decrypt side can distinguish ratchet-encrypted content from legacy v1
 * static-key content and from plaintext.
 */
export async function ratchetEncryptPayload<T extends Record<string, any>>(
    payload: T,
    initialState: RatchetState
): Promise<{ payload: T; state: RatchetState }> {
    let state = initialState;
    const encrypted: Record<string, any> = { ...payload };

    const encryptField = async (val: string): Promise<string> => {
        const result = await ratchetEncryptRaw(state, val);
        state = result.state;
        return `🔒E2EE:v2:${JSON.stringify(result.message)}`;
    };

    if (encrypted.text && typeof encrypted.text === 'string' && !encrypted.text.startsWith('🔒E2EE:')) {
        encrypted.text = await encryptField(encrypted.text);
    }
    if (encrypted.audioUrl && typeof encrypted.audioUrl === 'string' && !encrypted.audioUrl.startsWith('🔒E2EE:')) {
        encrypted.audioUrl = await encryptField(encrypted.audioUrl);
    }
    if (encrypted.imageUrl && typeof encrypted.imageUrl === 'string' && !encrypted.imageUrl.startsWith('🔒E2EE:')) {
        encrypted.imageUrl = await encryptField(encrypted.imageUrl);
    }
    if (encrypted.pollData) {
        const question = encrypted.pollData.question ? await encryptField(encrypted.pollData.question) : '';
        const options: string[] = [];
        for (const opt of (encrypted.pollData.options || [])) {
            options.push(await encryptField(opt));
        }
        encrypted.pollData = { ...encrypted.pollData, question, options };
    }

    return { payload: encrypted as T, state };
}

/**
 * Ratchet-aware payload decryption. Same sequential-state-threading
 * requirement as ratchetEncryptPayload. Fields not in the v2 ratchet format
 * pass through decryptPayloadWithKey's legacy handling untouched (so old
 * messages sent before this migration remain readable, e.g. via a legacy
 * static key held separately - see DirectChat/StudyRoomChat migration notes).
 */
export async function ratchetDecryptPayload<T extends Record<string, any>>(
    payload: T,
    initialState: RatchetState
): Promise<{ payload: T; state: RatchetState }> {
    let state = initialState;
    const decrypted: Record<string, any> = { ...payload };

    const decryptField = async (val: string | undefined): Promise<string> => {
        if (!val) return '';
        if (val.startsWith('🔒E2EE:v2:')) {
            const json = val.substring('🔒E2EE:v2:'.length);
            const message: EncryptedRatchetMessage = JSON.parse(json);
            const result = await ratchetDecryptRaw(state, message);
            state = result.state;
            return result.plaintext;
        }
        return val; // Not a v2 ratchet field - leave untouched for caller to handle
    };

    if (decrypted.text) {
        decrypted.text = await decryptField(decrypted.text);
    }
    if (decrypted.audioUrl) {
        decrypted.audioUrl = await decryptField(decrypted.audioUrl);
    }
    if (decrypted.imageUrl) {
        decrypted.imageUrl = await decryptField(decrypted.imageUrl);
    }
    if (decrypted.pollData) {
        decrypted.pollData = {
            ...decrypted.pollData,
            question: await decryptField(decrypted.pollData.question),
            options: await (async () => {
                const opts: string[] = [];
                for (const opt of (decrypted.pollData.options || [])) {
                    opts.push(await decryptField(opt));
                }
                return opts;
            })()
        };
    }

    return { payload: decrypted as T, state };
}
