export const saveNoteOffline = async (chapterName: string, pdfUrl: string) => {
    try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise<void>((resolve, reject) => {
            reader.onloadend = () => {
                localStorage.setItem(`note_${chapterName}`, reader.result as string);
                resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to save note offline', error);
    }
};

export const getNoteOffline = (chapterName: string) => {
    return localStorage.getItem(`note_${chapterName}`);
};

export const isNoteDownloaded = (chapterName: string) => {
    return localStorage.getItem(`note_${chapterName}`) !== null;
};

export const clearOfflineNotes = () => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('note_')) {
            localStorage.removeItem(key);
        }
    });
};

export const toggleFavorite = (chapterName: string) => {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.includes(chapterName)) {
        localStorage.setItem('favorites', JSON.stringify(favorites.filter((c: string) => c !== chapterName)));
        return false;
    } else {
        localStorage.setItem('favorites', JSON.stringify([...favorites, chapterName]));
        return true;
    }
};

export const isFavorite = (chapterName: string) => {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    return favorites.includes(chapterName);
};

export const addRecentlyViewed = (chapterName: string) => {
    const history = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    const newHistory = [chapterName, ...history.filter((c: string) => c !== chapterName)].slice(0, 5);
    localStorage.setItem('recentlyViewed', JSON.stringify(newHistory));
};

export const getRecentlyViewed = () => {
    return JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
};
