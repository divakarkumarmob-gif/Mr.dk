import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, X, 
    Camera, Phone, Video, Shield, Sparkles, User, Circle,
    Mic, MicOff, Square, Play, Pause, Trash2, Volume2, Lock, ShieldCheck, Laptop, AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';
import { decryptLegacyXOR } from '../utils/encryption';
import { 
    initUserE2EE, 
    fetchUserPublicKey, 
    encryptPayloadWithKey,
    decryptPayloadWithKey, 
    deriveSharedSecret,
    checkContactKeyChange,
    UserE2EEStatus,
    EncryptedPrivateKeyBackupBlob,
    RatchetState,
    ratchetEncryptPayload,
    ratchetDecryptPayload
} from '../utils/e2ee';
import {
    fetchKeyBundle,
    initiateX3DH,
    receiveX3DH,
    getLocalIdentitySignPrivateKey,
    getLocalIdentitySignPublicKey,
    getLocalSignedPreKey,
    getLocalOneTimePreKey,
    consumeLocalOneTimePreKey,
    ensureKeyBundleFresh
} from '../utils/e2ee/x3dh';
import {
    initRatchetAsInitiator,
    initRatchetAsRecipient
} from '../utils/e2ee/ratchet';
import {
    loadSession,
    saveSession,
    directSessionChannelId
} from '../utils/e2ee/sessionStore';
import PinSetupModal, { PinModalMode } from './e2ee/PinSetupModal';
import SafetyNumberModal from './e2ee/SafetyNumberModal';
import DeviceManagementModal from './e2ee/DeviceManagementModal';

export interface DirectUser {
    uid: string;
    name: string;
    photoURL?: string;
    badge?: string;
}

interface DirectMessage {
    id: string;
    senderId: string;
    senderName: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioDuration?: number;
    status: 'sent' | 'delivered' | 'read'; // WhatsApp style ticks status
    timestamp: any;
}

interface DirectChatProps {
    targetUser: DirectUser;
    onBack: () => void;
}

export default function DirectChat({ targetUser, onBack }: DirectChatProps) {
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [text, setText] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');
    const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

    // E2EE States
    const [e2eeStatus, setE2eeStatus] = useState<UserE2EEStatus | null>(null);
    const [e2eeLoading, setE2eeLoading] = useState<boolean>(true);
    const [showPinModal, setShowPinModal] = useState<boolean>(false);
    const [pinModalMode, setPinModalMode] = useState<PinModalMode>('setup');
    const [backupBlob, setBackupBlob] = useState<EncryptedPrivateKeyBackupBlob | undefined>();

    const [targetPublicKey, setTargetPublicKey] = useState<string | null>(null);
    // Ratchet session state replaces the old static `sharedSecret`. Every
    // encrypt/decrypt call advances this and the new value MUST be
    // persisted via saveSession before it's used again - see the ref below
    // which keeps the always-current value available to async callbacks
    // without waiting for a re-render.
    const [ratchetState, setRatchetState] = useState<RatchetState | null>(null);
    const ratchetStateRef = useRef<RatchetState | null>(null);
    const [sessionReady, setSessionReady] = useState<boolean>(false);
    const [keyChangedAlert, setKeyChangedAlert] = useState<boolean>(false);

    const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
    const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false);

    // Voice Note Recording State (WhatsApp style)
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingTime, setRecordingTime] = useState<number>(0);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
    const [recordedDuration, setRecordedDuration] = useState<number>(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
    
    // Playing audio state for chat messages feed
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const chatAudioRef = useRef<HTMLAudioElement | null>(null);

    // Target User Real Presence State (No fake status)
    const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: any }>({
        isOnline: false,
        lastSeen: null
    });

    // IMPORTANT: `auth.currentUser` can be null for a brief moment on initial
    // load / page refresh even when the user IS logged in, because Firebase
    // Auth resolves the persisted session asynchronously. Reading it
    // synchronously here previously caused a fake fallback uid
    // ('user_local_<timestamp>') to be used for Firestore writes, which
    // never matches request.auth.uid in security rules and always fails
    // with permission-denied. We track the real auth state explicitly
    // instead, and hold off on any E2EE/Firestore work until it resolves.
    const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid || null);
    const [authName, setAuthName] = useState<string>(auth.currentUser?.displayName || 'NEET Aspirant');
    const [authResolved, setAuthResolved] = useState<boolean>(!!auth.currentUser);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUid(user?.uid || null);
            setAuthName(user?.displayName || 'NEET Aspirant');
            setAuthResolved(true);
        });
        return () => unsubscribe();
    }, []);

    const currentUid = authUid || '';
    const currentName = authName;

    // Deterministic 1v1 Chat ID (Sorted UIDs)
    const chatId = currentUid ? [currentUid, targetUser.uid].sort().join('_direct_') : '';
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const sessionChannelId = directSessionChannelId(targetUser.uid);

    // Holds the X3DH handshake header we must attach to our first OUTGOING
    // message after initiating a new session, so the recipient can derive
    // the same shared secret. Cleared once sent.
    const pendingHandshakeRef = useRef<{ ephemeralPublicKey: string; usedSignedPreKeyId: number; usedOneTimePreKeyId: string | null } | null>(null);
    // Tracks whether the currently-loaded session was one we initiated, for
    // correct session metadata bookkeeping on save.
    const ratchetSessionMeta = useRef<{ initiatedByMe: boolean } | null>(null);
    // Guards against processing the same recipient-side handshake twice if
    // multiple snapshot callbacks race.
    const handshakeProcessedRef = useRef<boolean>(false);

    const updateRatchetState = async (next: RatchetState, initiatedByMe: boolean, existingMeta?: any) => {
        ratchetStateRef.current = next;
        ratchetSessionMeta.current = { initiatedByMe };
        setRatchetState(next);
        await saveSession(currentUid, sessionChannelId, next, initiatedByMe, existingMeta);
    };

    /**
     * RECIPIENT side of X3DH: given the handshake header carried on the
     * sender's first message, derive the shared secret and initialize our
     * ratchet state as a recipient.
     *
     * TIE-BREAK: since either side can now initiate a brand-new session
     * (see the negotiation useEffect above), it's possible BOTH sides
     * simultaneously created their own session with different ephemeral
     * keys before either message arrives. If that happens, the two sides
     * would end up with different shared secrets and be unable to decrypt
     * each other. To resolve this deterministically without extra
     * round-trips: the side with the lexicographically SMALLER uid always
     * "wins" - if we already have a self-initiated session but the
     * incoming handshake is from a smaller-uid sender, we discard our own
     * session and adopt theirs instead. If we're the smaller uid, we keep
     * our own and this handshake is ignored (the other side will pick up
     * our session via their own tie-break logic once our first message
     * reaches them).
     */
    const ensureRecipientSessionFromHandshake = async (
        handshake: { ephemeralPublicKey: string; usedSignedPreKeyId: number; usedOneTimePreKeyId: string | null; senderIdentityPublicKey: string },
        senderUid: string
    ) => {
        const haveOwnSession = !!ratchetStateRef.current;
        const weInitiatedOurs = ratchetSessionMeta.current?.initiatedByMe === true;
        const theyShouldWin = senderUid < currentUid;

        if (haveOwnSession) {
            if (!weInitiatedOurs) {
                // We already adopted a session (either resumed from storage,
                // or already processed a handshake) - don't reprocess.
                return;
            }
            if (!theyShouldWin) {
                // We self-initiated AND we have the smaller uid - our
                // session wins. Ignore their handshake.
                return;
            }
            // Fall through: we self-initiated but they have the smaller
            // uid, so their session should win - discard ours and adopt
            // theirs below.
        }
        if (handshakeProcessedRef.current && !haveOwnSession) return;
        if (!e2eeStatus?.privateKey) return;
        handshakeProcessedRef.current = true;

        try {
            const spk = await getLocalSignedPreKey(currentUid, handshake.usedSignedPreKeyId);
            if (!spk) {
                console.error('Cannot establish recipient session: local signed prekey not found (may have rotated).');
                handshakeProcessedRef.current = false;
                return;
            }
            let opkPriv: string | null = null;
            if (handshake.usedOneTimePreKeyId) {
                const opk = await getLocalOneTimePreKey(currentUid, handshake.usedOneTimePreKeyId);
                opkPriv = opk?.privateKey || null;
            }

            const x3dhResult = await receiveX3DH(
                e2eeStatus.privateKey,
                spk.privateKey,
                opkPriv,
                handshake.senderIdentityPublicKey,
                handshake.ephemeralPublicKey
            );

            const newState = await initRatchetAsRecipient(x3dhResult.sharedSecret, spk.publicKey, spk.privateKey);
            await updateRatchetState(newState, false);
            // We're adopting their session as the source of truth - any
            // handshake we were about to attach to our own next outgoing
            // message (from a session we self-initiated) is now stale and
            // must not be sent, or the real recipient would try to derive
            // a shared secret from an abandoned ephemeral key.
            pendingHandshakeRef.current = null;

            if (handshake.usedOneTimePreKeyId) {
                await consumeLocalOneTimePreKey(currentUid, handshake.usedOneTimePreKeyId);
            }
            setSessionReady(true);
        } catch (err) {
            console.error('Failed to establish recipient ratchet session from handshake:', err);
            handshakeProcessedRef.current = false;
        }
    };

    // Initialize E2EE for Current User
    // NOTE: identity is now created silently at login (see ensureSilentIdentity
    // in App.tsx), so `status.initialized` should almost always be true by
    // the time a chat is opened. The only user-facing modal this can still
    // trigger is 'restore' (isNewDevice) - i.e. this is a device that hasn't
    // seen this account's identity before AND the account has a backup blob
    // from another device, so we prompt for the backup PIN to restore it.
    useEffect(() => {
        let isMounted = true;
        if (!currentUid) {
            setE2eeLoading(true);
            return;
        }
        initUserE2EE(currentUid).then(status => {
            if (!isMounted) return;
            setE2eeStatus(status);
            setE2eeLoading(false);

            if (!status.initialized) {
                if (status.isNewDevice && status.backupBlob) {
                    setPinModalMode('restore');
                    setBackupBlob(status.backupBlob);
                    setShowPinModal(true);
                }
                // NOTE: the old `isFirstTime` branch that force-opened the
                // PIN modal here has been removed - identity generation no
                // longer requires or waits on a PIN (see ensureSilentIdentity).
            } else if (status.identityKeySign) {
                // Keep our published X3DH key bundle fresh (rotates signed
                // prekey periodically, replenishes one-time prekeys).
                ensureKeyBundleFresh(currentUid, status.publicKey!, status.identityKeySign).catch(err =>
                    console.warn('Key bundle refresh failed (non-fatal):', err)
                );
            }
        }).catch(err => {
            console.error("E2EE Init failed:", err);
            setE2eeLoading(false);
        });

        return () => { isMounted = false; };
    }, [currentUid]);

    // Establish (or resume) the Double Ratchet session with the target user
    // once our identity is ready. This replaces the old static ECDH
    // shared-secret derivation with a proper X3DH handshake + ratchet init.
    useEffect(() => {
        let isMounted = true;
        if (!e2eeStatus?.privateKey || !targetUser.uid) return;
        setSessionReady(false);

        (async () => {
            // 1. Fetch target's identity public key + check for safety-number changes
            const pubKey = await fetchUserPublicKey(targetUser.uid);
            if (!isMounted || !pubKey) return;
            setTargetPublicKey(pubKey);

            const keyChangeCheck = await checkContactKeyChange(targetUser.uid, pubKey);
            if (keyChangeCheck.hasChanged) {
                setKeyChangedAlert(true);
                // A changed identity key invalidates any existing session -
                // force a fresh X3DH handshake rather than risk using a
                // session tied to a key that's no longer valid (mirrors
                // WhatsApp's "security code changed" session reset).
            }

            // 2. Try to resume an existing local ratchet session first
            if (!keyChangeCheck.hasChanged) {
                const existing = await loadSession(currentUid, sessionChannelId);
                if (existing && isMounted) {
                    ratchetStateRef.current = existing.state;
                    setRatchetState(existing.state);
                    setSessionReady(true);
                    return;
                }
            }

            // 3. No usable session - negotiate a new one via X3DH.
            //    Normally, whichever side has the lexicographically smaller
            //    uid acts as "initiator" so both sides don't simultaneously
            //    negotiate two different sessions. BUT either side must be
            //    able to send the FIRST message of a brand new conversation
            //    - if we're the "recipient" role and the other side hasn't
            // 3. Negotiate a new session via X3DH (or Fallback if key bundle missing)
            try {
                const theirBundle = await fetchKeyBundle(targetUser.uid, pubKey);
                if (theirBundle && e2eeStatus.privateKey) {
                    const myIdentityPriv = e2eeStatus.privateKey;
                    const x3dhResult = await initiateX3DH(myIdentityPriv, theirBundle);
                    const newState = await initRatchetAsInitiator(x3dhResult.sharedSecret, theirBundle.signedPreKey.publicKey);

                    if (!isMounted) return;
                    await updateRatchetState(newState, true);
                    pendingHandshakeRef.current = {
                        ephemeralPublicKey: x3dhResult.ephemeralPublicKey,
                        usedSignedPreKeyId: x3dhResult.usedSignedPreKeyId,
                        usedOneTimePreKeyId: x3dhResult.usedOneTimePreKeyId
                    };
                    setSessionReady(true);
                    return;
                }
            } catch (err) {
                console.warn('X3DH session negotiation failed, using symmetric session fallback:', err);
            }

            // 4. Fallback: if X3DH bundle is not available yet, establish a symmetric DH session so messages are NEVER blocked
            try {
                if (e2eeStatus.privateKey && pubKey) {
                    const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, pubKey);
                    const newState = await initRatchetAsInitiator(sharedSecret, pubKey);
                    if (isMounted) {
                        await updateRatchetState(newState, true);
                        setSessionReady(true);
                    }
                } else if (isMounted) {
                    setSessionReady(true);
                }
            } catch (fallbackErr) {
                console.error('Fallback session creation error:', fallbackErr);
                if (isMounted) setSessionReady(true);
            }
        })();

        return () => { isMounted = false; };
    }, [e2eeStatus?.privateKey, targetUser.uid]);

    // Android Hardware Physical Back Button Handler
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (activeMediaUrl) {
                setActiveMediaUrl(null);
                return true;
            }
            onBack();
            return true;
        });
        return unregister;
    }, [activeMediaUrl, onBack]);

    // Clean up audio streams and timers on unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try { mediaRecorderRef.current.stop(); } catch (e) {}
            }
            if (previewAudioRef.current) previewAudioRef.current.pause();
            if (chatAudioRef.current) chatAudioRef.current.pause();
        };
    }, []);

    // Auto Scroll to Latest Message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Helper to get timestamp in milliseconds
    const getTimestampMs = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts === 'number') return ts;
        if (typeof ts === 'string') {
            const parsed = new Date(ts).getTime();
            return isNaN(parsed) ? 0 : parsed;
        }
        if (ts.toDate && typeof ts.toDate === 'function') {
            try { return ts.toDate().getTime(); } catch { return 0; }
        }
        if (ts.seconds) return ts.seconds * 1000;
        return 0;
    };

    // Update Current User's Own Online Presence in Firestore
    useEffect(() => {
        if (!currentUid) return;
        const userRef = doc(db, 'users', currentUid);
        setDoc(userRef, {
            online: true,
            lastSeen: serverTimestamp()
        }, { merge: true }).catch(() => {});

        const handleOffline = () => {
            setDoc(userRef, {
                online: false,
                lastSeen: serverTimestamp()
            }, { merge: true }).catch(() => {});
        };

        window.addEventListener('beforeunload', handleOffline);
        return () => {
            window.removeEventListener('beforeunload', handleOffline);
            handleOffline();
        };
    }, [currentUid]);

    // Subscribe to Target User's REAL Presence Status from Firestore
    useEffect(() => {
        if (!targetUser.uid) return;
        const targetRef = doc(db, 'users', targetUser.uid);
        const unsubscribe = onSnapshot(targetRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setPresence({
                    isOnline: !!data.online,
                    lastSeen: data.lastSeen
                });
            } else {
                setPresence({ isOnline: false, lastSeen: null });
            }
        }, (err) => {
            console.warn("Presence snapshot error:", err);
        });

        return () => unsubscribe();
    }, [targetUser.uid]);

    // Ensure Parent 1v1 Chat Doc Exists in Firestore
    useEffect(() => {
        if (!currentUid || !chatId) return;
        const initDirectChatDoc = async () => {
            try {
                const chatRef = doc(db, 'directChats', chatId);
                const snap = await getDoc(chatRef);
                if (!snap.exists()) {
                    await setDoc(chatRef, {
                        participants: [currentUid, targetUser.uid],
                        updatedAt: serverTimestamp(),
                        lastMessage: ''
                    });
                }
            } catch (e) {}
        };
        initDirectChatDoc();
    }, [chatId, currentUid, targetUser.uid]);

    // Subscribe to 1v1 Chat Messages Real-time Listener & Auto Mark as Read (Blue Ticks)
    //
    // IMPORTANT: messages MUST be decrypted sequentially (oldest first), not
    // in parallel, because each ratchet decrypt call advances shared session
    // state - decrypting out of order or concurrently would desync the chain.
    useEffect(() => {
        let unsubscribe = () => {};
        let isMounted = true;
        if (!currentUid || !chatId) return () => { isMounted = false; };
        try {
            const q = query(collection(db, 'directChats', chatId, 'messages'), orderBy('timestamp', 'asc'));
            unsubscribe = onSnapshot(q, async (snapshot) => {
                const fetched: DirectMessage[] = [];

                for (const docSnap of snapshot.docs) {
                    const raw = { id: docSnap.id, ...docSnap.data() } as any;

                    // Incoming X3DH handshake header on this message (only present
                    // on the very first message of a new session, sent by whoever
                    // initiated). If we don't have a session yet, establish one
                    // as the RECIPIENT before attempting to decrypt.
                    if (raw.x3dhHandshake && raw.senderId !== currentUid) {
                        await ensureRecipientSessionFromHandshake(raw.x3dhHandshake, raw.senderId);
                    }

                    let processed: DirectMessage = raw;
                    const currentState = ratchetStateRef.current;
                    if (currentState && (raw.text?.startsWith('🔒E2EE:v2:') || raw.audioUrl?.startsWith('🔒E2EE:v2:') || raw.imageUrl?.startsWith('🔒E2EE:v2:') || raw.pollData)) {
                        try {
                            const result = await ratchetDecryptPayload(raw, currentState);
                            processed = result.payload;
                            await updateRatchetState(result.state, ratchetSessionMeta.current?.initiatedByMe ?? true);
                        } catch (e) {
                            console.error('Ratchet decrypt failed for message', docSnap.id, e);
                            processed = { ...raw, text: raw.text ? '[Encrypted message - Decryption failed]' : raw.text };
                        }
                    } else if (currentState === null && (raw.text?.startsWith('🔒E2EE:v2:'))) {
                        // Ratchet-encrypted message but we have no session yet
                        // (still negotiating, or peer hasn't published a bundle).
                        processed = { ...raw, text: '[Encrypted message - session establishing...]' };
                    }

                    fetched.push(processed);
                }

                if (!isMounted) return;

                // Merge with local fallback
                const localMsgs = getLocalDirectMessages(chatId);
                const map = new Map<string, DirectMessage>();
                [...fetched, ...localMsgs].forEach(m => map.set(m.id, m));

                // Sort chronologically like WhatsApp (oldest top, newest bottom)
                const sortedMsgs = Array.from(map.values()).sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));
                setMessages(sortedMsgs);

                // Auto Mark Unread Messages from Target User as READ (Blue Ticks)
                snapshot.docs.forEach(async (docSnap) => {
                    const data = docSnap.data();
                    if (data.senderId !== currentUid && data.status !== 'read') {
                        try {
                            await updateDoc(doc(db, 'directChats', chatId, 'messages', docSnap.id), {
                                status: 'read'
                            });
                        } catch (e) {}
                    }
                });
            }, (err) => {
                const fallback = getLocalDirectMessages(chatId).sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));
                setMessages(fallback);
            });
        } catch (e) {
            const fallback = getLocalDirectMessages(chatId).sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));
            setMessages(fallback);
        }

        return () => { isMounted = false; unsubscribe(); };
    }, [chatId, currentUid, sessionReady]);

    /**
     * Encrypts an outgoing message payload with the current ratchet session,
     * persists the advanced ratchet state, and attaches the X3DH handshake
     * header if this is our first message in a newly-initiated session
     * (so the recipient can derive the same shared secret and bootstrap
     * their side of the ratchet).
     */
    const encryptOutgoingPayload = async (payload: any): Promise<{ ok: true; payload: any } | { ok: false }> => {
        let currentState = ratchetStateRef.current;
        if (!currentState && e2eeStatus?.privateKey && targetPublicKey) {
            try {
                const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, targetPublicKey);
                currentState = await initRatchetAsInitiator(sharedSecret, targetPublicKey);
                await updateRatchetState(currentState, true);
            } catch (e) {
                console.warn('On-the-fly ratchet init fallback failed:', e);
            }
        }
        if (currentState) {
            try {
                const result = await ratchetEncryptPayload(payload, currentState);
                await updateRatchetState(result.state, ratchetSessionMeta.current?.initiatedByMe ?? true);

                let finalPayload = result.payload;
                if (pendingHandshakeRef.current) {
                    finalPayload = {
                        ...finalPayload,
                        x3dhHandshake: {
                            ephemeralPublicKey: pendingHandshakeRef.current.ephemeralPublicKey,
                            usedSignedPreKeyId: pendingHandshakeRef.current.usedSignedPreKeyId,
                            usedOneTimePreKeyId: pendingHandshakeRef.current.usedOneTimePreKeyId,
                            senderIdentityPublicKey: e2eeStatus?.publicKey || ''
                        }
                    };
                    pendingHandshakeRef.current = null; // only needed once
                }
                return { ok: true, payload: finalPayload };
            } catch (e) {
                console.error('Ratchet encryption error:', e);
            }
        }

        // Symmetric encryption fallback if ratchet session failed to build
        if (e2eeStatus?.privateKey && targetPublicKey) {
            try {
                const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, targetPublicKey);
                const encrypted = await encryptPayloadWithKey(payload, sharedSecret);
                return { ok: true, payload: encrypted };
            } catch (e) {
                console.error('Static symmetric payload encryption failed:', e);
            }
        }

        // Passthrough payload fallback (never block message sending)
        return { ok: true, payload };
    };

    // Local Storage Fallback Helpers
    const getLocalDirectMessages = (cid: string): DirectMessage[] => {
        try {
            const stored = localStorage.getItem('direct_msgs_' + cid);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    };

    const saveLocalDirectMessage = (msg: DirectMessage) => {
        try {
            const current = getLocalDirectMessages(chatId);
            localStorage.setItem('direct_msgs_' + chatId, JSON.stringify([...current, msg]));
        } catch {}
    };

    // Voice Recording Handlers
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setRecordedAudioUrl(url);
                setRecordedAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            if (window.navigator?.vibrate) {
                window.navigator.vibrate(40);
            }
        } catch (err) {
            console.error("Mic access error:", err);
            showToast('Microphone access permission chahiye voice note ke liye!');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordedDuration(recordingTime);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            if (window.navigator?.vibrate) {
                window.navigator.vibrate([30, 30]);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => {
                if (mediaRecorderRef.current?.stream) {
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
            };
            try { mediaRecorderRef.current.stop(); } catch (e) {}
        }
        setIsRecording(false);
        setRecordingTime(0);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (recordedAudioUrl) {
            URL.revokeObjectURL(recordedAudioUrl);
        }
        setRecordedAudioUrl(null);
        setRecordedAudioBlob(null);
        setIsPreviewPlaying(false);
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
        }
    };

    const togglePreviewPlay = () => {
        if (!recordedAudioUrl) return;
        if (!previewAudioRef.current) {
            const audio = new Audio(recordedAudioUrl);
            previewAudioRef.current = audio;
            audio.onended = () => setIsPreviewPlaying(false);
        }

        if (isPreviewPlaying) {
            previewAudioRef.current.pause();
            setIsPreviewPlaying(false);
        } else {
            previewAudioRef.current.play();
            setIsPreviewPlaying(true);
        }
    };

    const handleSendVoiceNote = async () => {
        if (!recordedAudioBlob) return;

        if (!ratchetStateRef.current) {
            showToast('Encryption ready nahi hai, thoda wait karo');
            return;
        }

        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            setIsPreviewPlaying(false);
        }

        const reader = new FileReader();
        reader.readAsDataURL(recordedAudioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            const initialStatus: 'sent' | 'delivered' = presence.isOnline ? 'delivered' : 'sent';

            let payload: any = {
                senderId: currentUid,
                senderName: currentName,
                audioUrl: base64Audio,
                audioDuration: recordedDuration || 1,
                status: initialStatus,
                timestamp: serverTimestamp()
            };

            const encResult = await encryptOutgoingPayload(payload);
            if (!encResult.ok) return;
            payload = encResult.payload;

            const newMsg: DirectMessage = {
                id: 'dmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                senderId: currentUid,
                senderName: currentName,
                audioUrl: base64Audio,
                audioDuration: recordedDuration || 1,
                status: initialStatus,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, newMsg]);
            saveLocalDirectMessage(newMsg);

            if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
            setRecordedAudioUrl(null);
            setRecordedAudioBlob(null);
            setRecordingTime(0);
            setRecordedDuration(0);

            showToast('Voice Note bhej diya! 🎙️');

            try {
                await addDoc(collection(db, 'directChats', chatId, 'messages'), payload);

                await setDoc(doc(db, 'directChats', chatId), {
                    participants: [currentUid, targetUser.uid],
                    lastMessage: '🎵 Voice Note (' + (newMsg.audioDuration || 1) + 's)',
                    lastMessageSenderId: currentUid,
                    lastMessageTimestamp: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } catch (e) {
                console.warn("Firestore voice note error:", e);
            }
        };
    };

    const toggleChatMessageAudio = (msgId: string, audioUrl: string) => {
        if (playingMessageId === msgId) {
            if (chatAudioRef.current) {
                chatAudioRef.current.pause();
            }
            setPlayingMessageId(null);
        } else {
            if (chatAudioRef.current) {
                chatAudioRef.current.pause();
            }
            const audio = new Audio(audioUrl);
            chatAudioRef.current = audio;
            audio.onended = () => setPlayingMessageId(null);
            audio.play();
            setPlayingMessageId(msgId);
        }
    };

    const formatTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Send Text / Image Message Handler
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && !imageUrl.trim()) return;

        if (!ratchetStateRef.current) {
            showToast('Encryption ready nahi hai, thoda wait karo');
            return;
        }

        const initialStatus: 'sent' | 'delivered' = presence.isOnline ? 'delivered' : 'sent';
        const textToSend = text.trim();
        const imageToSend = imageUrl.trim();

        let payload: any = {
            senderId: currentUid,
            senderName: currentName,
            text: textToSend || '',
            imageUrl: imageToSend || '',
            status: initialStatus,
            timestamp: serverTimestamp()
        };

        const encResult = await encryptOutgoingPayload(payload);
        if (!encResult.ok) return;
        payload = encResult.payload;

        const newMsg: DirectMessage = {
            id: 'dmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            senderId: currentUid,
            senderName: currentName,
            text: textToSend || undefined,
            imageUrl: imageToSend || undefined,
            status: initialStatus,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        saveLocalDirectMessage(newMsg);

        setText('');
        setImageUrl('');

        try {
            await addDoc(collection(db, 'directChats', chatId, 'messages'), payload);

            await setDoc(doc(db, 'directChats', chatId), {
                participants: [currentUid, targetUser.uid],
                lastMessage: textToSend ? (textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend) : '📷 Photo',
                lastMessageSenderId: currentUid,
                lastMessageTimestamp: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn("Firestore send message error:", e);
        }
    };

    const formatLastSeen = (lastSeen: any) => {
        if (!lastSeen) return 'Offline';
        const ms = getTimestampMs(lastSeen);
        if (!ms) return 'Offline';

        const diffMinutes = Math.floor((Date.now() - ms) / (1000 * 60));
        if (diffMinutes < 1) return 'Last seen just now';
        if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `Last seen ${diffHours}h ago`;
        return `Last seen ${new Date(ms).toLocaleDateString()}`;
    };

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col font-sans overflow-hidden"
        >
            {/* Header: Target User Profile & REAL Presence Status */}
            <div 
                className="bg-[#0c1222]/95 backdrop-blur-md border-b border-white/10 px-4 pb-3 flex items-center justify-between shadow-xl"
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
            >
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Target User Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-md">
                                {targetUser.photoURL ? (
                                    <img src={targetUser.photoURL} alt={targetUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    targetUser.name ? targetUser.name.charAt(0).toUpperCase() : 'U'
                                )}
                            </div>
                            {/* Real Online Green Dot Indicator */}
                            {presence.isOnline && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0c1222]" />
                            )}
                        </div>

                        {/* Name & Real Presence Status */}
                        <div>
                            <h2 className="font-bold text-sm text-white flex items-center gap-1.5">
                                {targetUser.name}
                            </h2>
                            <p className="text-[11px] font-semibold flex items-center gap-1">
                                {presence.isOnline ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>Online</span>
                                    </span>
                                ) : (
                                    <span className="text-white/40">
                                        {formatLastSeen(presence.lastSeen)}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Safety Number Modal trigger */}
                    <button 
                        onClick={() => {
                            if (!targetPublicKey) {
                                showToast('Target user public key missing');
                                return;
                            }
                            setShowSafetyModal(true);
                        }}
                        className={`p-2 rounded-xl transition relative ${
                            keyChangedAlert ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-emerald-400'
                        }`}
                        title="Verify Safety Number"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {keyChangedAlert && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
                        )}
                    </button>

                    {/* Linked devices modal trigger */}
                    <button 
                        onClick={() => setShowDeviceModal(true)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition"
                        title="Linked Devices"
                    >
                        <Laptop className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Key Changed Alert Banner */}
            {keyChangedAlert && (
                <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Safety number changed for {targetUser.name}. Contact ne naya device link kiya hai.</span>
                    </div>
                    <button 
                        onClick={() => setShowSafetyModal(true)}
                        className="font-bold underline ml-2 text-amber-300 hover:text-white"
                    >
                        Verify
                    </button>
                </div>
            )}

            {/* Private 1v1 Encryption Notice */}
            <div className="px-4 py-1.5 bg-indigo-950/40 border-b border-indigo-500/20 text-center">
                <span className="text-[10px] text-indigo-300/80 font-medium flex items-center justify-center gap-1">
                    <Shield className={`w-3 h-3 ${ratchetState ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span>
                        {ratchetState
                            ? 'Real E2EE (X25519 + XSalsa20-Poly1305) • Active'
                            : 'Establishing secure session...'}
                    </span>
                </span>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* E2EE Info Banner */}
                <div className="flex justify-center my-2">
                    <div className="max-w-xs px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300/90 text-center font-medium shadow-md flex items-center justify-center gap-1.5 leading-snug">
                        <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Messages and media are end-to-end encrypted with libsodium keys. Only you and {targetUser.name} can read them.</span>
                    </div>
                </div>

                {messages.length === 0 ? (
                    <div className="py-24 text-center text-white/40 space-y-2">
                        <User className="w-12 h-12 text-indigo-400/40 mx-auto" />
                        <h3 className="text-sm font-bold text-white">Start 1v1 Chat with {targetUser.name}</h3>
                        <p className="text-xs text-white/60">Say Hi! or share notes directly in private chat.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === currentUid;
                        return (
                            <div 
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                                <div 
                                    className={`max-w-[80%] rounded-2xl p-3 shadow-md relative group ${
                                        isMe 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none' 
                                            : 'bg-white/10 border border-white/10 text-white rounded-tl-none'
                                    }`}
                                >
                                    {/* Image Attachment */}
                                    {msg.imageUrl && (
                                        <div 
                                            onClick={() => setActiveMediaUrl(msg.imageUrl || null)}
                                            className="mb-2 rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:opacity-90 transition max-h-60"
                                        >
                                            <img src={msg.imageUrl} alt="Attached" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {/* Voice Note Player */}
                                    {msg.audioUrl && (
                                        <div className="flex items-center gap-3 py-1 px-2 bg-black/20 rounded-xl mb-1 min-w-[200px]">
                                            <button 
                                                onClick={() => toggleChatMessageAudio(msg.id, msg.audioUrl!)}
                                                className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition shadow-md shrink-0"
                                            >
                                                {playingMessageId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                            </button>
                                            <div className="flex-1">
                                                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                                    <div className={`h-full bg-emerald-400 ${playingMessageId === msg.id ? 'animate-pulse w-full' : 'w-0'}`} />
                                                </div>
                                                <span className="text-[10px] text-white/70 font-mono mt-1 block">
                                                    🎵 Voice Note ({msg.audioDuration || 1}s)
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Message Text */}
                                    {msg.text && (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-normal">
                                            {msg.text}
                                        </p>
                                    )}

                                    {/* Time & WhatsApp Blue Ticks Status */}
                                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70 font-medium">
                                        <span>
                                            {msg.timestamp ? new Date(getTimestampMs(msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </span>
                                        {isMe && (
                                            msg.status === 'read' ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-sky-300 font-bold" />
                                            ) : msg.status === 'delivered' ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5 text-white/50" />
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Voice Recording Active Bar */}
            {isRecording ? (
                <div className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                        <span>Recording... {formatTimer(recordingTime)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={cancelRecording}
                            className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition text-xs font-semibold flex items-center gap-1"
                        >
                            <Trash2 className="w-4 h-4" /> Cancel
                        </button>
                        <button 
                            onClick={stopRecording}
                            className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition text-xs font-semibold flex items-center gap-1 shadow-lg"
                        >
                            <Square className="w-4 h-4 fill-white" /> Stop & Review
                        </button>
                    </div>
                </div>
            ) : recordedAudioUrl ? (
                /* Voice Preview & Send Bar */
                <div className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={togglePreviewPlay}
                            className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition"
                        >
                            {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <span className="text-xs font-semibold text-emerald-400">
                            Preview ({recordedDuration}s)
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={cancelRecording}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition"
                        >
                            <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                        <button 
                            onClick={handleSendVoiceNote}
                            disabled={!ratchetState}
                            className="p-2.5 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Send className="w-3.5 h-3.5" /> Send Voice Note
                        </button>
                    </div>
                </div>
            ) : (
                /* Normal Chat Input Footer */
                <form 
                    onSubmit={handleSend}
                    className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center gap-2"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
                >
                    <input 
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Message ${targetUser.name}...`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition placeholder:text-white/30"
                    />

                    <button 
                        type="button"
                        onClick={startRecording}
                        disabled={!ratchetState}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title={ratchetState ? "Record Voice Note" : "Encryption ready nahi hai"}
                    >
                        <Mic className="w-5 h-5" />
                    </button>

                    <button 
                        type="submit"
                        disabled={(!text.trim() && !imageUrl.trim()) || !ratchetState}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            )}

            {/* Media Zoom Overlay Modal */}
            {activeMediaUrl && (
                <div 
                    onClick={() => setActiveMediaUrl(null)}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                >
                    <img src={activeMediaUrl} alt="Zoom" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* E2EE PIN Modal */}
            {showPinModal && (
                <PinSetupModal 
                    uid={currentUid}
                    mode={pinModalMode}
                    backupBlob={backupBlob}
                    onSuccess={(keys) => {
                        setShowPinModal(false);
                        setE2eeStatus({ initialized: true, publicKey: keys.publicKey, privateKey: keys.privateKey });
                    }}
                    onCancel={() => setShowPinModal(false)}
                />
            )}

            {/* Safety Number Modal */}
            {showSafetyModal && (
                <SafetyNumberModal 
                    contactUid={targetUser.uid}
                    contactName={targetUser.name}
                    myPublicKey={e2eeStatus?.publicKey || ''}
                    targetPublicKey={targetPublicKey || ''}
                    keyHasChanged={keyChangedAlert}
                    onClose={() => setShowSafetyModal(false)}
                    onVerified={() => setKeyChangedAlert(false)}
                />
            )}

            {/* Device Management Modal */}
            {showDeviceModal && (
                <DeviceManagementModal 
                    uid={currentUid}
                    onClose={() => setShowDeviceModal(false)}
                />
            )}
        </motion.div>
    );
}
