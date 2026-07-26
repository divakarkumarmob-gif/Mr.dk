import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const cachePdf = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        await Filesystem.writeFile({
            path: `pdfs/${filename}`,
            data: base64Data,
            directory: Directory.Data,
        });

        return `${Directory.Data}/pdfs/${filename}`;
    } catch (error) {
        console.error('Failed to cache PDF:', error);
        return null;
    }
};

export const getCachedPdf = async (filename: string) => {
    try {
        const result = await Filesystem.getUri({
            directory: Directory.Data,
            path: `pdfs/${filename}`
        });
        return result.uri;
    } catch {
        return null;
    }
};
