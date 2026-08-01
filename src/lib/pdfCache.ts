import { Filesystem, Directory } from '@capacitor/filesystem';

// Obfuscated XOR key — app-only decode possible
const ENC_KEY = 'MrDk$N33tM@st3r#2026!SecurePDF';

/**
 * XOR-encode/decode a Uint8Array with the secret key.
 * XOR is symmetric — same function encrypts & decrypts.
 */
function xorTransform(data: Uint8Array): Uint8Array {
    const key = new TextEncoder().encode(ENC_KEY);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result;
}

/**
 * Convert Uint8Array to base64 string (works in browser & Capacitor)
 */
function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

/**
 * Convert base64 string back to Uint8Array
 */
function base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Download, encrypt (XOR), and cache a PDF locally as .mrdkpdf
 * Returns the encoded filename on success, null on failure.
 */
export const cachePdf = async (url: string, filename: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch PDF for caching, status: ${response.status}`);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) return null;
        if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
            console.warn('PDF exceeds max 50MB cache limit:', filename);
            return null;
        }
        const pdfBytes = new Uint8Array(arrayBuffer);

        // XOR-encrypt the raw PDF bytes
        const encryptedBytes = xorTransform(pdfBytes);
        const base64Encoded = uint8ToBase64(encryptedBytes);

        // Save with .mrdkpdf extension — won't open in any external viewer
        const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';

        await Filesystem.writeFile({
            path: `pdfs/${encFilename}`,
            data: base64Encoded,
            directory: Directory.Data,
        });

        return encFilename;
    } catch (error) {
        console.error('Failed to cache PDF:', error);
        return null;
    }
};

/**
 * Retrieve a cached, encrypted PDF — decode it and return a blob:// URL
 * that can be directly loaded in the PDF viewer.
 * Returns null if the file doesn't exist.
 */
export const getCachedPdf = async (filename: string): Promise<string | null> => {
    const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';
    try {
        // Check existence first
        await Filesystem.stat({
            directory: Directory.Data,
            path: `pdfs/${encFilename}`,
        });

        // Read the encrypted base64 data
        const result = await Filesystem.readFile({
            directory: Directory.Data,
            path: `pdfs/${encFilename}`,
        });

        const base64Data = result.data as string;

        // Decode: base64 → encrypted bytes → XOR decrypt → original PDF bytes
        const encryptedBytes = base64ToUint8(base64Data);
        const pdfBytes = xorTransform(encryptedBytes);

        // Create a blob URL for instant viewing
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        return blobUrl;
    } catch {
        return null;
    }
};

/**
 * Check if a PDF is already cached locally
 */
export const isPdfCached = async (filename: string): Promise<boolean> => {
    const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';
    try {
        await Filesystem.stat({
            directory: Directory.Data,
            path: `pdfs/${encFilename}`,
        });
        return true;
    } catch {
        return false;
    }
};
