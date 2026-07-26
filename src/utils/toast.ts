import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

export const showToast = async (message: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Toast.show({
        text: message,
        duration: 'short',
        position: 'bottom',
      });
    } catch (e) {
      console.error("Toast error:", e);
      alert(message); // Fallback
    }
  } else {
    alert(message);
  }
};
