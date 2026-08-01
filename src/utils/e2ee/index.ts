import { ensureSodium } from './sodium';
import { getLocalPrivateKey, getLocalPublicKey, setLocalPrivateKey, setLocalPublicKey } from './storage';
import { generateKeyPair, deriveSharedSecret, encryptTextSymmetric, decryptTextSymmetric, generateRoomSymmetricKey, wrapRoomKeyForMember, unwrapRoomKeyForMember } from './crypto';
import { restorePrivateKeyFromBlob, EncryptedPrivateKeyBackupBlob } from './backup';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { registerDeviceInFirestore } from './deviceManagement';

export * from './sodium';
export * from './storage';
export * from './crypto';
export * from './backup';
export * from './safetyNumber';
export * from './deviceManagement';
export * from './mediaEncryption';

export interface UserE2EEStatus {
    initialized: boolean;
    publicKey?: string;
    privateKey?: string;
    isNewDevice?: boolean;
    isFirstTime?: boolean;
    backupBlob?: EncryptedPrivateKeyBackupBlob;
}

/**
 * Initializes user E2EE state: Checks local IndexedDB, Firestore profile & backup blob
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
                backupBlob: data.encryptedPrivateKeyBackup
            };
        }
    }

    // First time setup required
    return {
        initialized: false,
        isFirstTime: true
    };
}

/**
 * Fetch or get public key of a user from Firestore profile
 */
export async function fetchUserPublicKey(uid: string): Promise<string | null> {
    try {
        const local = await getLocalPublicKey(uid);
        if (local && uid === local) return local; // if matching

        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            return userSnap.data().publicKey || null;
        }
        return null;
    } catch {
        return null;
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
