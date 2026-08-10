import { ensureSodium } from './sodium';

/**
 * Double Ratchet Algorithm (Signal/WhatsApp style).
 *
 * Provides:
 *  - Forward secrecy: each message uses a unique key derived from a
 *    continuously-advancing chain key. Once used, the message key is
 *    deleted, so compromising a later key cannot reveal earlier messages.
 *  - Post-compromise security: every time the conversation "turns around"
 *    (the other party replies), a new Diffie-Hellman exchange mixes fresh
 *    randomness into the root key, so even a fully compromised state heals
 *    itself going forward.
 *
 * This is a from-scratch, sodium-based implementation of the algorithm
 * described in the Signal Double Ratchet spec (simplified: no header
 * encryption, since transport confidentiality of headers is provided
 * separately by TLS + Firestore's channel).
 */

export interface RatchetHeader {
    dhPublicKey: string;   // Base64 - sender's current ratchet public key
    prevChainLength: number; // Number of messages in previous sending chain
    messageNumber: number;   // Message number within the current sending chain
}

export interface EncryptedRatchetMessage {
    header: RatchetHeader;
    nonce: string;      // Base64
    ciphertext: string; // Base64
}

export interface SkippedKeyEntry {
    dhPublicKey: string;
    messageNumber: number;
    messageKey: string; // Base64 - stored temporarily for out-of-order delivery
}

export interface RatchetState {
    // DH ratchet keys
    dhSelfPublicKey: string;
    dhSelfPrivateKey: string;
    dhRemotePublicKey: string | null;

    // Root key, advances on every DH ratchet step
    rootKey: string; // Base64

    // Sending / receiving chain keys (symmetric ratchet)
    chainKeySend: string | null; // Base64
    chainKeyRecv: string | null; // Base64

    // Message counters
    sendMessageNumber: number;
    recvMessageNumber: number;
    prevSendChainLength: number;

    // Buffer of message keys for messages that arrive out of order,
    // keyed by "dhPublicKey:messageNumber". Capped to avoid unbounded growth.
    skippedMessageKeys: SkippedKeyEntry[];
}

const MAX_SKIP = 1000; // Signal's default MAX_SKIP - max out-of-order messages tolerated
const MAX_SKIPPED_KEYS_STORED = 2000; // hard cap on buffer size

const INFO_ROOT = 'NEETMaster-DR-Root-v1';
const INFO_CHAIN = 'NEETMaster-DR-Chain-v1';
const INFO_MESSAGE = 'NEETMaster-DR-Message-v1';

/**
 * HKDF-like key derivation using libsodium's crypto_kdf (BLAKE2b based).
 * Derives `outputs` number of 32-byte subkeys from an input key + context string.
 */
async function kdf(inputKeyBase64OrBytes: string | Uint8Array, contextInfo: string, outputCount: number): Promise<Uint8Array[]> {
    const sodium = await ensureSodium();
    const ikm = typeof inputKeyBase64OrBytes === 'string'
        ? sodium.from_base64(inputKeyBase64OrBytes, sodium.base64_variants.ORIGINAL)
        : inputKeyBase64OrBytes;

    // Use crypto_generichash keyed with the IKM, one call per desired output,
    // salted by an incrementing counter + context, similar in spirit to HKDF-Expand.
    const outputs: Uint8Array[] = [];
    for (let i = 0; i < outputCount; i++) {
        const info = sodium.from_string(`${contextInfo}:${i}`);
        const out = sodium.crypto_generichash(32, info, ikm.length === 32 ? ikm : sodium.crypto_generichash(32, ikm, null));
        outputs.push(out);
    }
    return outputs;
}

/**
 * Root KDF: given the current root key and a fresh DH output, derives a
 * new root key and a new chain key.
 */
async function kdfRootKey(rootKeyBase64: string, dhOutput: Uint8Array): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> {
    const sodium = await ensureSodium();
    const rootKeyBytes = sodium.from_base64(rootKeyBase64, sodium.base64_variants.ORIGINAL);

    // Combine root key + dh output, then derive two outputs
    const combined = new Uint8Array(rootKeyBytes.length + dhOutput.length);
    combined.set(rootKeyBytes, 0);
    combined.set(dhOutput, rootKeyBytes.length);

    const [newRoot, newChain] = await kdf(combined, INFO_ROOT, 2);
    return { rootKey: newRoot, chainKey: newChain };
}

/**
 * Chain KDF: given the current chain key, derives the next chain key and
 * a message key for the current step. This is the fast "symmetric ratchet".
 */
async function kdfChainKey(chainKeyBase64: string): Promise<{ nextChainKey: Uint8Array; messageKey: Uint8Array }> {
    const sodium = await ensureSodium();
    const chainKeyBytes = sodium.from_base64(chainKeyBase64, sodium.base64_variants.ORIGINAL);

    // Use HMAC-like construction via generichash keyed by chain key.
    const nextChainKey = sodium.crypto_generichash(32, sodium.from_string('chain'), chainKeyBytes);
    const messageKey = sodium.crypto_generichash(32, sodium.from_string('message'), chainKeyBytes);
    return { nextChainKey, messageKey };
}

/**
 * Initializes ratchet state for the INITIATOR of a session (the person who
 * ran X3DH as Alice). They start able to send immediately; their sending
 * chain is derived right away, and the receiving chain is empty until the
 * first DH ratchet step (triggered by the recipient's reply).
 */
export async function initRatchetAsInitiator(
    sharedSecretFromX3DH: Uint8Array,
    theirSignedPreKeyPublicKeyBase64: string
): Promise<RatchetState> {
    const sodium = await ensureSodium();
    const dhSelf = sodium.crypto_box_keypair();

    const rootKeyInitial = sodium.to_base64(sharedSecretFromX3DH, sodium.base64_variants.ORIGINAL);

    // Perform initial DH ratchet step against their signed prekey to derive first sending chain
    const dhSelfPrivBytes = dhSelf.privateKey;
    const theirPubBytes = sodium.from_base64(theirSignedPreKeyPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const dhOutput = sodium.crypto_scalarmult(dhSelfPrivBytes, theirPubBytes);

    const { rootKey, chainKey } = await kdfRootKey(rootKeyInitial, dhOutput);

    return {
        dhSelfPublicKey: sodium.to_base64(dhSelf.publicKey, sodium.base64_variants.ORIGINAL),
        dhSelfPrivateKey: sodium.to_base64(dhSelf.privateKey, sodium.base64_variants.ORIGINAL),
        dhRemotePublicKey: theirSignedPreKeyPublicKeyBase64,
        rootKey: sodium.to_base64(rootKey, sodium.base64_variants.ORIGINAL),
        chainKeySend: sodium.to_base64(chainKey, sodium.base64_variants.ORIGINAL),
        chainKeyRecv: null,
        sendMessageNumber: 0,
        recvMessageNumber: 0,
        prevSendChainLength: 0,
        skippedMessageKeys: []
    };
}

/**
 * Initializes ratchet state for the RECIPIENT of a session (Bob). Their own
 * signed prekey pair becomes the initial DH ratchet keypair; the receiving
 * chain is derived from the same handshake, symmetric to the initiator.
 */
export async function initRatchetAsRecipient(
    sharedSecretFromX3DH: Uint8Array,
    mySignedPreKeyPublicKeyBase64: string,
    mySignedPreKeyPrivateKeyBase64: string
): Promise<RatchetState> {
    const sodium = await ensureSodium();
    const rootKeyInitial = sodium.to_base64(sharedSecretFromX3DH, sodium.base64_variants.ORIGINAL);

    return {
        dhSelfPublicKey: mySignedPreKeyPublicKeyBase64,
        dhSelfPrivateKey: mySignedPreKeyPrivateKeyBase64,
        dhRemotePublicKey: null,
        rootKey: rootKeyInitial,
        chainKeySend: null,
        chainKeyRecv: null,
        sendMessageNumber: 0,
        recvMessageNumber: 0,
        prevSendChainLength: 0,
        skippedMessageKeys: []
    };
}

/**
 * Performs a DH ratchet step: generates a new self keypair, mixes the DH
 * output with the root key to derive a fresh receiving chain, keyed off
 * the sender's new public key found in an incoming message header.
 */
async function dhRatchetStep(state: RatchetState, theirNewPublicKeyBase64: string): Promise<RatchetState> {
    const sodium = await ensureSodium();

    let next: RatchetState = {
        ...state,
        prevSendChainLength: state.sendMessageNumber,
        sendMessageNumber: 0,
        recvMessageNumber: 0,
        dhRemotePublicKey: theirNewPublicKeyBase64
    };

    // Step 1: derive new receiving chain using our existing private key + their new public key
    const myPrivBytes = sodium.from_base64(state.dhSelfPrivateKey, sodium.base64_variants.ORIGINAL);
    const theirPubBytes = sodium.from_base64(theirNewPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const dhOutputRecv = sodium.crypto_scalarmult(myPrivBytes, theirPubBytes);
    const { rootKey: rootKeyAfterRecv, chainKey: chainKeyRecv } = await kdfRootKey(next.rootKey, dhOutputRecv);

    next.rootKey = sodium.to_base64(rootKeyAfterRecv, sodium.base64_variants.ORIGINAL);
    next.chainKeyRecv = sodium.to_base64(chainKeyRecv, sodium.base64_variants.ORIGINAL);

    // Step 2: generate a fresh self keypair and derive new sending chain
    const newSelfKeyPair = sodium.crypto_box_keypair();
    const newSelfPrivBytes = newSelfKeyPair.privateKey;
    const dhOutputSend = sodium.crypto_scalarmult(newSelfPrivBytes, theirPubBytes);
    const { rootKey: rootKeyAfterSend, chainKey: chainKeySend } = await kdfRootKey(next.rootKey, dhOutputSend);

    next.rootKey = sodium.to_base64(rootKeyAfterSend, sodium.base64_variants.ORIGINAL);
    next.chainKeySend = sodium.to_base64(chainKeySend, sodium.base64_variants.ORIGINAL);
    next.dhSelfPublicKey = sodium.to_base64(newSelfKeyPair.publicKey, sodium.base64_variants.ORIGINAL);
    next.dhSelfPrivateKey = sodium.to_base64(newSelfKeyPair.privateKey, sodium.base64_variants.ORIGINAL);

    return next;
}

/**
 * Encrypts a plaintext message using the current sending chain, advancing
 * the symmetric ratchet by one step. Returns the ciphertext plus a header
 * the recipient needs to derive the same message key.
 */
export async function ratchetEncrypt(state: RatchetState, plaintext: string): Promise<{ state: RatchetState; message: EncryptedRatchetMessage }> {
    if (!state.chainKeySend) {
        throw new Error('No sending chain established yet - cannot encrypt. Session may not be fully initialized.');
    }
    const sodium = await ensureSodium();

    const { nextChainKey, messageKey } = await kdfChainKey(state.chainKeySend);

    const header: RatchetHeader = {
        dhPublicKey: state.dhSelfPublicKey,
        prevChainLength: state.prevSendChainLength,
        messageNumber: state.sendMessageNumber
    };

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const plaintextBytes = sodium.from_string(encodeURIComponent(plaintext));
    const cipherBytes = sodium.crypto_secretbox_easy(plaintextBytes, nonce, messageKey);

    const newState: RatchetState = {
        ...state,
        chainKeySend: sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL),
        sendMessageNumber: state.sendMessageNumber + 1
    };

    return {
        state: newState,
        message: {
            header,
            nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
            ciphertext: sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL)
        }
    };
}

/**
 * Attempts to find and consume a previously-buffered skipped message key
 * matching this header (handles out-of-order delivery).
 */
function trySkippedMessageKey(state: RatchetState, header: RatchetHeader): { messageKey: string; remaining: SkippedKeyEntry[] } | null {
    const idx = state.skippedMessageKeys.findIndex(
        e => e.dhPublicKey === header.dhPublicKey && e.messageNumber === header.messageNumber
    );
    if (idx === -1) return null;
    const entry = state.skippedMessageKeys[idx];
    const remaining = [...state.skippedMessageKeys.slice(0, idx), ...state.skippedMessageKeys.slice(idx + 1)];
    return { messageKey: entry.messageKey, remaining };
}

/**
 * Advances the receiving chain forward, buffering any skipped message keys
 * along the way so out-of-order messages can still be decrypted later.
 */
async function skipMessageKeys(state: RatchetState, dhPublicKey: string, untilMessageNumber: number): Promise<RatchetState> {
    if (!state.chainKeyRecv) return state;

    if (untilMessageNumber - state.recvMessageNumber > MAX_SKIP) {
        throw new Error('Too many skipped messages - refusing to buffer (possible attack or major desync)');
    }

    const sodium = await ensureSodium();
    let chainKey = state.chainKeyRecv;
    let msgNum = state.recvMessageNumber;
    const newSkipped: SkippedKeyEntry[] = [...state.skippedMessageKeys];

    while (msgNum < untilMessageNumber) {
        const { nextChainKey, messageKey } = await kdfChainKey(chainKey);
        newSkipped.push({
            dhPublicKey,
            messageNumber: msgNum,
            messageKey: sodium.to_base64(messageKey, sodium.base64_variants.ORIGINAL)
        });
        chainKey = sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL);
        msgNum++;
    }

    // Cap the skipped-key buffer to avoid unbounded growth (drop oldest first)
    const trimmed = newSkipped.length > MAX_SKIPPED_KEYS_STORED
        ? newSkipped.slice(newSkipped.length - MAX_SKIPPED_KEYS_STORED)
        : newSkipped;

    return {
        ...state,
        chainKeyRecv: chainKey,
        recvMessageNumber: msgNum,
        skippedMessageKeys: trimmed
    };
}

/**
 * Decrypts an incoming ratchet message, performing a DH ratchet step if the
 * message's header carries a new DH public key we haven't ratcheted to yet,
 * and buffering/consuming skipped keys as needed for out-of-order delivery.
 */
export async function ratchetDecrypt(state: RatchetState, message: EncryptedRatchetMessage): Promise<{ state: RatchetState; plaintext: string }> {
    const sodium = await ensureSodium();
    const { header, nonce, ciphertext } = message;

    // 1. Check skipped-key buffer first (handles messages that arrived out of order)
    const skipped = trySkippedMessageKey(state, header);
    if (skipped) {
        const plaintext = await decryptWithMessageKey(skipped.messageKey, nonce, ciphertext);
        return {
            state: { ...state, skippedMessageKeys: skipped.remaining },
            plaintext
        };
    }

    let working = state;

    // 2. If the header's DH public key differs from what we have, perform a DH ratchet step
    if (header.dhPublicKey !== working.dhRemotePublicKey) {
        // Buffer any remaining keys in the OLD receiving chain first
        if (working.chainKeyRecv && working.dhRemotePublicKey) {
            working = await skipMessageKeys(working, working.dhRemotePublicKey, header.prevChainLength);
        }
        working = await dhRatchetStep(working, header.dhPublicKey);
    }

    // 3. Buffer any skipped keys in the CURRENT receiving chain up to this message
    if (header.messageNumber > working.recvMessageNumber) {
        working = await skipMessageKeys(working, header.dhPublicKey, header.messageNumber);
    }

    // 4. Derive this message's key and advance the chain by one step
    if (!working.chainKeyRecv) {
        throw new Error('No receiving chain established - cannot decrypt message');
    }
    const { nextChainKey, messageKey } = await kdfChainKey(working.chainKeyRecv);
    working = {
        ...working,
        chainKeyRecv: sodium.to_base64(nextChainKey, sodium.base64_variants.ORIGINAL),
        recvMessageNumber: working.recvMessageNumber + 1
    };

    const messageKeyBase64 = sodium.to_base64(messageKey, sodium.base64_variants.ORIGINAL);
    const plaintext = await decryptWithMessageKey(messageKeyBase64, nonce, ciphertext);

    return { state: working, plaintext };
}

async function decryptWithMessageKey(messageKeyBase64: string, nonceBase64: string, ciphertextBase64: string): Promise<string> {
    const sodium = await ensureSodium();
    const messageKey = sodium.from_base64(messageKeyBase64, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(ciphertextBase64, sodium.base64_variants.ORIGINAL);

    const decrypted = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, messageKey);
    if (!decrypted) {
        throw new Error('Ratchet message decryption failed (MAC mismatch, corrupted data, or wrong key)');
    }
    return decodeURIComponent(sodium.to_string(decrypted));
}

/**
 * Serializes a RatchetState to a plain JSON-safe object for storage.
 */
export function serializeRatchetState(state: RatchetState): string {
    return JSON.stringify(state);
}

export function deserializeRatchetState(json: string): RatchetState {
    return JSON.parse(json);
}
