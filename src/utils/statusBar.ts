import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';

export const configureStatusBar = async (isLight: boolean = false) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const color = isLight ? '#f4e4bc' : '#0a0f24';
      const content = isLight ? 'dark' : 'light';

      await SafeArea.setSystemBarsStyle({
        statusBar: { color, content },
        navigationBar: { color, content },
      });
      await SafeArea.showSystemBars();
    } catch (e) {
      console.error("Status Bar error:", e);
    }
  }
};
