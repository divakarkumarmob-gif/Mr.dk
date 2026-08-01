type BackButtonHandler = () => boolean | void;

const backHandlers: BackButtonHandler[] = [];

/**
 * Register a physical Android hardware back button / gesture navigation handler.
 * Handlers are stored in LIFO order (last registered runs first).
 * If a handler returns `true`, processing stops (the back button event is consumed).
 */
export function registerBackButtonHandler(handler: BackButtonHandler): () => void {
    backHandlers.push(handler);
    return () => {
        const index = backHandlers.indexOf(handler);
        if (index !== -1) {
            backHandlers.splice(index, 1);
        }
    };
}

/**
 * Process registered hardware back button handlers.
 * Returns true if any component handled the hardware back action.
 */
export function processHardwareBackButton(): boolean {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
        try {
            const handled = backHandlers[i]();
            if (handled === true) {
                return true;
            }
        } catch (e) {
            console.warn('[HardwareBackButton] Handler execution error:', e);
        }
    }
    return false;
}
