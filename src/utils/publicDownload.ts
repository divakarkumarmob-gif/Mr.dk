import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Downloads a file from remote/blob URL and saves it directly into the
 * phone's public Downloads / Documents storage (visible in File Manager).
 * On web browsers, triggers standard browser file download to Downloads folder.
 */
export async function savePdfToPublicDownloads(url: string, filename: string): Promise<boolean> {
  try {
    const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

    if (!Capacitor.isNativePlatform()) {
      // Web / Browser environment: trigger direct browser download
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        return true;
      } catch {
        // Fallback for CORS-restricted URLs on web
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      }
    }

    // Native Mobile (Android/iOS): Save to public ExternalStorage (Download) or Documents
    const response = await fetch(url);
    const blob = await response.blob();

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Try ExternalStorage Download folder first (Android public Downloads)
    try {
      await Filesystem.writeFile({
        path: `Download/${safeFilename}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true
      });
      return true;
    } catch {
      // Fallback to Documents directory
      await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });
      return true;
    }
  } catch (error) {
    console.error('[savePdfToPublicDownloads] Error:', error);
    return false;
  }
}
