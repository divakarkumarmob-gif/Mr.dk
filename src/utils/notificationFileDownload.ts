import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './api';
import { showToast } from './toast';
import { saveMediaToGallery } from './saveMediaToGallery';
import { savePdfToPublicDownloads } from './publicDownload';

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
 * Saves a notification attachment (photo/PDF) to the device's public storage.
 *
 * Images go through @capacitor-community/media (Media.savePhoto) into device Gallery.
 *
 * PDFs go through savePdfToPublicDownloads into the device's public Downloads/Documents
 * folder so the user can easily open & view them from their phone's File Manager!
 */
export async function downloadAndOpenNotificationFile(
  fileKey: string,
  fileName: string,
  fileType: 'image' | 'pdf'
): Promise<void> {
  try {
    const signedUrl = await getNotificationFileViewUrl(fileKey);

    if (fileType === 'image') {
      await saveMediaToGallery(signedUrl, 'image');
      return;
    }

    // PDF: Save directly to device's public Downloads / Documents folder
    await showToast('Downloading PDF to Downloads folder...');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    
    const saved = await savePdfToPublicDownloads(signedUrl, filename);
    if (saved) {
      await showToast('✅ Saved to Downloads folder! Check your File Manager.');
    } else {
      window.open(signedUrl, '_blank');
    }
  } catch (error) {
    console.error('[downloadAndOpenNotificationFile] Failed:', error);
    await showToast('Failed to save file. Please check connection and try again.');
  }
}
