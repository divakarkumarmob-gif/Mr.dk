import { useEffect } from 'react';

type BackButtonHandler = () => boolean | void;

const backHandlers: { id: number; handler: BackButtonHandler }[] = [];
let nextId = 1;

// Global popstate event listener in capture phase for Web Browsers & Mobile Browsers
if (typeof window !== 'undefined') {
    window.addEventListener(
        'popstate',
        (event) => {
            if (backHandlers.length > 0) {
                const top = backHandlers[backHandlers.length - 1];
                try {
                    const handled = top.handler();
                    if (handled === true || handled === undefined) {
                        // Consumed the back gesture for active top modal/overlay
                        event.stopImmediatePropagation();
                        event.preventDefault();
                        return;
                    }
                } catch (e) {
                    console.warn('[HardwareBackButton] Popstate handler error:', e);
                }
            }
        },
        true // Capture phase: intercept before page router popstate listeners
    );
}

/**
 * Register a physical Android hardware back button / gesture navigation handler.
 * Handlers are stored in LIFO order (last registered runs first).
 * If a handler returns `true` or undefined, processing stops (the back button event is consumed).
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
 * Process registered hardware back button handlers (for Capacitor native backButton listener).
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
            console.warn('[HardwareBackButton] Handler execution error:', e);
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
