import { ensureSodium } from './sodium';
import { getE2EEStorageItem, setE2EEStorageItem } from './storage';

/**
 * Computes a Signal/WhatsApp style human readable Safety Number (Fingerprint)
 * from two public keys (or room member public keys)
 */
export async function computeSafetyNumber(publicKeyA: string, publicKeyB: string): Promise<string> {
    if (!publicKeyA || !publicKeyB || !publicKeyA.trim() || !publicKeyB.trim()) {
        return 'Verification pending...';
    }
    const sodium = await ensureSodium();
    const sortedKeys = [publicKeyA.trim(), publicKeyB.trim()].sort().join('::');

    const hashBytes = sodium.crypto_generichash(32, sodium.from_string(sortedKeys), null);

    // Convert hash bytes into numeric chunks
    let formatted = '';
    for (let i = 0; i < 30; i += 5) {
        const val = ((hashBytes[i] << 24) | (hashBytes[i + 1] << 16) | (hashBytes[i + 2] << 8) | hashBytes[i + 3]) >>> 0;
        const numStr = (val % 100000).toString().padStart(5, '0');
        formatted += numStr + (i < 25 ? ' ' : '');
    }

    return formatted;
}

/**
 * Checks if a contact's public key has changed compared to last known saved key
 */
export async function checkContactKeyChange(contactUid: string, currentPublicKey: string): Promise<{ hasChanged: boolean; previousKey: string | null }> {
    const storageKey = `seen_pubkey_${contactUid}`;
    const previousKey = await getE2EEStorageItem<string>(storageKey);

    if (!previousKey) {
        // First time seeing this key, save it
        await setE2EEStorageItem(storageKey, currentPublicKey);
        return { hasChanged: false, previousKey: null };
    }

    if (previousKey !== currentPublicKey) {
        return { hasChanged: true, previousKey };
    }

    return { hasChanged: false, previousKey };
}

/**
 * Update saved public key after user acknowledges key change alert
 */
export async function acknowledgeKeyChange(contactUid: string, newPublicKey: string): Promise<void> {
    await setE2EEStorageItem(`seen_pubkey_${contactUid}`, newPublicKey);
}
