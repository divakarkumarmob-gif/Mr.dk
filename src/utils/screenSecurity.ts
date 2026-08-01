import { Capacitor, registerPlugin } from '@capacitor/core';

interface ScreenSecurityPlugin {
    enableScreenshot(): Promise<{ allowed: boolean }>;
    disableScreenshot(): Promise<{ allowed: boolean }>;
}

const ScreenSecurity = registerPlugin<ScreenSecurityPlugin>('ScreenSecurity');

/**
 * Enable Screenshots (ON for AI Study Plan, Floating AI, Neural Solver, Test Analysis, NEET Community)
 */
export async function enableScreenshot() {
    if (Capacitor.isNativePlatform()) {
        try {
            await ScreenSecurity.enableScreenshot();
            console.log('[ScreenSecurity] Screenshots ENABLED for AI / Analysis Screen');
        } catch (e) {
            console.warn('[ScreenSecurity] enableScreenshot error:', e);
        }
    }
}

/**
 * Disable Screenshots (OFF / Restricted for other non-AI screens)
 */
export async function disableScreenshot() {
    if (Capacitor.isNativePlatform()) {
        try {
            await ScreenSecurity.disableScreenshot();
            console.log('[ScreenSecurity] Screenshots RESTRICTED for protected content');
        } catch (e) {
            console.warn('[ScreenSecurity] disableScreenshot error:', e);
        }
    }
}
