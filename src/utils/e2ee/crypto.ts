import { ensureSodium } from './sodium';

export interface KeyPair {
    publicKey: string; // Base64
    privateKey: string; // Base64
}

export interface IdentityKeyBundle {
    // X25519 - used for DH/ECDH (X3DH, ratchet, sealed boxes)
    publicKey: string;
    privateKey: string;
    // Ed25519 - used only to SIGN the Signed PreKey (X3DH requirement)
    signPublicKey: string;
    signPrivateKey: string;
}

export interface EncryptedBox {
    nonce: string; // Base64
    ciphertext: string; // Base64
}

/**
 * Generate a new X25519 Keypair for user identity
 */
export async function generateKeyPair(): Promise<KeyPair> {
    const sodium = await ensureSodium();
    const kp = sodium.crypto_box_keypair();
    return {
        publicKey: sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL),
        privateKey: sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL)
    };
}

/**
 * Generate a full identity bundle: X25519 keypair (for DH) + Ed25519 keypair
 * (for signing the Signed PreKey during X3DH). WhatsApp/Signal identity keys
 * are dual-purpose in exactly this way.
 */
export async function generateIdentityKeyBundle(): Promise<IdentityKeyBundle> {
    const sodium = await ensureSodium();
    const dhKp = sodium.crypto_box_keypair();
    const signKp = sodium.crypto_sign_keypair();
    return {
        publicKey: sodium.to_base64(dhKp.publicKey, sodium.base64_variants.ORIGINAL),
        privateKey: sodium.to_base64(dhKp.privateKey, sodium.base64_variants.ORIGINAL),
        signPublicKey: sodium.to_base64(signKp.publicKey, sodium.base64_variants.ORIGINAL),
        signPrivateKey: sodium.to_base64(signKp.privateKey, sodium.base64_variants.ORIGINAL)
    };
}

/**
 * @deprecated Static shared-secret derivation offers NO forward secrecy.
 * Replaced by X3DH (x3dh.ts) + Double Ratchet (ratchet.ts) for all new
 * sessions. Kept only as a reference; do not use for new message encryption.
 */
export async function deriveSharedSecret(myPrivateKeyBase64: string, targetPublicKeyBase64: string): Promise<Uint8Array> {
    if (!myPrivateKeyBase64 || !targetPublicKeyBase64 || myPrivateKeyBase64.trim() === '' || targetPublicKeyBase64.trim() === '') {
        throw new Error('Encryption keys cannot be null or empty string');
    }
    const sodium = await ensureSodium();
    const myPrivKey = sodium.from_base64(myPrivateKeyBase64, sodium.base64_variants.ORIGINAL);
    const targetPubKey = sodium.from_base64(targetPublicKeyBase64, sodium.base64_variants.ORIGINAL);

    if (myPrivKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
        throw new Error(`Private key length invalid (got ${myPrivKey.length}, expected ${sodium.crypto_box_SECRETKEYBYTES})`);
    }
    if (targetPubKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
        throw new Error(`Public key length invalid (got ${targetPubKey.length}, expected ${sodium.crypto_box_PUBLICKEYBYTES})`);
    }

    // crypto_box_beforenm computes precalculated shared key from scalar multiplication
    return sodium.crypto_box_beforenm(targetPubKey, myPrivKey);
}

/**
 * Encrypt a text string using XSalsa20-Poly1305 with a 32-byte symmetric key (or ECDH shared secret)
 */
export async function encryptTextSymmetric(text: string, key: Uint8Array): Promise<string> {
    if (!key || key.length !== 32) {
        throw new Error('Encryption key length cannot be null or invalid');
    }
    const sodium = await ensureSodium();
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const textBytes = sodium.from_string(encodeURIComponent(text));
    const cipherBytes = sodium.crypto_secretbox_easy(textBytes, nonce, key);

    const nonceBase64 = sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL);
    const cipherBase64 = sodium.to_base64(cipherBytes, sodium.base64_variants.ORIGINAL);

    return `🔒E2EE:v1:${nonceBase64}:${cipherBase64}`;
}

/**
 * Decrypt a text string encrypted with XSalsa20-Poly1305
 */
export async function decryptTextSymmetric(ciphertext: string, key: Uint8Array): Promise<string> {
    if (!key || key.length !== 32) {
        throw new Error('Decryption key length cannot be null or invalid');
    }
    if (!ciphertext || !ciphertext.startsWith('🔒E2EE:v1:')) {
        throw new Error('Invalid E2EE format');
    }

    const parts = ciphertext.split(':');
    if (parts.length < 4) {
        throw new Error('Malformed E2EE ciphertext');
    }

    const nonceBase64 = parts[2];
    const cipherBase64 = parts[3];

    const sodium = await ensureSodium();
    const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);
    const cipherBytes = sodium.from_base64(cipherBase64, sodium.base64_variants.ORIGINAL);

    const decryptedBytes = sodium.crypto_secretbox_open_easy(cipherBytes, nonce, key);
    if (!decryptedBytes) {
        throw new Error('Decryption failed (MAC mismatch or invalid key)');
    }

    const decodedStr = sodium.to_string(decryptedBytes);
    return decodeURIComponent(decodedStr);
}

/**
 * Generate a random 256-bit symmetric room key
 */
export async function generateRoomSymmetricKey(): Promise<string> {
    const sodium = await ensureSodium();
    const keyBytes = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    return sodium.to_base64(keyBytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Wrap (encrypt) a room key for a specific member using their X25519 Public Key (Sealed Box)
 */
export async function wrapRoomKeyForMember(roomKeyBase64: string, memberPublicKeyBase64: string): Promise<string> {
    if (!roomKeyBase64 || !memberPublicKeyBase64) {
        throw new Error('Member public key or room key cannot be null or empty');
    }
    const sodium = await ensureSodium();
    const roomKeyBytes = sodium.from_base64(roomKeyBase64, sodium.base64_variants.ORIGINAL);
    const memberPubKeyBytes = sodium.from_base64(memberPublicKeyBase64, sodium.base64_variants.ORIGINAL);

    const sealedBytes = sodium.crypto_box_seal(roomKeyBytes, memberPubKeyBytes);
    return sodium.to_base64(sealedBytes, sodium.base64_variants.ORIGINAL);
}

/**
 * Unwrap (decrypt) a sealed box room key using current user's public & private key pair
 */
export async function unwrapRoomKeyForMember(wrappedKeyBase64: string, myPublicKeyBase64: string, myPrivateKeyBase64: string): Promise<string> {
    if (!wrappedKeyBase64 || !myPublicKeyBase64 || !myPrivateKeyBase64) {
        throw new Error('Keys for unwrapping cannot be null or empty');
    }
    const sodium = await ensureSodium();
    const sealedBytes = sodium.from_base64(wrappedKeyBase64, sodium.base64_variants.ORIGINAL);
    const myPubKeyBytes = sodium.from_base64(myPublicKeyBase64, sodium.base64_variants.ORIGINAL);
    const myPrivKeyBytes = sodium.from_base64(myPrivateKeyBase64, sodium.base64_variants.ORIGINAL);

    const unwrappedBytes = sodium.crypto_box_seal_open(sealedBytes, myPubKeyBytes, myPrivKeyBytes);
    if (!unwrappedBytes) {
        throw new Error('Failed to unwrap room key');
    }
    return sodium.to_base64(unwrappedBytes, sodium.base64_variants.ORIGINAL);
}
