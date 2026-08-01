import { Capacitor } from '@capacitor/core';
import { SafeArea, SystemBarsStyle } from '@capacitor-community/safe-area';

export const configureStatusBar = async (isLight: boolean = false) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await SafeArea.setSystemBarsStyle({
        style: isLight ? SystemBarsStyle.Light : SystemBarsStyle.Dark,
      });
      await SafeArea.showSystemBars({});
    } catch (e) {
      console.error("Status Bar error:", e);
    }
  }
};
