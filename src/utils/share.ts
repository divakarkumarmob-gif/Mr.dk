import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const shareResult = async (title: string, text: string, url?: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: 'Share your result',
      });
    } catch (e) {
      console.error("Share error:", e);
    }
  } else {
    // Web fallback (Web Share API)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (e) {
        console.error("Web Share error:", e);
      }
    } else {
      // Fallback
      alert(text);
    }
  }
};
