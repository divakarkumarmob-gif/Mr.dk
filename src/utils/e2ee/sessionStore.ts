import { getE2EEStorageItem, setE2EEStorageItem, removeE2EEStorageItem } from './storage';
import { RatchetState, serializeRatchetState, deserializeRatchetState } from './ratchet';

/**
 * Persists Double Ratchet session state locally (IndexedDB via storage.ts).
 * Session state is device-local and NEVER uploaded anywhere — losing it
 * means losing the ability to decrypt future messages on that device,
 * which is why PIN-backup only covers the long-term identity key, not
 * ratchet session state (matches WhatsApp/Signal: sessions don't survive
 * a fresh device restore, only identity does, and a fresh session is
 * negotiated automatically on next contact).
 */

export interface StoredSession {
    state: string; // serialized RatchetState JSON
    myUid: string;
    peerUid: string; // for 1v1: the other user's uid. For rooms: `room:<roomId>:<senderUid>` sender-key channel id
    initiatedByMe: boolean;
    establishedAt: string;
    lastUsedAt: string;
}

function sessionKey(myUid: string, peerChannelId: string): string {
    return `dr_session_${myUid}_${peerChannelId}`;
}

export async function saveSession(myUid: string, peerChannelId: string, state: RatchetState, initiatedByMe: boolean, existing?: StoredSession | null): Promise<void> {
    const stored: StoredSession = {
        state: serializeRatchetState(state),
        myUid,
        peerUid: peerChannelId,
        initiatedByMe: existing?.initiatedByMe ?? initiatedByMe,
        establishedAt: existing?.establishedAt ?? new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
    };
    await setE2EEStorageItem(sessionKey(myUid, peerChannelId), stored);
}

export async function loadSession(myUid: string, peerChannelId: string): Promise<{ state: RatchetState; meta: StoredSession } | null> {
    const stored = await getE2EEStorageItem<StoredSession>(sessionKey(myUid, peerChannelId));
    if (!stored) return null;
    try {
        return { state: deserializeRatchetState(stored.state), meta: stored };
    } catch (e) {
        console.error('Failed to deserialize ratchet session, treating as missing:', e);
        return null;
    }
}

export async function hasSession(myUid: string, peerChannelId: string): Promise<boolean> {
    const stored = await getE2EEStorageItem<StoredSession>(sessionKey(myUid, peerChannelId));
    return !!stored;
}

export async function deleteSession(myUid: string, peerChannelId: string): Promise<void> {
    await removeE2EEStorageItem(sessionKey(myUid, peerChannelId));
}

/**
 * Deterministic 1v1 session channel id (independent of Firestore chatId format).
 */
export function directSessionChannelId(otherUid: string): string {
    return `direct_${otherUid}`;
}

/**
 * Room sender-key channel id: each member has their OWN outgoing sender-key
 * chain, and every other member holds a receiving-only ratchet state for it.
 */
export function roomSenderChannelId(roomId: string, senderUid: string): string {
    return `room_${roomId}_sender_${senderUid}`;
}
