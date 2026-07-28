import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getApiUrl } from './api';
import { showToast } from './toast';

/**
 * Downloads a notification attachment (photo/PDF stored on S3) and opens it
 * with the device's default viewer (system PDF viewer / gallery app).
 * On web, it just opens the file in a new tab.
 */
export async function downloadAndOpenNotificationFile(fileKey: string, fileName: string): Promise<void> {
  try {
    const urlRes = await fetch(getApiUrl(`/api/notifications/file-url?key=${encodeURIComponent(fileKey)}`));
    const urlData = await urlRes.json();
    if (!urlData.success || !urlData.url) {
      throw new Error(urlData.error || 'Could not get download link');
    }

    if (!Capacitor.isNativePlatform()) {
      window.open(urlData.url, '_blank');
      return;
    }

    await showToast('Downloading...');
    const fileRes = await fetch(urlData.url);
    if (!fileRes.ok) throw new Error(`Download failed (${fileRes.status})`);
    const blob = await fileRes.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const writeResult = await Filesystem.writeFile({
      path: safeName,
      data: base64,
      directory: Directory.Cache,
    });

    const { FileOpener } = await import('@capawesome/capacitor-file-opener');
    await FileOpener.openFile({ path: writeResult.uri });
  } catch (error) {
    console.error('[downloadAndOpenNotificationFile] Failed:', error);
    await showToast('Failed to open file. Please try again.');
  }
}
