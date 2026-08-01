import { ensureSodium } from './sodium';

/**
 * Encrypts a media Blob (image / voice note) client-side using a symmetric key (or shared secret)
 * Returns encrypted string payload: "🔒E2EE_MEDIA:v1:<base64Nonce>:<base64Ciphertext>"
 */
export async function encryptMediaBlob(blob: Blob, symmetricKey: Uint8Array): Promise<string> {
    const sodium = await ensureSodium();
    const arrayBuffer = await blob.arrayBuffer();
    const mediaBytes = new Uint8Array(arrayBuffer);

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipherBytes = sodium.crypto_secretbox_easy(mediaBytes, nonce, symmetricKey);

    const nonceBase64 = sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL);
    const cipherBase64 = sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL);

    return `🔒E2EE_MEDIA:v1:${nonceBase64}:${cipherBase64}`;
}

/**
 * Decrypts encrypted media string back into a Blob Object URL
 */
export async function decryptMediaBlobToUrl(encryptedString: string, symmetricKey: Uint8Array, mimeType: string = 'image/jpeg'): Promise<string> {
    if (!encryptedString || !encryptedString.startsWith('🔒E2EE_MEDIA:v1:')) {
        // Return original if unencrypted or legacy
        return encryptedString;
    }

    const parts = encryptedString.split(':');
    if (parts.length < 4) {
        throw new Error('Malformed encrypted media string');
    }

    const nonceBase64 = parts[2];
    const cipherBase64 = parts[3];

    const sodium = await ensureSodium();
    const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(cipherBase64, sodium.base64_variants.ORIGINAL);

    const decryptedBytes = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, symmetricKey);
    if (!decryptedBytes) {
        throw new Error('Media decryption failed');
    }

    const blob = new Blob([decryptedBytes], { type: mimeType });
    return URL.createObjectURL(blob);
}
