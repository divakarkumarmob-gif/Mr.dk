import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const requestNotificationPermission = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.checkPermissions().catch(() => ({ display: 'prompt' }));
      if (display !== 'granted') {
        await LocalNotifications.requestPermissions().catch(() => {});
      }
    } catch (e) {
      console.warn("LocalNotifications permission check failed:", e);
    }
  }
};

export const scheduleNotification = async (title: string, body: string, id: number, scheduleAt?: Date) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: scheduleAt ? { at: scheduleAt } : undefined,
          },
        ],
      });
    } catch (e) {
      console.error("Error scheduling notification:", e);
    }
  }
};
