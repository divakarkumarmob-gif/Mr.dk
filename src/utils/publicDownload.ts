import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileSharer } from '@capgo/capacitor-file-sharer';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { getApiUrl, authFetch } from './api';
import { showToast } from './toast';
import { scheduleNotification } from './notifications';

/**
 * Downloads a file (PDF or Media) with live mobile system notifications
 * and presents it via modern, permission-safe native APIs compatible with Android 11+ Scoped Storage.
 *
 * @param url File URL to download (e.g. S3 pre-signed URL or backend endpoint)
 * @param filename Target filename
 * @param useAuth If true, uses authFetch with Firebase headers. Default is false (uses plain fetch)
 *                to avoid header signature mismatch on S3 pre-signed URLs.
 */
export async function savePdfToPublicDownloads(
  url: string, 
  filename: string,
  useAuth: boolean = false
): Promise<boolean> {
  const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const notificationId = Math.abs(
    safeFilename.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ) % 100000;

  // Resolve API URL (e.g. /api/proxy-pdf -> https://mrdk.onrender.com/api/proxy-pdf)
  const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : getApiUrl(url);
  const fetchFn = useAuth ? authFetch : fetch;

  try {
    // 1. Trigger Initial System Notification: Downloading Started
    await scheduleNotification(
      '📥 Downloading PDF...',
      `Downloading ${safeFilename}`,
      notificationId
    ).catch(() => {});

    await showToast(`📥 Downloading ${safeFilename}...`);

    // Web Browser environment: direct browser download
    if (!Capacitor.isNativePlatform()) {
      try {
        const response = await fetchFn(fullUrl);
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

    // Native Mobile (Android / iOS): Fetch blob & convert to Base64
    const response = await fetchFn(fullUrl);
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

    let cacheUri = '';
    let savedSuccessfully = false;

    // A. First write file to private app cache directory (Directory.Cache — permission-safe)
    try {
      const cacheResult = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });
      cacheUri = cacheResult.uri;
    } catch (cacheErr) {
      console.warn('[Filesystem] Cache write error:', cacheErr);
    }

    // B. Direct Save into device's public Downloads collection using FileSharer.save (MediaStore API)
    try {
      await FileSharer.save({
        filename: safeFilename,
        base64Data: base64Data,
        contentType: 'application/pdf',
        android: {
          saveDirectory: 'downloads'
        }
      });
      savedSuccessfully = true;
    } catch (saveErr) {
      console.warn('[FileSharer.save] Direct MediaStore save failed, trying FileSharer.share:', saveErr);

      // C. Fallback 1: Present file via FileSharer.share (opens native Save/Share chooser sheet)
      try {
        await FileSharer.share({
          filename: safeFilename,
          base64Data: base64Data,
          contentType: 'application/pdf',
          title: safeFilename,
          android: {
            chooserTitle: `Save or Share ${safeFilename}`,
          },
        });
        savedSuccessfully = true;
      } catch (shareErr) {
        console.warn('[FileSharer.share] Share sheet failed, trying FileOpener:', shareErr);

        // D. Fallback 2: Open file using FileOpener
        try {
          if (cacheUri) {
            await FileOpener.openFile({
              path: cacheUri,
              mimeType: 'application/pdf',
            });
            savedSuccessfully = true;
          } else {
            throw new Error('Cache URI unavailable');
          }
        } catch (openErr) {
          console.warn('[FileOpener] Open failed, trying Directory.Data fallback:', openErr);

          // E. Fallback 3: Save to Directory.Data (app private storage)
          try {
            await Filesystem.writeFile({
              path: safeFilename,
              data: base64Data,
              directory: Directory.Data,
              recursive: true
            });
            savedSuccessfully = true;
          } catch (dataErr) {
            console.error('[Filesystem] Directory.Data write failed:', dataErr);
          }
        }
      }
    }

    if (savedSuccessfully) {
      // Send Native Mobile System Completion Notification
      await scheduleNotification(
        '✅ Download Complete',
        `${safeFilename} saved to Downloads folder!`,
        notificationId
      ).catch(() => {});

      await showToast(`✅ Saved ${safeFilename} to Downloads folder!`);
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
