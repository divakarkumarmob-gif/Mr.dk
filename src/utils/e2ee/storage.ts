/**
 * IndexedDB Local Storage Helper for E2EE Private Keys and Cached Room Keys
 */

const DB_NAME = 'neetmaster_e2ee_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not supported on this browser/environment'));
            return;
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function setE2EEStorageItem<T>(key: string, value: T): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        // Fallback to localStorage if IndexedDB fails
        try {
            localStorage.setItem('e2ee_idb_fb_' + key, JSON.stringify(value));
        } catch {}
    }
}

export async function getE2EEStorageItem<T>(key: string): Promise<T | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve((req.result as T) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        try {
            const raw = localStorage.getItem('e2ee_idb_fb_' + key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }
}

export async function removeE2EEStorageItem(key: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        try {
            localStorage.removeItem('e2ee_idb_fb_' + key);
        } catch {}
    }
}

// Helper methods for Keys
export async function getLocalPrivateKey(uid: string): Promise<string | null> {
    return getE2EEStorageItem<string>(`priv_key_${uid}`);
}

export async function setLocalPrivateKey(uid: string, privKey: string): Promise<void> {
    return setE2EEStorageItem(`priv_key_${uid}`, privKey);
}

export async function getLocalPublicKey(uid: string): Promise<string | null> {
    return getE2EEStorageItem<string>(`pub_key_${uid}`);
}

export async function setLocalPublicKey(uid: string, pubKey: string): Promise<void> {
    return setE2EEStorageItem(`pub_key_${uid}`, pubKey);
}

export async function getRoomSymmetricKey(roomId: string): Promise<string | null> {
    return getE2EEStorageItem<string>(`room_key_${roomId}`);
}

export async function setRoomSymmetricKey(roomId: string, roomKey: string): Promise<void> {
    return setE2EEStorageItem(`room_key_${roomId}`, roomKey);
}

export async function clearE2EEKeysForUser(uid: string): Promise<void> {
    await removeE2EEStorageItem(`priv_key_${uid}`);
    await removeE2EEStorageItem(`pub_key_${uid}`);
}
