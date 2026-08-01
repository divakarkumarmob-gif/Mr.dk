import { ensureSodium } from './sodium';
import { generateKeyPair } from './crypto';
import { setLocalPrivateKey, setLocalPublicKey, clearE2EEKeysForUser } from './storage';
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
export function validatePinStrength(pin: string): { valid: boolean; message?: string } {
    if (!pin || pin.length < 6) {
        return { valid: false, message: 'PIN kam se kam 6 characters ka hona chahiye!' };
    }
    const hasLetters = /[a-zA-Z]/.test(pin);
    const hasDigits = /[0-9]/.test(pin);
    if (!hasLetters || !hasDigits) {
        return { valid: false, message: 'PIN me kam se kam ek letter aur ek digit hona zaroori hai!' };
    }
    return { valid: true };
}

/**
 * Derives a 32-byte key from PIN and salt using Argon2id
 */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
    const sodium = await ensureSodium();
    const pinBytes = sodium.from_string(pin);

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
 * Creates an encrypted private key backup blob using a PIN-derived key
 */
export async function createPinBackupBlob(privateKeyBase64: string, pin: string): Promise<EncryptedPrivateKeyBackupBlob> {
    const sodium = await ensureSodium();
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    const derivedKey = await deriveKeyFromPin(pin, salt);
    const privKeyBytes = sodium.from_base64(privateKeyBase64, sodium.base64_variants.ORIGINAL);

    const cipherBytes = sodium.crypto_secretbox_easy(privKeyBytes, nonce, derivedKey);

    return {
        encryptedPrivateKey: sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL),
        salt: sodium.to_base64(salt, sodium.base64_variants.ORIGINAL),
        nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
        pinVersion: 1,
        createdAt: new Date().toISOString()
    };
}

/**
 * Restores private key from backup blob using user's PIN
 */
export async function restorePrivateKeyFromBlob(blob: EncryptedPrivateKeyBackupBlob, pin: string): Promise<string> {
    const sodium = await ensureSodium();
    const salt = sodium.from_base64(blob.salt, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(blob.encryptedPrivateKey, sodium.base64_variants.ORIGINAL);

    const derivedKey = await deriveKeyFromPin(pin, salt);
    const decryptedBytes = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, derivedKey);

    if (!decryptedBytes) {
        throw new Error('Incorrect PIN or corrupted backup data');
    }

    return sodium.to_base64(decryptedBytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Reset keys flow when user forgets PIN
 */
export async function resetUserKeysAndBackup(uid: string, newPin: string): Promise<{ publicKey: string; privateKey: string }> {
    const validation = validatePinStrength(newPin);
    if (!validation.valid) {
        throw new Error(validation.message || 'Invalid PIN');
    }

    // 1. Generate new Keypair
    const newKeyPair = await generateKeyPair();

    // 2. Save locally
    await setLocalPrivateKey(uid, newKeyPair.privateKey);
    await setLocalPublicKey(uid, newKeyPair.publicKey);

    // 3. Create Backup Blob
    const backupBlob = await createPinBackupBlob(newKeyPair.privateKey, newPin);

    // 4. Update Firestore Profile
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
        publicKey: newKeyPair.publicKey,
        encryptedPrivateKeyBackup: backupBlob,
        keyLastResetAt: new Date().toISOString()
    }, { merge: true });

    return newKeyPair;
}
