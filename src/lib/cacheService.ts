import { storageService } from './storageService';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export const cacheService = {
  set: async (key: string, data: any, ttlMs: number = 3600000) => {
    const cacheEntry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    await storageService.setItem(key, cacheEntry);
  },
  get: async <T>(key: string): Promise<T | null> => {
    const entry = await storageService.getItem<CacheEntry>(key);
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      await storageService.removeItem(key);
      return null;
    }
    return entry.data as T;
  },
  fetchWithCache: async <T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 3600000): Promise<T> => {
    const cached = await cacheService.get<T>(key);
    if (cached) return cached;
    
    const data = await fetcher();
    await cacheService.set(key, data, ttlMs);
    return data;
  },
  clear: async () => {
      await storageService.clear();
  }
};
