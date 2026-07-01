import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import CryptoJS from 'crypto-js';

const AES_KEY_STORAGE_KEY = 'APP_ENCRYPTION_KEY';

// Helper to get or create the encryption key
const getEncryptionKey = async (): Promise<string> => {
  try {
    const { value } = await SecureStoragePlugin.get({ key: AES_KEY_STORAGE_KEY });
    if (value) return value;
  } catch (e) {
    // Key not found or error, will generate new one
  }

  // Generate new key
  const newKey = CryptoJS.lib.WordArray.random(32).toString();
  await SecureStoragePlugin.set({ key: AES_KEY_STORAGE_KEY, value: newKey });
  return newKey;
};

export const storageService = {
  setItem: async (key: string, value: any) => {
    try {
      const keyStr = await getEncryptionKey();
      const encryptedValue = CryptoJS.AES.encrypt(JSON.stringify(value), keyStr).toString();
      await SecureStoragePlugin.set({ key, value: encryptedValue });
    } catch (e) {
      console.error('Failed to store data', e);
    }
  },
  getItem: async <T>(key: string): Promise<T | null> => {
    try {
      const keyStr = await getEncryptionKey();
      const { value } = await SecureStoragePlugin.get({ key });
      if (!value) return null;
      
      const decryptedBytes = CryptoJS.AES.decrypt(value, keyStr);
      const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      return JSON.parse(decryptedString) as T;
    } catch (e: any) {
      // Ignore "Item with given key does not exist" errors
      if (e?.message !== 'Item with given key does not exist') {
        console.error('Failed to retrieve data', e);
      }
      return null;
    }
  },
  removeItem: async (key: string) => {
    await SecureStoragePlugin.remove({ key });
  },
  clear: async () => {
    await SecureStoragePlugin.clear();
  }
};
