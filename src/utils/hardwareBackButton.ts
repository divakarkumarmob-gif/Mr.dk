import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

type BackButtonHandler = () => boolean | void;

interface BackHandlerItem {
    id: number;
    handler: BackButtonHandler;
}

const backHandlers: BackHandlerItem[] = [];
let nextId = 1;

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
// 1. DESKTOP KEYBOARD ESCAPE KEY LISTENER
// Pressing 'Escape' key on Desktop closes the active top modal
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
    // 2. BROWSER / GESTURE POPSTATE INTERCEPTOR
    // Intercepts browser/swipe back gesture to close active top modal cleanly
    // -------------------------------------------------------------
    window.addEventListener(
        'popstate',
        (event) => {
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
                    console.warn('[HardwareBackButton] Popstate handler error:', e);
                }
            }
        },
        true // Capture phase: run before default router popstate listeners
    );
}

/**
 * Register a hardware back button / gesture navigation handler.
 * Works in memory LIFO order (last registered handler executes first).
 * Completely safe with ZERO browser history mutations or auto-back side-effects!
 */
export function registerBackButtonHandler(handler: BackButtonHandler): () => void {
    const id = nextId++;
    backHandlers.push({ id, handler });

    let cleanedUp = false;
    return () => {
        if (cleanedUp) return;
        cleanedUp = true;

        const index = backHandlers.findIndex((item) => item.id === id);
        if (index !== -1) {
            backHandlers.splice(index, 1);
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
