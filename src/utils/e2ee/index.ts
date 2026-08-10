import { ensureSodium } from './sodium';
import { getLocalPrivateKey, getLocalPublicKey, setLocalPrivateKey, setLocalPublicKey } from './storage';
import { generateKeyPair, deriveSharedSecret, encryptTextSymmetric, decryptTextSymmetric, generateRoomSymmetricKey, wrapRoomKeyForMember, unwrapRoomKeyForMember } from './crypto';
import { restorePrivateKeyFromBlob, EncryptedPrivateKeyBackupBlob } from './backup';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { registerDeviceInFirestore } from './deviceManagement';
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
                identityKeySign: data.identityKeySign,
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
            try {
                const json = val.substring('🔒E2EE:v2:'.length);
                const message: EncryptedRatchetMessage = JSON.parse(json);
                const result = await ratchetDecryptRaw(state, message);
                state = result.state;
                return result.plaintext;
            } catch (e) {
                console.error('Ratchet decrypt failed:', e);
                return '[Encrypted message - Decryption failed]';
            }
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
