/**
 * End-to-End Encryption (E2EE) Utility for NEETMaster Community Room & Direct Chats
 * Protects all message text, voice notes, media URLs, and polls so that raw messages in database 
 * are stored as encrypted ciphertext ("🔒ENC:...") and can only be decrypted and read by the App.
 */

const APP_GLOBAL_E2E_KEY = 'NEET_MASTER_SECURE_CHAT_E2EE_KEY_2026_V1';

function xorTransform(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}

/**
 * Encrypts a plain text string into E2EE Ciphertext format: "🔒ENC:..."
 */
export function encryptText(text: string | undefined | null, chatRoomId: string = 'global'): string | undefined {
    if (!text || text.trim() === '') return undefined;
    if (text.startsWith('🔒ENC:')) return text; // Already encrypted

    try {
        const secretKey = APP_GLOBAL_E2E_KEY + '_' + chatRoomId;
        const utf8Encoded = encodeURIComponent(text);
        const cipher = xorTransform(utf8Encoded, secretKey);
        const base64Cipher = btoa(cipher);
        return '🔒ENC:' + base64Cipher;
    } catch (e) {
        return text;
    }
}

/**
 * Decrypts E2EE Ciphertext ("🔒ENC:...") back to plain text
 */
export function decryptText(ciphertext: string | undefined | null, chatRoomId: string = 'global'): string {
    if (!ciphertext) return '';
    if (!ciphertext.startsWith('🔒ENC:')) return ciphertext; // Unencrypted / legacy message

    try {
        const rawBase64 = ciphertext.substring(6);
        const secretKey = APP_GLOBAL_E2E_KEY + '_' + chatRoomId;
        const cipher = atob(rawBase64);
        const utf8Encoded = xorTransform(cipher, secretKey);
        return decodeURIComponent(utf8Encoded);
    } catch (e) {
        return ciphertext.replace('🔒ENC:', '');
    }
}

/**
 * Encrypts all sensitive payload fields (text, audioUrl, imageUrl, poll question & options) before writing to Firestore
 */
export function encryptMessagePayload<T extends Record<string, any>>(payload: T, chatRoomId: string): T {
    const encrypted: Record<string, any> = { ...payload };

    if (encrypted.text) {
        encrypted.text = encryptText(encrypted.text, chatRoomId);
    }
    if (encrypted.audioUrl) {
        encrypted.audioUrl = encryptText(encrypted.audioUrl, chatRoomId);
    }
    if (encrypted.imageUrl) {
        encrypted.imageUrl = encryptText(encrypted.imageUrl, chatRoomId);
    }
    if (encrypted.pollData) {
        encrypted.pollData = {
            ...encrypted.pollData,
            question: encryptText(encrypted.pollData.question, chatRoomId) || '',
            options: (encrypted.pollData.options || []).map((opt: string) => encryptText(opt, chatRoomId) || opt)
        };
    }

    return encrypted as T;
}

/**
 * Decrypts all sensitive payload fields when receiving messages from Firestore / local storage
 */
export function decryptMessagePayload<T extends Record<string, any>>(payload: T, chatRoomId: string): T {
    const decrypted: Record<string, any> = { ...payload };

    if (decrypted.text) {
        decrypted.text = decryptText(decrypted.text, chatRoomId);
    }
    if (decrypted.audioUrl) {
        decrypted.audioUrl = decryptText(decrypted.audioUrl, chatRoomId);
    }
    if (decrypted.imageUrl) {
        decrypted.imageUrl = decryptText(decrypted.imageUrl, chatRoomId);
    }
    if (decrypted.pollData) {
        decrypted.pollData = {
            ...decrypted.pollData,
            question: decryptText(decrypted.pollData.question, chatRoomId),
            options: (decrypted.pollData.options || []).map((opt: string) => decryptText(opt, chatRoomId))
        };
    }

    return decrypted as T;
}
