/**
 * Legacy & Unified E2EE Encryption Adapter for NEETMaster
 * Connects real E2EE module (libsodium-wrappers) while maintaining legacy XOR read-only fallback
 */

import { decryptTextSymmetric, encryptTextSymmetric, ensureSodium } from './e2ee';

const APP_GLOBAL_E2E_KEY = 'NEET_MASTER_SECURE_CHAT_E2EE_KEY_2026_V1';

/**
 * Legacy XOR transform reserved solely for reading old messages pre-dating real E2EE
 */
function legacyXorTransform(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}

/**
 * Decrypts legacy XOR encrypted messages ("🔒ENC:...")
 */
export function decryptLegacyXOR(ciphertext: string | undefined | null, chatRoomId: string = 'global'): string {
    if (!ciphertext) return '';
    if (!ciphertext.startsWith('🔒ENC:')) return ciphertext;

    try {
        const rawBase64 = ciphertext.substring(6);
        const secretKey = APP_GLOBAL_E2E_KEY + '_' + chatRoomId;
        const cipher = atob(rawBase64);
        const utf8Encoded = legacyXorTransform(cipher, secretKey);
        return decodeURIComponent(utf8Encoded);
    } catch (e) {
        return ciphertext.replace('🔒ENC:', '');
    }
}

/**
 * Compatibility wrapper for encryptText - legacy calls fallback
 */
export function encryptText(text: string | undefined | null, _chatRoomId: string = 'global'): string | undefined {
    if (!text || text.trim() === '') return undefined;
    if (text.startsWith('🔒E2EE:') || text.startsWith('🔒ENC:')) return text;
    // Note: Components should use real E2EE functions with keys
    return text;
}

/**
 * Compatibility wrapper for decryptText
 */
export function decryptText(ciphertext: string | undefined | null, chatRoomId: string = 'global'): string {
    if (!ciphertext) return '';
    if (typeof ciphertext !== 'string') return String(ciphertext);
    if (ciphertext.startsWith('🔒ENC:')) {
        return decryptLegacyXOR(ciphertext, chatRoomId);
    }
    return ciphertext;
}

/**
 * Compatibility wrapper for message payload encryption
 */
export function encryptMessagePayload<T extends Record<string, any>>(payload: T, _chatRoomId: string): T {
    // New E2EE payload encryption is handled explicitly with derived/room keys in components
    return payload;
}

/**
 * Compatibility wrapper for message payload decryption
 */
export function decryptMessagePayload<T extends Record<string, any>>(payload: T, chatRoomId: string): T {
    if (!payload || typeof payload !== 'object') return payload;
    const decrypted: Record<string, any> = { ...payload };

    if (decrypted.text && typeof decrypted.text === 'string') {
        decrypted.text = decryptText(decrypted.text, chatRoomId);
    }
    if (decrypted.audioUrl && typeof decrypted.audioUrl === 'string') {
        decrypted.audioUrl = decryptText(decrypted.audioUrl, chatRoomId);
    }
    if (decrypted.imageUrl && typeof decrypted.imageUrl === 'string') {
        decrypted.imageUrl = decryptText(decrypted.imageUrl, chatRoomId);
    }
    if (decrypted.pollData && typeof decrypted.pollData === 'object') {
        decrypted.pollData = {
            ...decrypted.pollData,
            question: typeof decrypted.pollData.question === 'string'
                ? decryptText(decrypted.pollData.question, chatRoomId)
                : decrypted.pollData.question,
            options: (decrypted.pollData.options || []).map((opt: any) => {
                if (typeof opt === 'string') {
                    return { id: 'opt_' + Math.random().toString(36).substring(2, 6), text: decryptText(opt, chatRoomId), votes: [] };
                } else if (opt && typeof opt === 'object') {
                    return {
                        ...opt,
                        text: typeof opt.text === 'string' ? decryptText(opt.text, chatRoomId) : (opt.text || '')
                    };
                }
                return opt;
            })
        };
    }

    return decrypted as T;
}
