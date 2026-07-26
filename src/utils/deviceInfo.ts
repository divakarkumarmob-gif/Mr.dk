import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export const getDeviceInfo = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getInfo();
      console.log('Device Info:', info);
      return info;
    } catch (e) {
      console.error("Error getting device info:", e);
    }
  }
  return null;
};
