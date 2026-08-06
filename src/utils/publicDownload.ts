import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getApiUrl, authFetch } from './api';
import { showToast } from './toast';
import { scheduleNotification } from './notifications';

/**
 * Downloads a file (PDF or Media) with live mobile system notifications
 * and saves it directly into the phone's public Downloads / Documents storage.
 */
export async function savePdfToPublicDownloads(url: string, filename: string): Promise<boolean> {
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const notificationId = Math.abs(
    safeFilename.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ) % 100000;

  // Resolve API URL (e.g. /api/proxy-pdf -> https://mrdk.onrender.com/api/proxy-pdf)
  const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : getApiUrl(url);

  try {
    // 1. Trigger Initial System Notification: Downloading Started
    await scheduleNotification(
      '📥 Downloading PDF...',
      `Downloading ${safeFilename} to Downloads folder`,
      notificationId
    ).catch(() => {});

    await showToast(`📥 Downloading ${safeFilename}...`);

    // Web Browser environment: direct browser download
    if (!Capacitor.isNativePlatform()) {
      try {
        const response = await authFetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        // Completion System Notification
        await scheduleNotification(
          '✅ Download Complete',
          `${safeFilename} saved to Downloads folder.`,
          notificationId
        ).catch(() => {});

        return true;
      } catch {
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = safeFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await scheduleNotification(
          '✅ Download Started',
          `${safeFilename} downloading in browser.`,
          notificationId
        ).catch(() => {});
        return true;
      }
    }

    // Native Mobile (Android / iOS): Fetch with Auth Headers & Save to Downloads
    const response = await authFetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const blob = await response.blob();

    // Convert blob to Base64
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

    // Write file to public Downloads directory
    let savedSuccessfully = false;
    try {
      await Filesystem.writeFile({
        path: `Download/${safeFilename}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true
      });
      savedSuccessfully = true;
    } catch (e1) {
      console.warn('[Filesystem] Download folder write fallback:', e1);
      try {
        await Filesystem.writeFile({
          path: safeFilename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        savedSuccessfully = true;
      } catch (e2) {
        console.error('[Filesystem] Documents folder write error:', e2);
      }
    }

    if (savedSuccessfully) {
      // Send Native Mobile System Completion Notification
      await scheduleNotification(
        '✅ Download Complete',
        `${safeFilename} saved to Downloads! Open File Manager.`,
        notificationId
      ).catch(() => {});

      await showToast(`✅ Saved ${safeFilename} to Downloads folder! Check File Manager.`);
      return true;
    } else {
      throw new Error('Could not write file to device storage');
    }
  } catch (error: any) {
    console.error('[savePdfToPublicDownloads] Error:', error);

    // Send Native Mobile System Error Notification
    await scheduleNotification(
      '❌ Download Failed',
      `Failed to download ${safeFilename}. Tap to retry.`,
      notificationId
    ).catch(() => {});

    await showToast(`❌ Download Failed: ${error.message || 'Check connection'}`);
    return false;
  }
}
