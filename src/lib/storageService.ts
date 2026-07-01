import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const storageService = {
  setItem: async (key: string, value: any) => {
    try {
      await SecureStoragePlugin.set({ key, value: JSON.stringify(value) });
    } catch (e) {
      console.error('Failed to store data', e);
    }
  },
  getItem: async <T>(key: string): Promise<T | null> => {
    try {
      const { value } = await SecureStoragePlugin.get({ key });
      return JSON.parse(value) as T;
    } catch (e) {
      console.error('Failed to retrieve data', e);
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
