import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Obfuscated XOR key — app-only decode possible
const ENC_KEY = 'MrDk$N33tM@st3r#2026!SecurePDF';

// IndexedDB Fallback Config for Web & Webview
const IDB_NAME = 'MrDkPdfCacheDB';
const IDB_STORE = 'pdfs';
const IDB_VERSION = 1;

/**
 * Open IndexedDB database for local storage PDF persistence on Web/PWA
 */
function openPdfDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }
        const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToIDB(key: string, data: Uint8Array): Promise<boolean> {
    try {
        const db = await openPdfDB();
        return new Promise((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            const req = store.put(data, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

async function getFromIDB(key: string): Promise<Uint8Array | null> {
    try {
        const db = await openPdfDB();
        return new Promise((resolve) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function isIDBCached(key: string): Promise<boolean> {
    const data = await getFromIDB(key);
    return data !== null;
}

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

// RAM In-Memory Cache for sub-millisecond 0ms instant display
const ramPdfCache = new Map<string, string>();

/**
 * Get PDF Blob URL from RAM memory if available
 */
export const getRamCachedPdf = (filename: string): string | null => {
    const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';
    return ramPdfCache.get(encFilename) || null;
};

/**
 * Single-fetch loader: Fetches remote PDF once, returns an in-memory Blob URL for instant rendering,
 * and asynchronously saves the encrypted PDF to disk/IndexedDB without blocking the UI.
 */
export const fetchAndCachePdf = async (url: string, filename: string): Promise<string> => {
    const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';

    // 1. Return from RAM cache if already present
    if (ramPdfCache.has(encFilename)) {
        return ramPdfCache.get(encFilename)!;
    }

    // 2. Single network fetch
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // Create in-memory Blob URL for instant viewer rendering
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    ramPdfCache.set(encFilename, blobUrl);

    // 3. Persist to disk / IndexedDB asynchronously in background
    (async () => {
        try {
            const encryptedBytes = xorTransform(pdfBytes);
            if (Capacitor.isNativePlatform()) {
                const base64Encoded = uint8ToBase64(encryptedBytes);
                await Filesystem.writeFile({
                    path: `pdfs/${encFilename}`,
                    data: base64Encoded,
                    directory: Directory.Data,
                    recursive: true,
                });
            }
            await saveToIDB(encFilename, encryptedBytes);
        } catch (err) {
            console.warn('[pdfCache] Background persist error:', err);
        }
    })();

    return blobUrl;
};

/**
 * Download, encrypt (XOR), and cache a PDF locally as .mrdkpdf
 * Returns the encoded filename on success, null on failure.
 */
export const cachePdf = async (url: string, filename: string): Promise<string | null> => {
    try {
        await fetchAndCachePdf(url, filename);
        return filename.replace(/\.pdf$/i, '') + '.mrdkpdf';
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

    // 0. Try RAM Cache first (0ms instant)
    if (ramPdfCache.has(encFilename)) {
        return ramPdfCache.get(encFilename)!;
    }

    // 1. Try Native Filesystem first
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.stat({
                directory: Directory.Data,
                path: `pdfs/${encFilename}`,
            });

            const result = await Filesystem.readFile({
                directory: Directory.Data,
                path: `pdfs/${encFilename}`,
            });

            const base64Data = result.data as string;
            const encryptedBytes = base64ToUint8(base64Data);
            const pdfBytes = xorTransform(encryptedBytes);

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            ramPdfCache.set(encFilename, blobUrl);
            return blobUrl;
        } catch {
            // Fallthrough to IndexedDB check
        }
    }

    // 2. Try IndexedDB
    try {
        const encryptedBytes = await getFromIDB(encFilename);
        if (encryptedBytes) {
            const pdfBytes = xorTransform(encryptedBytes);
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            ramPdfCache.set(encFilename, blobUrl);
            return blobUrl;
        }
    } catch (err) {
        console.error('Error reading from IDB cache:', err);
    }

    return null;
};

/**
 * Check if a PDF is already cached locally
 */
export const isPdfCached = async (filename: string): Promise<boolean> => {
    const encFilename = filename.replace(/\.pdf$/i, '') + '.mrdkpdf';
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.stat({
                directory: Directory.Data,
                path: `pdfs/${encFilename}`,
            });
            return true;
        } catch {
            // Check IDB
        }
    }
    return await isIDBCached(encFilename);
};

import { savePdfToPublicDownloads } from '../utils/publicDownload';

/**
 * Save raw PDF file directly into user's device storage (Documents / Downloads)
 * or trigger browser file download with live mobile system notifications.
 */
export const downloadPdfToDevice = async (pdfUrl: string, title: string): Promise<boolean> => {
    const cleanFilename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    return await savePdfToPublicDownloads(pdfUrl, cleanFilename);
};
