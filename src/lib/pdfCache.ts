import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { savePdfToPublicDownloads } from '../utils/publicDownload';

// IndexedDB Config for local storage PDF persistence
const IDB_NAME = 'MrDkPdfCacheDB';
const IDB_STORE = 'pdfs';
const IDB_VERSION = 1;

/**
 * Magic Bytes PDF Validator (%PDF- = 0x25, 0x50, 0x44, 0x46)
 * Guarantees that fetched/cached data is a real PDF and not an HTML/JSON error page.
 */
export function isValidPdfBuffer(data: ArrayBuffer | Uint8Array | null | undefined): boolean {
    if (!data || data.byteLength < 4) return false;
    const view = data instanceof Uint8Array ? data : new Uint8Array(data);
    return view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46;
}

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

async function removeFromIDB(key: string): Promise<void> {
    try {
        const db = await openPdfDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.delete(key);
    } catch {
        // Ignore deletion error
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
    return data !== null && isValidPdfBuffer(data);
}

// Native C++ FileReader Blob to Base64 conversion
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
 * Generate clean, unique cache key combining title and URL signature
 */
export function getPdfCacheKey(filename: string, url?: string): string {
    const cleanTitle = filename.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (!url) return `${cleanTitle}.pdf`;
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash) + url.charCodeAt(i);
        hash |= 0;
    }
    const hashStr = Math.abs(hash).toString(36);
    return `${cleanTitle}_${hashStr}.pdf`;
}

/**
 * Get PDF Blob URL from RAM memory if available
 */
export const getRamCachedPdf = (filename: string, url?: string): string | null => {
    const cleanKey = getPdfCacheKey(filename, url);
    return ramPdfCache.get(cleanKey) || null;
};

/**
 * Single-fetch loader: Fetches remote PDF once, verifies magic bytes (%PDF-),
 * creates an in-memory Blob URL for instant rendering, and saves to IndexedDB/disk.
 */
export const fetchAndCachePdf = async (url: string, filename: string): Promise<string> => {
    const cleanKey = getPdfCacheKey(filename, url);

    // 1. Return from RAM cache if already present
    if (ramPdfCache.has(cleanKey)) {
        return ramPdfCache.get(cleanKey)!;
    }

    // 2. Single network fetch
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Verify PDF header (%PDF-)
    if (!isValidPdfBuffer(arrayBuffer)) {
        throw new Error('Downloaded data is not a valid PDF file (possible HTML error/redirect page)');
    }

    // Create in-memory Blob URL for instant viewer rendering
    const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(pdfBlob);
    ramPdfCache.set(cleanKey, blobUrl);

    // 3. Persist to disk / IndexedDB asynchronously in background (non-blocking)
    (async () => {
        try {
            await saveToIDB(cleanKey, arrayBuffer);
            if (Capacitor.isNativePlatform()) {
                const base64Data = await blobToBase64(pdfBlob);
                await Filesystem.writeFile({
                    path: `pdfs/${cleanKey}`,
                    data: base64Data,
                    directory: Directory.Data,
                    recursive: true,
                });
            }
        } catch (err) {
            console.warn('[pdfCache] Background persist notice:', err);
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
        return getPdfCacheKey(filename, url);
    } catch (error) {
        console.error('Failed to cache PDF:', error);
        return null;
    }
};

/**
 * Retrieve a cached PDF — return a blob:// URL for instant loading if valid.
 */
export const getCachedPdf = async (filename: string, url?: string): Promise<string | null> => {
    const cleanKey = getPdfCacheKey(filename, url);

    // 0. Try RAM Cache first (0ms instant)
    if (ramPdfCache.has(cleanKey)) {
        return ramPdfCache.get(cleanKey)!;
    }

    // 1. Try IndexedDB first (fastest local storage retrieval)
    try {
        const arrayBuffer = await getFromIDB(cleanKey);
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
            if (isValidPdfBuffer(arrayBuffer)) {
                const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                ramPdfCache.set(cleanKey, blobUrl);
                return blobUrl;
            } else {
                // Purge invalid non-PDF cache entry
                console.warn('[pdfCache] Removing invalid/corrupted cached PDF entry from IndexedDB');
                await removeFromIDB(cleanKey);
            }
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
            if (isValidPdfBuffer(byteArray.buffer)) {
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                ramPdfCache.set(cleanKey, blobUrl);
                return blobUrl;
            }
        } catch {
            // Ignore filesystem errors
        }
    }

    return null;
};

/**
 * Check if a PDF is already cached locally
 */
export const isPdfCached = async (filename: string, url?: string): Promise<boolean> => {
    const cleanKey = getPdfCacheKey(filename, url);
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

export const downloadPdfToDevice = async (pdfUrl: string, title: string): Promise<boolean> => {
    const cleanFilename = getPdfCacheKey(title, pdfUrl);

    try {
        const cachedBlobUrl = await getCachedPdf(title, pdfUrl);
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
