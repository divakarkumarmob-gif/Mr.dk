import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './api';
import { showToast } from './toast';
import { saveMediaToGallery } from './saveMediaToGallery';
import { cachePdf } from '../lib/pdfCache';

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
 * Saves a notification attachment (photo/PDF) to the device.
 *
 * Images go through @capacitor-community/media (Media.savePhoto), the same
 * plugin already used elsewhere in the app (see saveMediaToGallery.ts) to
 * save chat photos to the gallery — this is a well-tested path.
 *
 * PDFs go through @capacitor/filesystem (the same `cachePdf` helper used by
 * AdvancedPDFViewer's "save for offline" button) instead of the previous
 * @capgo/capacitor-file-sharer + @capawesome-team/capacitor-file-opener
 * combo, which was unreliable and is what caused save/open to fail with a
 * generic error.
 *
 * On web, both types just open in a new tab / trigger a normal browser
 * download.
 */
export async function downloadAndOpenNotificationFile(
  fileKey: string,
  fileName: string,
  fileType: 'image' | 'pdf'
): Promise<void> {
  try {
    const signedUrl = await getNotificationFileViewUrl(fileKey);

    if (!Capacitor.isNativePlatform()) {
      window.open(signedUrl, '_blank');
      return;
    }

    if (fileType === 'image') {
      await saveMediaToGallery(signedUrl, 'image');
      return;
    }

    // PDF: cache into app storage, same as AdvancedPDFViewer's offline save.
    await showToast('Saving...');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    const saved = await cachePdf(signedUrl, filename);
    if (!saved) throw new Error('Could not save PDF');
    await showToast('Saved. You can reopen it anytime, even offline.');
  } catch (error) {
    console.error('[downloadAndOpenNotificationFile] Failed:', error);
    await showToast('Failed to save file. Please try again.');
  }
}
