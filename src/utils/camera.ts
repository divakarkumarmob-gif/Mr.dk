import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

// Returns a File object (or null) so callers can pass it directly into
// existing upload flows (uploadMedia, sendImageToWebSocket, etc).
//
// NOTE: We use CameraResultType.Uri instead of Base64. Base64 loads the
// entire photo into a JS string in memory — on a modern phone camera
// (12MP+) that can be tens of MB, which was crashing/restarting the app
// when passed through the Capacitor bridge. Uri just gives us a file path,
// which we then fetch() into a Blob — much lighter on memory.
export const takePhoto = async (): Promise<File | null> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
      });

      if (!image.webPath) return null;

      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const fileName = `photo_${Date.now()}.jpg`;
      return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
    } catch (e) {
      // User cancelling the camera/gallery prompt also lands here — that's
      // expected and not an error worth logging loudly.
      console.log("Camera cancelled or failed:", e);
      return null;
    }
  } else {
    console.warn("Camera is not supported on this platform.");
    return null;
  }
};
