import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export interface WidgetTarget {
    id: 'neural_solver' | 'liveAI';
    title: string;
    description: string;
    icon: string;
    deepLink: string;
    webUrl: string;
}

export const APP_WIDGETS: WidgetTarget[] = [
    {
        id: 'neural_solver',
        title: 'Neural 2.0 Doubt Solver',
        description: 'Instant 1-tap AI NCERT doubt resolution with photo & voice support.',
        icon: '🧠',
        deepLink: 'neetmaster://open?target=neural_solver',
        webUrl: `${window.location.origin}/?target=neural_solver`,
    },
    {
        id: 'liveAI',
        title: 'Live AI Voice Tutor',
        description: 'Real-time interactive hands-free audio voice tutor for NEET prep.',
        icon: '🎙️',
        deepLink: 'neetmaster://open?target=liveAI',
        webUrl: `${window.location.origin}/?target=liveAI`,
    },
];

export const setPendingWidgetTarget = (target: 'neural_solver' | 'liveAI') => {
    try {
        localStorage.setItem('pending_widget_target', target);
    } catch (e) {
        console.warn('[AppWidgets] Could not set pending widget target:', e);
    }
};

export const getAndClearPendingWidgetTarget = (): 'neural_solver' | 'liveAI' | null => {
    try {
        const target = localStorage.getItem('pending_widget_target') as 'neural_solver' | 'liveAI' | null;
        if (target) {
            localStorage.removeItem('pending_widget_target');
            return target;
        }
    } catch (e) {
        console.warn('[AppWidgets] Could not get pending widget target:', e);
    }
    return null;
};

export const initWidgetDeepLinkListeners = (
    onNavigateTarget: (target: 'neural_solver' | 'liveAI') => void,
    isUserLoggedIn: boolean
) => {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorApp.addListener('appUrlOpen', (data: { url: string }) => {
        try {
            const urlObj = new URL(data.url);
            const target = (urlObj.searchParams.get('target') || urlObj.searchParams.get('view') || urlObj.pathname.replace('/', '')) as any;
            
            if (target === 'neural_solver' || target === 'neural_2.0' || target === 'neural') {
                if (isUserLoggedIn) {
                    onNavigateTarget('neural_solver');
                } else {
                    setPendingWidgetTarget('neural_solver');
                }
            } else if (target === 'liveAI' || target === 'live_ai' || target === 'live') {
                if (isUserLoggedIn) {
                    onNavigateTarget('liveAI');
                } else {
                    setPendingWidgetTarget('liveAI');
                }
            }
        } catch (err) {
            console.error('[AppWidgets] Deep link parsing failed:', err);
        }
    });
};
