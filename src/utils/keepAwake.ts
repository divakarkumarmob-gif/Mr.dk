import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

export const keepAwake = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake();
    } catch (e) {
      console.error("Error keeping awake:", e);
    }
  }
};

export const allowSleep = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.allowSleep();
    } catch (e) {
      console.error("Error allowing sleep:", e);
    }
  }
};
