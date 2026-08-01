import { Capacitor } from '@capacitor/core';
import { showToast } from './toast';

/**
 * Converts a remote/blob URL into a base64 data string with the data: prefix intact.
 * @capacitor-community/media accepts base64 strings, web URLs, or local file paths directly.
 */
async function toDataUrl(url: string): Promise<string> {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Saves a chat media file (image/video) to the device's public gallery
 * inside a "Mr.dk" album. Falls back to a browser download on web.
 */
export async function saveMediaToGallery(url: string, mediaType: 'image' | 'video' | 'audio' = 'image') {
    try {
        if (Capacitor.isNativePlatform() && mediaType !== 'audio') {
            const { Media } = await import('@capacitor-community/media');
            const dataUrl = await toDataUrl(url);

            if (mediaType === 'video') {
                await Media.saveVideo({ path: dataUrl });
            } else {
                await Media.savePhoto({ path: dataUrl });
            }
            await showToast('Saved to gallery');
        } else {
            // Web fallback (or audio files, which the media plugin doesn't support): normal browser download
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            const ext = blob.type.includes('png') ? 'png' : blob.type.includes('mp4') ? 'mp4' : 'jpg';
            a.download = `MrDk_${Date.now()}.${ext}`;
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            await showToast('Download started');
        }
    } catch (error) {
        console.error('[saveMediaToGallery] Failed to save media:', error);
        await showToast('Failed to save media');
    }
}
