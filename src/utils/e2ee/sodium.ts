import sodium from 'libsodium-wrappers';

let sodiumInitialized = false;
let sodiumInitPromise: Promise<void> | null = null;

export async function ensureSodium(): Promise<typeof sodium> {
    if (sodiumInitialized) {
        return sodium;
    }
    if (!sodiumInitPromise) {
        sodiumInitPromise = (async () => {
            await sodium.ready;
            sodiumInitialized = true;
        })();
    }
    await sodiumInitPromise;
    return sodium;
}

export function isSodiumReady(): boolean {
    return sodiumInitialized;
}
