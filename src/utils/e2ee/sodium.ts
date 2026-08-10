// IMPORTANT: uses the "sumo" build, not the standard `libsodium-wrappers`.
// The standard build does NOT include the crypto_pwhash_* family (Argon2id
// key derivation), which this app relies on for PIN-based backup encryption
// (see backup.ts). Using the standard package here would leave
// crypto_pwhash_SALTBYTES etc. permanently undefined - not a timing issue,
// a missing-feature issue - causing E2EE init to fail every time.
// Make sure `libsodium-wrappers-sumo` (and matching @types, if used) is
// listed in package.json.
import sodium from 'libsodium-wrappers-sumo';

let sodiumInitialized = false;
let sodiumInitPromise: Promise<void> | null = null;

/**
 * Constants that MUST be present and truthy for the crypto used across this
 * app (1v1 ratchet, X3DH, group sender keys, PIN backup) to function.
 * Checking a broader set than before - `crypto_sign_*` was added for X3DH's
 * Signed PreKey signing/verification and wasn't covered by the original
 * (narrower) sanity check, which could pass this check while still failing
 * later at an actual crypto_sign_keypair() call.
 */
function getMissingConstants(): string[] {
    const required: Array<[string, any]> = [
        ['crypto_pwhash_SALTBYTES', sodium.crypto_pwhash_SALTBYTES],
        ['crypto_secretbox_NONCEBYTES', sodium.crypto_secretbox_NONCEBYTES],
        ['crypto_box_PUBLICKEYBYTES', sodium.crypto_box_PUBLICKEYBYTES],
        ['crypto_box_SECRETKEYBYTES', sodium.crypto_box_SECRETKEYBYTES],
        ['crypto_sign_PUBLICKEYBYTES', sodium.crypto_sign_PUBLICKEYBYTES],
        ['crypto_sign_SECRETKEYBYTES', sodium.crypto_sign_SECRETKEYBYTES],
        ['crypto_sign_BYTES', sodium.crypto_sign_BYTES],
    ];
    return required.filter(([, val]) => !val).map(([name]) => name);
}

async function attemptInit(): Promise<void> {
    await sodium.ready;
    const missing = getMissingConstants();
    if (missing.length > 0) {
        throw new Error(`libsodium constants missing after ready: ${missing.join(', ')}`);
    }
    // Also verify the actual functions we depend on exist (not just
    // constants) - catches partial/broken builds that a constants-only
    // check would miss.
    const requiredFns = ['crypto_box_keypair', 'crypto_sign_keypair', 'crypto_sign_detached', 'crypto_sign_verify_detached', 'crypto_scalarmult', 'crypto_secretbox_easy', 'crypto_generichash', 'randombytes_buf', 'crypto_box_seal', 'crypto_box_seal_open'];
    const missingFns = requiredFns.filter(fn => typeof (sodium as any)[fn] !== 'function');
    if (missingFns.length > 0) {
        throw new Error(`libsodium functions missing after ready: ${missingFns.join(', ')}`);
    }
}

export async function ensureSodium(): Promise<typeof sodium> {
    if (sodiumInitialized) {
        return sodium;
    }
    if (!sodiumInitPromise) {
        sodiumInitPromise = (async () => {
            try {
                await attemptInit();
            } catch (firstErr) {
                // WASM module wiring can occasionally lag behind the `ready`
                // promise resolving in production/minified bundles. Give it
                // one short retry before giving up, rather than failing the
                // whole E2EE init on what may just be a timing hiccup.
                console.warn('libsodium init check failed, retrying once:', firstErr);
                await new Promise(resolve => setTimeout(resolve, 300));
                await attemptInit();
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
