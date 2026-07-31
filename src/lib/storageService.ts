import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Capacitor } from '@capacitor/core';
import CryptoJS from 'crypto-js';

const AES_KEY_STORAGE_KEY = 'APP_ENCRYPTION_KEY';
let cachedKey: string | null = null;

// Helper to safely get or create the encryption key without crashing Android KeyStore on first run
const getEncryptionKey = async (): Promise<string> => {
  if (cachedKey) return cachedKey;

  try {
    if (Capacitor.isNativePlatform()) {
      const res = await SecureStoragePlugin.get({ key: AES_KEY_STORAGE_KEY }).catch(() => null);
      if (res && res.value) {
        cachedKey = res.value;
        return res.value;
      }
    }
  } catch (_) {
    // Ignore native KeyStore initial error on fresh install
  }

  const localKey = localStorage.getItem(AES_KEY_STORAGE_KEY);
  if (localKey) {
    cachedKey = localKey;
    return localKey;
  }

  // Generate new key
  const newKey = CryptoJS.lib.WordArray.random(32).toString();
  cachedKey = newKey;

  try {
    localStorage.setItem(AES_KEY_STORAGE_KEY, newKey);
    if (Capacitor.isNativePlatform()) {
      await SecureStoragePlugin.set({ key: AES_KEY_STORAGE_KEY, value: newKey }).catch(() => {});
    }
  } catch (_) {
    // Safe fallback
  }

  return newKey;
};

export const storageService = {
  setItem: async (key: string, value: any) => {
    try {
      const keyStr = await getEncryptionKey();
      const encryptedValue = CryptoJS.AES.encrypt(JSON.stringify(value), keyStr).toString();

      // Write to localStorage first (instant & crash-proof)
      try {
        localStorage.setItem(key, encryptedValue);
      } catch (_) {}

      // Write to SecureStoragePlugin safely if on native
      if (Capacitor.isNativePlatform()) {
        await SecureStoragePlugin.set({ key, value: encryptedValue }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to store data', e);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
  },

  getItem: async <T>(key: string): Promise<T | null> => {
    try {
      const keyStr = await getEncryptionKey();
      let value: string | null = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const res = await SecureStoragePlugin.get({ key }).catch(() => null);
          value = res?.value || null;
        } catch (_) {}
      }

      if (!value) {
        value = localStorage.getItem(key);
      }

      if (!value) return null;

      try {
        const decryptedBytes = CryptoJS.AES.decrypt(value, keyStr);
        const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
        if (decryptedString) {
          return JSON.parse(decryptedString) as T;
        }
      } catch (_) {
        // Fallback if stored value was plain JSON
        try {
          return JSON.parse(value) as T;
        } catch (_) {}
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  removeItem: async (key: string) => {
    try {
      localStorage.removeItem(key);
      if (Capacitor.isNativePlatform()) {
        await SecureStoragePlugin.remove({ key }).catch(() => {});
      }
    } catch (_) {}
  },

  clear: async () => {
    try {
      localStorage.clear();
      if (Capacitor.isNativePlatform()) {
        await SecureStoragePlugin.clear().catch(() => {});
      }
    } catch (_) {}
  }
};
