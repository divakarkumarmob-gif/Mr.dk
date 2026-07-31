import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Create channel for Android Native Notifications
export const initNotificationChannel = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: 'study_reminders',
        name: 'NEET Study Reminders',
        description: 'Notifications for your custom study timetable slots',
        importance: 5, // High importance (heads-up banner + sound)
        visibility: 1, // Public on lockscreen
        vibration: true,
      }).catch(() => {});
    } catch (e) {
      console.warn("Failed to create notification channel:", e);
    }
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }
      return true;
    } catch (e) {
      console.warn("LocalNotifications permission check failed:", e);
      return false;
    }
  } else if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
  }
  return false;
};

export const scheduleNotification = async (
  title: string,
  body: string,
  id: number,
  scheduleAt?: Date
): Promise<boolean> => {
  const hasPermission = await requestNotificationPermission();

  if (Capacitor.isNativePlatform()) {
    try {
      await initNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            channelId: 'study_reminders',
            schedule: scheduleAt ? { at: scheduleAt, allowWhileIdle: true } : undefined,
            sound: undefined,
          },
        ],
      });
      console.log(`[Native Notification Scheduled] ID: ${id} at ${scheduleAt?.toLocaleString() || 'NOW'}`);
      return true;
    } catch (e) {
      console.error("Error scheduling native notification:", e);
      return false;
    }
  } else if ('Notification' in window && hasPermission) {
    // Web Browser fallback
    const now = Date.now();
    const delay = scheduleAt ? scheduleAt.getTime() - now : 0;

    if (delay <= 0) {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
        });
      } catch (e) {
        console.warn("Web Notification error:", e);
      }
    } else if (delay < 2147483647) {
      setTimeout(() => {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
          });
        } catch (e) {
          console.warn("Web Notification error:", e);
        }
      }, delay);
    }
    return true;
  }
  return false;
};

export const sendTestNotification = async () => {
  const id = Math.floor(Math.random() * 100000);
  const title = "🔔 NEET Master AI Test Notification";
  const body = "Success! Your study plan notifications are working properly. 🚀";

  return await scheduleNotification(title, body, id);
};
