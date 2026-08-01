import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface LiveSessionPlugin {
    startSession(): Promise<{ started: boolean }>;
    stopSession(): Promise<{ stopped: boolean }>;
    updateMute(options: { muted: boolean }): Promise<{ updated: boolean }>;
    addListener(
        eventName: 'callEnded' | 'muteToggled',
        listenerFunc: () => void
    ): Promise<PluginListenerHandle>;
}

// Backed by LiveSessionPlugin.java (android/app/src/main/java/com/neetmaster/app/).
// No web implementation — callers must guard with Capacitor.isNativePlatform() first.
export const LiveSession = registerPlugin<LiveSessionPlugin>('LiveSession');
