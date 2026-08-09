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
            // Sanity check: some bundler/module-load races can resolve `ready`
            // before the constant getters are wired up. Guard against that
            // instead of silently proceeding with undefined constants.
            if (!sodium.crypto_pwhash_SALTBYTES || !sodium.crypto_secretbox_NONCEBYTES || !sodium.crypto_box_PUBLICKEYBYTES) {
                throw new Error('libsodium failed to initialize constants correctly');
            }
            sodiumInitialized = true;
        })().catch((err) => {
            // Reset the promise so a future call can retry instead of being
            // stuck forever on a failed init.
            sodiumInitPromise = null;
            throw err;
        });
    }
    await sodiumInitPromise;
    return sodium;
}

export function isSodiumReady(): boolean {
    return sodiumInitialized;
}
