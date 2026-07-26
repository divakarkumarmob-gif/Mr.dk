import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';

export const showNativeAlert = async (title: string, message: string) => {
  if (Capacitor.isNativePlatform()) {
    await Dialog.alert({
      title,
      message,
    });
  } else {
    alert(`${title}\n${message}`);
  }
};

export const showNativeConfirm = async (title: string, message: string) => {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Dialog.confirm({
      title,
      message,
    });
    return value;
  } else {
    return confirm(`${title}\n${message}`);
  }
};

export const showNativePrompt = async (title: string, message: string) => {
  if (Capacitor.isNativePlatform()) {
    const { value, cancelled } = await Dialog.prompt({
      title,
      message,
    });
    return cancelled ? null : value;
  } else {
    return prompt(`${title}\n${message}`);
  }
};
