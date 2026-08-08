import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

type BackButtonHandler = () => boolean | void;

interface BackHandlerItem {
    id: number;
    handler: BackButtonHandler;
    isMobileOverlay?: boolean;
}

const backHandlers: BackHandlerItem[] = [];
let nextId = 1;
let isInternalPopOperation = false;

// Helper to check if current device is Mobile / Mobile Web
export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        Capacitor.isNativePlatform() ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768
    );
}

// -------------------------------------------------------------
// 1. DESKTOP NATIVE NAVIGATION SYSTEM
// Handles Desktop Keyboard 'Escape' key to close active top modal/overlay
// -------------------------------------------------------------
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' && backHandlers.length > 0) {
            const top = backHandlers[backHandlers.length - 1];
            try {
                const handled = top.handler();
                if (handled === true || handled === undefined) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } catch (e) {
                console.warn('[HardwareBackButton] Desktop Escape key error:', e);
            }
        }
    });

    // -------------------------------------------------------------
    // 2. MOBILE BROWSER POPSTATE INTERCEPTOR
    // Intercepts Mobile gesture swipe back to pop active modal cleanly
    // -------------------------------------------------------------
    window.addEventListener(
        'popstate',
        (event) => {
            if (isInternalPopOperation) {
                isInternalPopOperation = false;
                return;
            }

            if (backHandlers.length > 0) {
                const top = backHandlers[backHandlers.length - 1];
                try {
                    const handled = top.handler();
                    if (handled === true || handled === undefined) {
                        event.stopImmediatePropagation();
                        event.preventDefault();
                        return;
                    }
                } catch (e) {
                    console.warn('[HardwareBackButton] Mobile popstate handler error:', e);
                }
            }
        },
        true // Capture phase execution
    );
}

/**
 * Register a hardware back button / gesture navigation handler.
 * Works seamlessly across both Mobile (Capacitor & Touch Swipes) and Desktop (Escape Key & UI Buttons).
 */
export function registerBackButtonHandler(handler: BackButtonHandler): () => void {
    const id = nextId++;
    const isMobile = isMobileDevice();
    
    backHandlers.push({ id, handler, isMobileOverlay: isMobile });

    // On Mobile browsers, push a lightweight history state so swipe-back gesture pops modal first
    let pushedMobileState = false;
    if (isMobile && typeof window !== 'undefined' && window.history) {
        try {
            window.history.pushState({ isMobileModalOverlay: true, id }, '');
            pushedMobileState = true;
        } catch (e) {
            console.warn('[HardwareBackButton] Mobile state push skipped:', e);
        }
    }

    let cleanedUp = false;
    return () => {
        if (cleanedUp) return;
        cleanedUp = true;

        const index = backHandlers.findIndex((item) => item.id === id);
        if (index !== -1) {
            backHandlers.splice(index, 1);
        }

        // Cleanup mobile pushed state safely without triggering popstate side-effects
        if (pushedMobileState && isMobile && typeof window !== 'undefined' && window.history) {
            if (window.history.state && window.history.state.isMobileModalOverlay && window.history.state.id === id) {
                isInternalPopOperation = true;
                window.history.back();
            }
        }
    };
}

/**
 * Process registered hardware back button handlers (for Capacitor Native Android backButton listener).
 * Returns true if any component handled the hardware back action.
 */
export function processHardwareBackButton(): boolean {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
        try {
            const handled = backHandlers[i].handler();
            if (handled === true || handled === undefined) {
                return true;
            }
        } catch (e) {
            console.warn('[HardwareBackButton] Native hardware back execution error:', e);
        }
    }
    return false;
}

/**
 * Custom React Hook to automatically connect any modal/overlay state `isOpen` to physical/gesture back button.
 */
export function useModalBackButton(isOpen: boolean, onClose: () => void) {
    useEffect(() => {
        if (!isOpen) return;

        const unregister = registerBackButtonHandler(() => {
            onClose();
            return true;
        });

        return () => {
            unregister();
        };
    }, [isOpen, onClose]);
}
