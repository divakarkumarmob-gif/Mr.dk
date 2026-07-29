import { registerPlugin } from '@capacitor/core';

export interface BackgroundSettingsPlugin {
    isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
    requestIgnoreBatteryOptimizations(): Promise<{ opened: boolean }>;
    openAutostartSettings(): Promise<{ opened: boolean; screen?: 'oem' | 'app_info' }>;
}

// Backed by BackgroundSettingsPlugin.java (android/app/src/main/java/com/neetmaster/app/).
// No web implementation — callers must guard with Capacitor.isNativePlatform() first.
export const BackgroundSettings = registerPlugin<BackgroundSettingsPlugin>('BackgroundSettings');
