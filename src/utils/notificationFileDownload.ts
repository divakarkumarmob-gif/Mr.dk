import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { getApiUrl } from './api';
import { showToast } from './toast';

const CACHE_KEY = 'nm_downloaded_notification_files';

async function getCachedUri(fileKey: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: CACHE_KEY });
    const map = value ? JSON.parse(value) : {};
    return map[fileKey] || null;
  } catch {
    return null;
  }
}

async function setCachedUri(fileKey: string, uri: string): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: CACHE_KEY });
    const map = value ? JSON.parse(value) : {};
    map[fileKey] = uri;
    await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(map) });
  } catch {
    // non-fatal — worst case, it re-downloads next time
  }
}

/**
 * Fetches just the signed view URL for a notification attachment, without
 * downloading it to disk or handing it off to an external app. Used to
 * render the file (image/PDF) inside the app's own in-app viewer.
 */
export async function getNotificationFileViewUrl(fileKey: string): Promise<string> {
  const urlRes = await fetch(getApiUrl(`/api/notifications/file-url?key=${encodeURIComponent(fileKey)}`));
  const urlData = await urlRes.json();
  if (!urlData.success || !urlData.url) throw new Error(urlData.error || 'Could not get file link');
  return urlData.url as string;
}

/**
 * Downloads a notification attachment (photo/PDF stored on S3) into the
 * device's public Downloads folder (visible in Files/Downloads apps) and
 * opens it with the default viewer. If it was already downloaded before,
 * skips the download entirely and just re-opens the saved file.
 * On web, it just opens the file in a new tab.
 *
 * NOTE: This is now used only for the explicit "Save to device" action.
 * For normal viewing, use `getNotificationFileViewUrl` + the in-app viewer
 * (see NotificationFileViewer.tsx) so the user never has to leave the app.
 */
export async function downloadAndOpenNotificationFile(fileKey: string, fileName: string): Promise<void> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  try {
    if (!Capacitor.isNativePlatform()) {
      const urlRes = await fetch(getApiUrl(`/api/notifications/file-url?key=${encodeURIComponent(fileKey)}`));
      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.url) throw new Error(urlData.error || 'Could not get download link');
      window.open(urlData.url, '_blank');
      return;
    }

    const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');

    // Already downloaded earlier? Just reopen it — no network needed.
    const cachedUri = await getCachedUri(fileKey);
    if (cachedUri) {
      try {
        await FileOpener.openFile({ path: cachedUri });
        return;
      } catch (openErr) {
        console.warn('[downloadAndOpenNotificationFile] Cached file missing, re-downloading:', openErr);
        // Falls through to a fresh download below.
      }
    }

    await showToast('Downloading...');
    const urlRes = await fetch(getApiUrl(`/api/notifications/file-url?key=${encodeURIComponent(fileKey)}`));
    const urlData = await urlRes.json();
    if (!urlData.success || !urlData.url) throw new Error(urlData.error || 'Could not get download link');

    const fileRes = await fetch(urlData.url);
    if (!fileRes.ok) throw new Error(`Download failed (${fileRes.status})`);
    const blob = await fileRes.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const contentType = blob.type || (safeName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

    const { FileSharer } = await import('@capgo/capacitor-file-sharer');
    const saveResult = await FileSharer.save({
      filename: safeName,
      contentType,
      base64Data: base64,
      android: { saveDirectory: 'downloads', relativePath: 'Download/NeetMaster' },
    });

    await setCachedUri(fileKey, saveResult.uri);
    await FileOpener.openFile({ path: saveResult.uri });
  } catch (error) {
    console.error('[downloadAndOpenNotificationFile] Failed:', error);
    await showToast('Failed to open file. Please try again.');
  }
}

