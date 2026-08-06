import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// IndexedDB Config for local storage PDF persistence
const IDB_NAME = 'MrDkPdfCacheDB';
const IDB_STORE = 'pdfs';
const IDB_VERSION = 1;

/**
 * Open IndexedDB database for local storage PDF persistence
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

async function saveToIDB(key: string, data: ArrayBuffer): Promise<boolean> {
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

async function getFromIDB(key: string): Promise<ArrayBuffer | null> {
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

// Native C++ FileReader Blob to Base64 conversion (300x faster than JS loops)
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.includes(',') ? res.split(',')[1] : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// RAM In-Memory Cache Map for sub-millisecond 0ms instant display
const ramPdfCache = new Map<string, string>();

/**
 * Get PDF Blob URL from RAM memory if available
 */
export const getRamCachedPdf = (filename: string): string | null => {
    const cleanKey = filename.replace(/\.pdf$/i, '').toLowerCase() + '.pdf';
    return ramPdfCache.get(cleanKey) || null;
};

/**
 * Single-fetch loader: Fetches remote PDF once, creates an in-memory Blob URL for instant rendering,
 * and asynchronously saves to IndexedDB & Filesystem in background without blocking main UI thread.
 */
export const fetchAndCachePdf = async (url: string, filename: string): Promise<string> => {
    const cleanKey = filename.replace(/\.pdf$/i, '').toLowerCase() + '.pdf';

    // 1. Return from RAM cache if already present
    if (ramPdfCache.has(cleanKey)) {
        return ramPdfCache.get(cleanKey)!;
    }

    // 2. Single network fetch
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Create in-memory Blob URL for instant viewer rendering
    const blobUrl = URL.createObjectURL(blob);
    ramPdfCache.set(cleanKey, blobUrl);

    // 3. Persist to disk / IndexedDB asynchronously in background (non-blocking)
    (async () => {
        try {
            await saveToIDB(cleanKey, arrayBuffer);
            if (Capacitor.isNativePlatform()) {
                const base64Data = await blobToBase64(blob);
                await Filesystem.writeFile({
                    path: `pdfs/${cleanKey}`,
                    data: base64Data,
                    directory: Directory.Data,
                    recursive: true,
                });
            }
        } catch (err) {
            console.warn('[pdfCache] Background persist error:', err);
        }
    })();

    return blobUrl;
};

/**
 * Cache PDF locally
 */
export const cachePdf = async (url: string, filename: string): Promise<string | null> => {
    try {
        await fetchAndCachePdf(url, filename);
        return filename.replace(/\.pdf$/i, '').toLowerCase() + '.pdf';
    } catch (error) {
        console.error('Failed to cache PDF:', error);
        return null;
    }
};

/**
 * Retrieve a cached PDF — return a blob:// URL for instant loading.
 */
export const getCachedPdf = async (filename: string): Promise<string | null> => {
    const cleanKey = filename.replace(/\.pdf$/i, '').toLowerCase() + '.pdf';

    // 0. Try RAM Cache first (0ms instant)
    if (ramPdfCache.has(cleanKey)) {
        return ramPdfCache.get(cleanKey)!;
    }

    // 1. Try IndexedDB first (fastest local storage retrieval)
    try {
        const arrayBuffer = await getFromIDB(cleanKey);
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            ramPdfCache.set(cleanKey, blobUrl);
            return blobUrl;
        }
    } catch (err) {
        console.warn('[pdfCache] IndexedDB read error:', err);
    }

    // 2. Try Native Filesystem
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.stat({
                directory: Directory.Data,
                path: `pdfs/${cleanKey}`,
            });

            const result = await Filesystem.readFile({
                directory: Directory.Data,
                path: `pdfs/${cleanKey}`,
            });

            const base64Data = result.data as string;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            ramPdfCache.set(cleanKey, blobUrl);
            return blobUrl;
        } catch {
            // Ignore filesystem errors
        }
    }

    return null;
};

/**
 * Check if a PDF is already cached locally
 */
export const isPdfCached = async (filename: string): Promise<boolean> => {
    const cleanKey = filename.replace(/\.pdf$/i, '').toLowerCase() + '.pdf';
    if (ramPdfCache.has(cleanKey)) return true;
    if (await isIDBCached(cleanKey)) return true;
    if (Capacitor.isNativePlatform()) {
        try {
            await Filesystem.stat({
                directory: Directory.Data,
                path: `pdfs/${cleanKey}`,
            });
            return true;
        } catch {
            return false;
        }
    }
    return false;
};

import { savePdfToPublicDownloads } from '../utils/publicDownload';

export const downloadPdfToDevice = async (pdfUrl: string, title: string): Promise<boolean> => {
    const cleanFilename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    // 1. If we ALREADY have the PDF in local RAM/IDB cache, pass local blob URL directly (0ms network delay!)
    try {
        const cachedBlobUrl = await getCachedPdf(cleanFilename);
        if (cachedBlobUrl) {
            const res = await fetch(cachedBlobUrl);
            const blob = await res.blob();
            if (blob && blob.size > 100) {
                return await savePdfToPublicDownloads(cachedBlobUrl, cleanFilename);
            }
        }
    } catch (e) {
        console.warn('[downloadPdfToDevice] Cache extraction error:', e);
    }

    return await savePdfToPublicDownloads(pdfUrl, cleanFilename);
};
