import { Badge } from '@capawesome/capacitor-badge';
import { Capacitor } from '@capacitor/core';

export const setAppBadge = async (count: number) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Badge.set({ count });
    } catch (e) {
      console.error("Badge set error:", e);
    }
  }
};

export const clearAppBadge = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Badge.clear();
    } catch (e) {
      console.error("Badge clear error:", e);
    }
  }
};
