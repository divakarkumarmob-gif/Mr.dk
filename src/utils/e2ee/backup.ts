import { ensureSodium } from './sodium';
import { generateIdentityKeyBundle } from './crypto';
import { setLocalPrivateKey, setLocalPublicKey, clearE2EEKeysForUser } from './storage';
import { setLocalIdentitySignKeyPair, publishKeyBundle } from './x3dh';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface EncryptedPrivateKeyBackupBlob {
    encryptedPrivateKey: string; // Base64
    salt: string; // Base64
    nonce: string; // Base64
    pinVersion: number;
    createdAt: string;
}

/**
 * Validates PIN strength: min 6 chars, alphanumeric (must contain both letters & digits)
 */
export function validatePinStrength(pin: any): { valid: boolean; message?: string } {
    const safePin = typeof pin === 'string' ? pin : (pin ? String(pin) : '');
    if (!safePin || safePin.length < 6) {
        return { valid: false, message: 'PIN kam se kam 6 characters ka hona chahiye!' };
    }
    const hasLetters = /[a-zA-Z]/.test(safePin);
    const hasDigits = /[0-9]/.test(safePin);
    if (!hasLetters || !hasDigits) {
        return { valid: false, message: 'PIN me kam se kam ek letter aur ek digit hona zaroori hai!' };
    }
    return { valid: true };
}

/**
 * Derives a 32-byte key from PIN and salt using Argon2id
 */
async function deriveKeyFromPin(pin: any, salt: Uint8Array): Promise<Uint8Array> {
    const sodium = await ensureSodium();
    const safePinStr = typeof pin === 'string' ? pin : (pin ? String(pin) : '');
    const pinBytes = sodium.from_string(safePinStr);

    // crypto_pwhash uses Argon2id
    const derivedKey = sodium.crypto_pwhash(
        sodium.crypto_secretbox_KEYBYTES,
        pinBytes,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    return derivedKey;
}

/**
 * Creates an encrypted private key backup blob using a PIN-derived key.
 *
 * Accepts either a raw Base64-encoded key string (legacy single-key format)
 * or an arbitrary UTF-8 string such as a JSON payload bundling multiple
 * private keys (current format: `{"dh":"...","sign":"..."}`). Content is
 * detected automatically so both formats round-trip correctly.
 */
export async function createPinBackupBlob(secretPayload: string, pin: any): Promise<EncryptedPrivateKeyBackupBlob> {
    if (!secretPayload || typeof secretPayload !== 'string') {
        throw new Error('Secret payload missing or invalid');
    }
    const safePin = typeof pin === 'string' ? pin : (pin ? String(pin) : '');
    if (!safePin || safePin.length < 6) {
        throw new Error('Valid PIN required for backup creation');
    }

    const sodium = await ensureSodium();

    if (!sodium.crypto_pwhash_SALTBYTES || !sodium.crypto_secretbox_NONCEBYTES) {
        throw new Error('Encryption library not fully initialized. Please retry in a moment.');
    }

    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    const derivedKey = await deriveKeyFromPin(safePin, salt);
    // Encode the payload as UTF-8 bytes rather than assuming it's Base64.
    // This works correctly whether secretPayload is a raw Base64 key string
    // (each char is still valid UTF-8) or a JSON object string.
    const payloadBytes = sodium.from_string(secretPayload);

    const cipherBytes = sodium.crypto_secretbox_easy(payloadBytes, nonce, derivedKey);

    return {
        encryptedPrivateKey: sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL),
        salt: sodium.to_base64(salt, sodium.base64_variants.ORIGINAL),
        nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
        pinVersion: 2,
        createdAt: new Date().toISOString()
    };
}

/**
 * Restores the secret payload (raw key string or JSON bundle) from a backup
 * blob using the user's PIN. Returns the original UTF-8 string as passed to
 * createPinBackupBlob - caller is responsible for parsing it (plain Base64
 * key vs JSON bundle) based on pinVersion / content shape.
 */
export async function restorePrivateKeyFromBlob(blob: EncryptedPrivateKeyBackupBlob, pin: any): Promise<string> {
    if (!blob || !blob.salt || !blob.nonce || !blob.encryptedPrivateKey) {
        throw new Error('Backup data is missing required encryption parameters');
    }
    const safePin = typeof pin === 'string' ? pin : (pin ? String(pin) : '');
    if (!safePin) {
        throw new Error('PIN enter karna zaroori hai');
    }

    const sodium = await ensureSodium();
    const salt = sodium.from_base64(blob.salt, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(blob.encryptedPrivateKey, sodium.base64_variants.ORIGINAL);

    const derivedKey = await deriveKeyFromPin(safePin, salt);
    const decryptedBytes = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, derivedKey);

    if (!decryptedBytes) {
        throw new Error('Incorrect PIN or corrupted backup data');
    }

    if (blob.pinVersion >= 2) {
        // v2: payload was stored as UTF-8 text (JSON bundle or raw key string)
        return sodium.to_string(decryptedBytes);
    }
    // v1 legacy: payload was the raw private key bytes, re-encode as Base64
    return sodium.to_base64(decryptedBytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Reset keys flow when user forgets PIN.
 * Generates a brand new identity (DH + signing keypair), which means all
 * existing ratchet sessions with other users become invalid - the next
 * message exchange will transparently negotiate a fresh X3DH session,
 * exactly like WhatsApp/Signal behave after a "reset security code" event.
 */
export async function resetUserKeysAndBackup(uid: string, newPin: string): Promise<{ publicKey: string; privateKey: string }> {
    const validation = validatePinStrength(newPin);
    if (!validation.valid) {
        throw new Error(validation.message || 'Invalid PIN');
    }

    // 1. Generate new identity bundle
    const identity = await generateIdentityKeyBundle();

    // 2. Save locally
    await setLocalPrivateKey(uid, identity.privateKey);
    await setLocalPublicKey(uid, identity.publicKey);
    await setLocalIdentitySignKeyPair(uid, identity.signPublicKey, identity.signPrivateKey);

    // 3. Create Backup Blob (bundles both private key halves)
    const backupBlob = await createPinBackupBlob(
        JSON.stringify({ dh: identity.privateKey, sign: identity.signPrivateKey }),
        newPin
    );

    // 4. Update Firestore Profile
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
        publicKey: identity.publicKey,
        identityKeySign: identity.signPublicKey,
        encryptedPrivateKeyBackup: backupBlob,
        keyLastResetAt: new Date().toISOString()
    }, { merge: true });

    // 5. Publish a fresh X3DH key bundle under the new identity
    await publishKeyBundle(uid, identity.signPublicKey);

    return { publicKey: identity.publicKey, privateKey: identity.privateKey };
}
