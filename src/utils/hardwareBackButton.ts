import { useEffect } from 'react';

type BackButtonHandler = () => boolean | void;

interface ModalHistoryState {
    isModalOverlay: boolean;
    id: number;
}

const backHandlers: { id: number; handler: BackButtonHandler }[] = [];
let isInternalHistoryOperation = false;
let nextId = 1;

// Global popstate event listener in capture phase for Web Browsers & Mobile Browsers
if (typeof window !== 'undefined') {
    window.addEventListener(
        'popstate',
        (event) => {
            if (isInternalHistoryOperation) {
                isInternalHistoryOperation = false;
                return;
            }

            if (backHandlers.length > 0) {
                const top = backHandlers[backHandlers.length - 1];
                try {
                    const handled = top.handler();
                    if (handled === true || handled === undefined) {
                        // Consumed the back gesture for modal
                        event.stopImmediatePropagation();
                        return;
                    }
                } catch (e) {
                    console.warn('[HardwareBackButton] Popstate handler error:', e);
                }
            }
        },
        true // Capture phase: run before other popstate listeners
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

    let pushedState = false;
    if (typeof window !== 'undefined' && window.history) {
        try {
            const currentModalState: ModalHistoryState = { isModalOverlay: true, id };
            window.history.pushState(currentModalState, '');
            pushedState = true;
        } catch (e) {
            console.warn('[HardwareBackButton] History pushState failed:', e);
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

        if (pushedState && typeof window !== 'undefined' && window.history) {
            // If the top state in history is still our modal state (closed via UI X button), revert it cleanly
            if (window.history.state && window.history.state.isModalOverlay && window.history.state.id === id) {
                isInternalHistoryOperation = true;
                window.history.back();
            }
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

