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
        // Filesystem.getUri() only constructs a path - it does NOT verify
        // the file exists. Without an explicit existence check here, this
        // returned a URI even for files that were never actually saved,
        // and the viewer would try to load that empty/non-existent file
        // instead of fetching from the network - showing up as
        // "Unexpected server response (0)" / "View Blocked".
        await Filesystem.stat({
            directory: Directory.Data,
            path: `pdfs/${filename}`
        });
        const result = await Filesystem.getUri({
            directory: Directory.Data,
            path: `pdfs/${filename}`
        });
        return result.uri;
    } catch {
        return null;
    }
};
