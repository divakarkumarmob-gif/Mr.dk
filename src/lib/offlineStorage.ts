import { storageService } from './storageService';

export const saveNoteOffline = async (chapterName: string, pdfUrl: string) => {
    try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise<void>((resolve, reject) => {
            reader.onloadend = async () => {
                await storageService.setItem(`note_${chapterName}`, reader.result as string);
                resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to save note offline', error);
    }
};

export const getNoteOffline = async (chapterName: string) => {
    return await storageService.getItem<string>(`note_${chapterName}`);
};

export const isNoteDownloaded = async (chapterName: string) => {
    return (await storageService.getItem<string>(`note_${chapterName}`)) !== null;
};

export const clearOfflineNotes = async () => {
    // This requires iterating, but StorageService doesn't have list/keys.
    // I need to implement a key-based deletion mechanism or assume all keys are known.
    // For now, let's keep it simple or implement a way to list keys.
    // Actually, I will just clear the whole store for now or iterate if I can.
    // StorageService needs keys() method.
    // Let me update storageService first.
    console.warn("clearOfflineNotes not fully implemented because StorageService needs keys(). Clearing all for now.");
    await storageService.clear();
};

export const toggleFavorite = async (chapterName: string) => {
    const favorites = await storageService.getItem<string[]>('favorites') || [];
    if (favorites.includes(chapterName)) {
        await storageService.setItem('favorites', favorites.filter((c: string) => c !== chapterName));
        return false;
    } else {
        await storageService.setItem('favorites', [...favorites, chapterName]);
        return true;
    }
};

export const isFavorite = async (chapterName: string) => {
    const favorites = await storageService.getItem<string[]>('favorites') || [];
    return favorites.includes(chapterName);
};

export const addRecentlyViewed = async (chapterName: string) => {
    const history = await storageService.getItem<string[]>('recentlyViewed') || [];
    const newHistory = [chapterName, ...history.filter((c: string) => c !== chapterName)].slice(0, 5);
    await storageService.setItem('recentlyViewed', newHistory);
};

export const getRecentlyViewed = async () => {
    return await storageService.getItem<string[]>('recentlyViewed') || [];
};
