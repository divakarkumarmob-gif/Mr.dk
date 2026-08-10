import { ensureSodium } from './sodium';
import { getE2EEStorageItem, setE2EEStorageItem } from './storage';

/**
 * Sender Keys protocol (WhatsApp/Signal group messaging style).
 *
 * Instead of pairwise ratchets between every member (O(n^2) and doesn't
 * scale), each member maintains ONE outgoing symmetric ratchet chain
 * ("sender key") for the room. They distribute the current chain key to
 * every other member individually, encrypted with that member's identity
 * public key (sealed box). From then on:
 *
 *  - Sending: the sender advances their own chain locally and encrypts
 *    with the derived message key. No per-recipient work needed per message.
 *  - Receiving: every other member advances THEIR COPY of the sender's
 *    chain to derive the same message key.
 *
 * Forward secrecy: like the 1v1 ratchet, each message key is single-use
 * and the chain only moves forward, so a compromised current key can't
 * reveal past messages.
 *
 * Post-compromise security / membership changes: when a member joins or
 * leaves, every remaining member should call `rotateSenderKey` to start a
 * fresh chain and redistribute it, so a removed member (or someone who
 * captured an old chain key) cannot decrypt new messages.
 */

export interface SenderKeyChainState {
    roomId: string;
    senderUid: string;
    chainKey: string;      // Base64 - current chain key (advances forward only)
    messageNumber: number;  // Current position in the chain
    createdAt: string;
    keyGeneration: number;  // Incremented on every rotation
}

export interface SenderKeyDistributionMessage {
    roomId: string;
    senderUid: string;
    chainKey: string;       // Base64 - the chain key at time of distribution
    messageNumber: number;  // Chain position at time of distribution (usually 0 on rotation)
    keyGeneration: number;
}

export interface EncryptedGroupMessage {
    senderUid: string;
    messageNumber: number;
    keyGeneration: number;
    nonce: string;      // Base64
    ciphertext: string; // Base64
}

const INFO_SENDER_CHAIN = 'NEETMaster-SenderKey-Chain-v1';
const INFO_SENDER_MESSAGE = 'NEETMaster-SenderKey-Message-v1';

async function kdfChainStep(chainKeyBase64: string): Promise<{ nextChainKey: Uint8Array; messageKey: Uint8Array }> {
    const sodium = await ensureSodium();
    const chainKeyBytes = sodium.from_base64(chainKeyBase64, sodium.base64_variants.ORIGINAL);
    const nextChainKey = sodium.crypto_generichash(32, sodium.from_string(INFO_SENDER_CHAIN), chainKeyBytes);
    const messageKey = sodium.crypto_generichash(32, sodium.from_string(INFO_SENDER_MESSAGE), chainKeyBytes);
    return { nextChainKey, messageKey };
}

function ownChainStorageKey(myUid: string, roomId: string): string {
    return `senderkey_own_${myUid}_${roomId}`;
}
function receivedChainStorageKey(myUid: string, roomId: string, senderUid: string): string {
    return `senderkey_recv_${myUid}_${roomId}_${senderUid}`;
}
function skippedKeysStorageKey(myUid: string, roomId: string, senderUid: string): string {
    return `senderkey_skipped_${myUid}_${roomId}_${senderUid}`;
}

/**
 * Generates a brand new sender key chain for `myUid` in `roomId`. Call this
 * when first joining a room, or when rotating after a membership change.
 */
export async function createSenderKeyChain(myUid: string, roomId: string, previousGeneration: number = 0): Promise<SenderKeyChainState> {
    const sodium = await ensureSodium();
    const chainKeyBytes = sodium.randombytes_buf(32);

    const state: SenderKeyChainState = {
        roomId,
        senderUid: myUid,
        chainKey: sodium.to_base64(chainKeyBytes, sodium.base64_variants.ORIGINAL),
        messageNumber: 0,
        createdAt: new Date().toISOString(),
        keyGeneration: previousGeneration + 1
    };

    await setE2EEStorageItem(ownChainStorageKey(myUid, roomId), state);
    return state;
}

export async function getOwnSenderKeyChain(myUid: string, roomId: string): Promise<SenderKeyChainState | null> {
    return getE2EEStorageItem<SenderKeyChainState>(ownChainStorageKey(myUid, roomId));
}

/**
 * Builds the distribution message to send to a specific room member,
 * to be encrypted with their identity public key (crypto_box_seal) before
 * sending over Firestore. Call once per member when joining/rotating.
 */
export function buildDistributionMessage(state: SenderKeyChainState): SenderKeyDistributionMessage {
    return {
        roomId: state.roomId,
        senderUid: state.senderUid,
        chainKey: state.chainKey,
        messageNumber: state.messageNumber,
        keyGeneration: state.keyGeneration
    };
}

/**
 * Seals (encrypts) a distribution message for a specific recipient using
 * their X25519 identity public key. Anonymous sealed box: only the
 * recipient's private key can open it.
 */
export async function sealDistributionMessage(msg: SenderKeyDistributionMessage, recipientPublicKeyBase64: string): Promise<string> {
    const sodium = await ensureSodium();
    const plaintext = sodium.from_string(JSON.stringify(msg));
    const recipientPubKey = sodium.from_base64(recipientPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const sealed = sodium.crypto_box_seal(plaintext, recipientPubKey);
    return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}

/**
 * Opens a sealed distribution message using our own identity keypair, and
 * stores the resulting chain as a RECEIVING-only chain for that sender.
 */
export async function receiveDistributionMessage(
    sealedBase64: string,
    myUid: string,
    myPublicKeyBase64: string,
    myPrivateKeyBase64: string
): Promise<SenderKeyChainState> {
    const sodium = await ensureSodium();
    const sealed = sodium.from_base64(sealedBase64, sodium.base64_variants.ORIGINAL);
    const myPub = sodium.from_base64(myPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const myPriv = sodium.from_base64(myPrivateKeyBase64, sodium.base64_variants.ORIGINAL);

    const opened = sodium.crypto_box_seal_open(sealed, myPub, myPriv);
    if (!opened) {
        throw new Error('Failed to open sender-key distribution message (wrong key or corrupted data)');
    }

    const msg: SenderKeyDistributionMessage = JSON.parse(sodium.to_string(opened));

    const state: SenderKeyChainState = {
        roomId: msg.roomId,
        senderUid: msg.senderUid,
        chainKey: msg.chainKey,
        messageNumber: msg.messageNumber,
        createdAt: new Date().toISOString(),
        keyGeneration: msg.keyGeneration
    };

    await setE2EEStorageItem(receivedChainStorageKey(myUid, msg.roomId, msg.senderUid), state);
    // A rotation invalidates any previously buffered skipped keys for this sender
    await setE2EEStorageItem(skippedKeysStorageKey(myUid, msg.roomId, msg.senderUid), []);
    return state;
}

export async function getReceivedSenderKeyChain(myUid: string, roomId: string, senderUid: string): Promise<SenderKeyChainState | null> {
    return getE2EEStorageItem<SenderKeyChainState>(receivedChainStorageKey(myUid, roomId, senderUid));
}

/**
 * Encrypts a group message using the sender's own advancing chain.
 */
export async function senderKeyEncrypt(myUid: string, roomId: string, plaintext: string): Promise<{ message: EncryptedGroupMessage; newState: SenderKeyChainState }> {
    const state = await getOwnSenderKeyChain(myUid, roomId);
    if (!state) {
        throw new Error('No sender key chain established for this room yet');
    }
    const sodium = await ensureSodium();
    const { nextChainKey, messageKey } = await kdfChainStep(state.chainKey);

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const plaintextBytes = sodium.from_string(encodeURIComponent(plaintext));
    const cipherBytes = sodium.crypto_secretbox_easy(plaintextBytes, nonce, messageKey);

    const newState: SenderKeyChainState = {
        ...state,
        chainKey: sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL),
        messageNumber: state.messageNumber + 1
    };
    await setE2EEStorageItem(ownChainStorageKey(myUid, roomId), newState);

    return {
        message: {
            senderUid: myUid,
            messageNumber: state.messageNumber,
            keyGeneration: state.keyGeneration,
            nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
            ciphertext: sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL)
        },
        newState
    };
}

const MAX_SENDER_SKIP = 1000;
const MAX_SENDER_SKIPPED_STORED = 2000;

/**
 * Decrypts a group message from another member, advancing our stored copy
 * of their chain forward and buffering skipped keys for out-of-order
 * delivery, same as the 1v1 ratchet's symmetric chain.
 */
export async function senderKeyDecrypt(myUid: string, message: EncryptedGroupMessage, roomId: string): Promise<string> {
    const sodium = await ensureSodium();
    let state = await getReceivedSenderKeyChain(myUid, roomId, message.senderUid);
    if (!state) {
        throw new Error(`No sender-key chain received yet for ${message.senderUid} in this room - cannot decrypt. Ask them to re-share their key.`);
    }
    if (state.keyGeneration !== message.keyGeneration) {
        throw new Error('Sender key generation mismatch - the sender has rotated their key (likely a membership change). Waiting for new distribution message.');
    }

    const skippedRaw = await getE2EEStorageItem<Array<{ messageNumber: number; messageKey: string }>>(
        skippedKeysStorageKey(myUid, roomId, message.senderUid)
    );
    const skipped = skippedRaw || [];

    // Check skipped-key buffer for out-of-order messages
    const skipIdx = skipped.findIndex(e => e.messageNumber === message.messageNumber);
    if (skipIdx !== -1) {
        const entry = skipped[skipIdx];
        const remaining = [...skipped.slice(0, skipIdx), ...skipped.slice(skipIdx + 1)];
        await setE2EEStorageItem(skippedKeysStorageKey(myUid, roomId, message.senderUid), remaining);
        return decryptGroupMessageWithKey(entry.messageKey, message.nonce, message.ciphertext);
    }

    if (message.messageNumber < state.messageNumber) {
        throw new Error('Message key already consumed or too old to recover (forward secrecy - this is expected behavior, not a bug)');
    }

    if (message.messageNumber - state.messageNumber > MAX_SENDER_SKIP) {
        throw new Error('Too many skipped group messages - refusing to buffer');
    }

    // Advance chain forward to the target message, buffering intermediate keys
    let chainKey = state.chainKey;
    let msgNum = state.messageNumber;
    const newSkipped = [...skipped];

    while (msgNum < message.messageNumber) {
        const { nextChainKey, messageKey } = await kdfChainStep(chainKey);
        newSkipped.push({ messageNumber: msgNum, messageKey: sodium.to_base64(messageKey, sodium.base64_variants.ORIGINAL) });
        chainKey = sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL);
        msgNum++;
    }

    // Derive the target message's key
    const { nextChainKey, messageKey } = await kdfChainStep(chainKey);
    const finalChainKey = sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL);
    const finalMessageKey = sodium.to_base64(messageKey, sodium.base64_variants.ORIGINAL);

    const trimmedSkipped = newSkipped.length > MAX_SENDER_SKIPPED_STORED
        ? newSkipped.slice(newSkipped.length - MAX_SENDER_SKIPPED_STORED)
        : newSkipped;

    await setE2EEStorageItem(receivedChainStorageKey(myUid, roomId, message.senderUid), {
        ...state,
        chainKey: finalChainKey,
        messageNumber: msgNum + 1
    });
    await setE2EEStorageItem(skippedKeysStorageKey(myUid, roomId, message.senderUid), trimmedSkipped);

    return decryptGroupMessageWithKey(finalMessageKey, message.nonce, message.ciphertext);
}

async function decryptGroupMessageWithKey(messageKeyBase64: string, nonceBase64: string, ciphertextBase64: string): Promise<string> {
    const sodium = await ensureSodium();
    const messageKey = sodium.from_base64(messageKeyBase64, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(ciphertextBase64, sodium.base64_variants.ORIGINAL);

    const decrypted = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, messageKey);
    if (!decrypted) {
        throw new Error('Group message decryption failed (MAC mismatch or wrong key)');
    }
    return decodeURIComponent(sodium.to_string(decrypted));
}

/**
 * Rotates this member's sender key (new random chain, generation+1) - call
 * when a member leaves the room, or periodically for extra hygiene. The
 * caller is responsible for re-distributing the new chain to all current
 * members via sealDistributionMessage + Firestore.
 */
export async function rotateSenderKey(myUid: string, roomId: string): Promise<SenderKeyChainState> {
    const existing = await getOwnSenderKeyChain(myUid, roomId);
    return createSenderKeyChain(myUid, roomId, existing?.keyGeneration || 0);
}
