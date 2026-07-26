import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

export const openExternalApp = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await AppLauncher.canOpenUrl({ url });
      if (value) {
        await AppLauncher.openUrl({ url });
        return true;
      } else {
        console.warn(`Cannot open URL: ${url}`);
        return false;
      }
    } catch (e) {
      console.error("Error opening external app:", e);
      return false;
    }
  } else {
    // Web fallback: Try to open in a new tab
    window.open(url, '_blank');
    return true;
  }
};
