import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const openExternalLink = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
    } catch (e) {
      console.error("Browser open error:", e);
      window.open(url, '_blank'); // Fallback
    }
  } else {
    window.open(url, '_blank');
  }
};
