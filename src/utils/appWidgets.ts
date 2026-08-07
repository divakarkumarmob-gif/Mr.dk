import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export interface WidgetTarget {
    id: 'neural_solver' | 'liveAI' | 'ai_search' | 'study';
    title: string;
    description: string;
    icon: string;
    deepLink: string;
    webUrl: string;
}

const getBaseUrl = () => (typeof window !== 'undefined' ? window.location.origin : 'https://mr-dk.web.app');

export const APP_WIDGETS: WidgetTarget[] = [
    {
        id: 'neural_solver',
        title: 'Neural 2.0 Doubt Solver',
        description: 'Instant 1-tap AI NCERT doubt resolution with live photo & voice preview player.',
        icon: '🧠',
        deepLink: 'neetmaster://open?target=neural_solver',
        webUrl: `${getBaseUrl()}/?target=neural_solver`,
    },
    {
        id: 'liveAI',
        title: 'Live AI Voice Tutor',
        description: 'Real-time interactive hands-free audio voice tutor for NEET prep.',
        icon: '🎙️',
        deepLink: 'neetmaster://open?target=liveAI',
        webUrl: `${getBaseUrl()}/?target=liveAI`,
    },
    {
        id: 'ai_search',
        title: 'Google-Style AI Search Widget',
        description: 'Google Search bar style widget — Type questions & get direct Google Gemini AI answers.',
        icon: '🔍',
        deepLink: 'neetmaster://open?target=ai_search',
        webUrl: `${getBaseUrl()}/?target=ai_search`,
    },
    {
        id: 'study',
        title: 'NEET Exam Countdown & Streak',
        description: 'Live daily exam countdown timer & study streak booster widget.',
        icon: '⚡',
        deepLink: 'neetmaster://open?target=study',
        webUrl: `${getBaseUrl()}/?target=study`,
    },
];

export const setPendingWidgetTarget = (target: 'neural_solver' | 'liveAI' | 'ai_search' | 'study') => {
    try {
        localStorage.setItem('pending_widget_target', target);
    } catch (e) {
        console.warn('[AppWidgets] Could not set pending widget target:', e);
    }
};

export const getAndClearPendingWidgetTarget = (): 'neural_solver' | 'liveAI' | 'ai_search' | 'study' | null => {
    try {
        const target = localStorage.getItem('pending_widget_target') as 'neural_solver' | 'liveAI' | 'ai_search' | 'study' | null;
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
    onNavigateTarget: (target: 'neural_solver' | 'liveAI' | 'ai_search' | 'study') => void,
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
            } else if (target === 'ai_search' || target === 'search') {
                if (isUserLoggedIn) {
                    onNavigateTarget('ai_search');
                } else {
                    setPendingWidgetTarget('ai_search');
                }
            } else if (target === 'study' || target === 'streak') {
                if (isUserLoggedIn) {
                    onNavigateTarget('study');
                } else {
                    setPendingWidgetTarget('study');
                }
            }
        } catch (err) {
            console.error('[AppWidgets] Deep link parsing failed:', err);
        }
    });
};
