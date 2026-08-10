import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, X, 
    Camera, Phone, Video, Shield, Sparkles, User, Circle,
    Mic, MicOff, Square, Play, Pause, Trash2, Volume2, Lock, Key, ShieldCheck, Laptop, AlertTriangle,
    Ban, UserX, UserCheck, CheckCircle2, MoreVertical, Reply, CornerDownRight,
    Pin, PinOff, Edit3, ChevronRight, ChevronLeft
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, setDoc, getDoc, getDocs, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';
import { getApiUrl, authFetch } from '../utils/api';
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

export interface ReplyInfo {
    id: string;
    senderName: string;
    text: string;
}

export interface PinnedMessage {
    id: string;
    senderName: string;
    text: string;
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
    isSystemNotice?: boolean;
    systemType?: 'block' | 'unblock';
    replyTo?: ReplyInfo;
    isEdited?: boolean;
    pinned?: boolean;
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

    // Swipe to Reply & Auto-Scroll Highlight States
    const [replyToMessage, setReplyToMessage] = useState<DirectMessage | null>(null);
    const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

    // Long Press Context Menu, Edit & WhatsApp Multi-Pin States
    const [selectedContextMenuMsg, setSelectedContextMenuMsg] = useState<DirectMessage | null>(null);
    const [editingMsg, setEditingMsg] = useState<DirectMessage | null>(null);
    const [editingText, setEditingText] = useState<string>('');
    const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
    const [currentPinIndex, setCurrentPinIndex] = useState<number>(0);

    const msgPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMsgPressStart = (msg: DirectMessage) => {
        if (msg.isSystemNotice) return;
        msgPressTimerRef.current = setTimeout(() => {
            if (window.navigator?.vibrate) {
                window.navigator.vibrate(35);
            }
            setSelectedContextMenuMsg(msg);
        }, 450);
    };

    const handleMsgPressEnd = () => {
        if (msgPressTimerRef.current) {
            clearTimeout(msgPressTimerRef.current);
            msgPressTimerRef.current = null;
        }
    };

    const scrollToMessage = (targetMsgId: string) => {
        const el = document.getElementById(`msg-${targetMsgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMsgId(targetMsgId);
            setTimeout(() => {
                setHighlightedMsgId(null);
            }, 2100);
        } else {
            showToast('Original message view mein nahi hai');
        }
    };

    // E2EE States
    const [e2eeStatus, setE2eeStatus] = useState<UserE2EEStatus | null>(null);
    const [e2eeLoading, setE2eeLoading] = useState<boolean>(true);
    const [showPinModal, setShowPinModal] = useState<boolean>(false);
    const [pinModalMode, setPinModalMode] = useState<PinModalMode>('setup');
    const [backupBlob, setBackupBlob] = useState<EncryptedPrivateKeyBackupBlob | undefined>();
    const [hasBackup, setHasBackup] = useState<boolean | null>(null);

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

    useEffect(() => {
        if (!currentUid) return;
        const unsub = onSnapshot(doc(db, 'users', currentUid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setHasBackup(!!(data.encryptedPrivateKeyBackup || data.e2eeBackupEnabled));
            } else {
                setHasBackup(false);
            }
        });
        return () => unsub();
    }, [currentUid]);

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
        if (!e2eeStatus?.privateKey) return;
        const haveOwnSession = !!ratchetStateRef.current;
        const weInitiatedOurs = ratchetSessionMeta.current?.initiatedByMe === true;

        // If we already adopted a recipient session from a processed handshake, skip.
        // But if we only have an un-sent/un-matched self-initiated session, adopt sender's handshake
        // so we can decrypt their incoming message and sync the Double Ratchet.
        if (haveOwnSession && !weInitiatedOurs && handshakeProcessedRef.current) {
            return;
        }

        handshakeProcessedRef.current = true;

        try {
            const spk = await getLocalSignedPreKey(currentUid, handshake.usedSignedPreKeyId);
            let sharedSecret: Uint8Array | null = null;
            let recipientPub = handshake.senderIdentityPublicKey;
            let recipientPriv = e2eeStatus.privateKey;

            if (spk) {
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
                sharedSecret = x3dhResult.sharedSecret;
                recipientPub = spk.publicKey;
                recipientPriv = spk.privateKey;
            } else if (handshake.senderIdentityPublicKey) {
                // Fallback symmetric key derivation if local signed prekey was lost/rotated
                sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, handshake.senderIdentityPublicKey);
            }

            if (sharedSecret) {
                const newState = await initRatchetAsRecipient(sharedSecret, recipientPub, recipientPriv);
                await updateRatchetState(newState, false);
                pendingHandshakeRef.current = null;

                if (handshake.usedOneTimePreKeyId) {
                    await consumeLocalOneTimePreKey(currentUid, handshake.usedOneTimePreKeyId);
                }
                setSessionReady(true);
            } else {
                handshakeProcessedRef.current = false;
            }
        } catch (err) {
            // Symmetric fallback on error
            try {
                if (handshake.senderIdentityPublicKey && e2eeStatus?.privateKey) {
                    const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, handshake.senderIdentityPublicKey);
                    const newState = await initRatchetAsRecipient(sharedSecret, handshake.senderIdentityPublicKey, e2eeStatus.privateKey);
                    await updateRatchetState(newState, false);
                    pendingHandshakeRef.current = null;
                    setSessionReady(true);
                }
            } catch (fallbackErr) {
                handshakeProcessedRef.current = false;
            }
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

    // Update Current User's Own Online Presence in Firestore (Heartbeat + Visibility)
    useEffect(() => {
        if (!currentUid) return;
        const userRef = doc(db, 'users', currentUid);

        const setOnline = () => {
            setDoc(userRef, {
                online: true,
                lastSeen: serverTimestamp()
            }, { merge: true }).catch(() => {});
        };

        const setOffline = () => {
            setDoc(userRef, {
                online: false,
                lastSeen: serverTimestamp()
            }, { merge: true }).catch(() => {});
        };

        setOnline();

        // Heartbeat every 15s to keep presence fresh
        const heartbeatInterval = setInterval(setOnline, 15000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setOnline();
            } else {
                setOffline();
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', setOffline);

        return () => {
            clearInterval(heartbeatInterval);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', setOffline);
            setOffline();
        };
    }, [currentUid]);

    // Mark Parent Chat Read By Current User (Clears Unread Green Dot)
    useEffect(() => {
        if (!chatId || !currentUid) return;
        const chatRef = doc(db, 'directChats', chatId);
        updateDoc(chatRef, {
            readBy: arrayUnion(currentUid)
        }).catch(() => {});
    }, [chatId, currentUid, messages.length]);

    // Blocked User State & Header Profile Modal State
    const [isTargetBlocked, setIsTargetBlocked] = useState<boolean>(false);
    const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);

    // Subscribe to Target User's REAL Presence Status from Firestore
    useEffect(() => {
        if (!targetUser.uid) return;
        const targetRef = doc(db, 'users', targetUser.uid);
        const unsubscribe = onSnapshot(targetRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const lastSeenMs = getTimestampMs(data.lastSeen);
                const isFresh = lastSeenMs > 0 && (Date.now() - lastSeenMs < 45000);
                setPresence({
                    isOnline: !!(data.online && isFresh),
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

    // Subscribe to Blocked Status for Target User from Firestore
    useEffect(() => {
        if (!currentUid || !targetUser.uid) return;
        const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUser.uid);
        const unsubscribe = onSnapshot(blockRef, (snapshot) => {
            setIsTargetBlocked(snapshot.exists());
        }, (err) => {
            console.warn("Blocked check snapshot error:", err);
        });
        return () => unsubscribe();
    }, [currentUid, targetUser.uid]);

    const handleBlockUser = async () => {
        if (!currentUid || !targetUser.uid) return;
        if (!window.confirm(`Kya aap ${targetUser.name} ko block karna chahte hain? Unke messages aap tak nahi aayenge.`)) {
            return;
        }

        try {
            const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUser.uid);
            await setDoc(blockRef, {
                blockedAt: serverTimestamp(),
                targetName: targetUser.name
            });

            // Insert system notice into local messages feed
            const sysMsg: DirectMessage = {
                id: `sys_block_${Date.now()}`,
                senderId: 'system',
                senderName: 'System',
                text: 'You blocked this contact',
                status: 'read',
                timestamp: new Date().toISOString(),
                isSystemNotice: true,
                systemType: 'block'
            };

            setMessages(prev => [...prev, sysMsg]);
            saveLocalDirectMessage(sysMsg);

            showToast(`${targetUser.name} ko block kar diya gaya! 🚫`);
            setShowUserProfileModal(false);
        } catch (e) {
            console.error("Block user error:", e);
            showToast("Failed to block user. Try again.");
        }
    };

    const handleUnblockUser = async () => {
        if (!currentUid || !targetUser.uid) return;

        try {
            const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUser.uid);
            await deleteDoc(blockRef);

            // Insert system notice into local messages feed
            const sysMsg: DirectMessage = {
                id: `sys_unblock_${Date.now()}`,
                senderId: 'system',
                senderName: 'System',
                text: 'You unblocked this contact',
                status: 'read',
                timestamp: new Date().toISOString(),
                isSystemNotice: true,
                systemType: 'unblock'
            };

            setMessages(prev => [...prev, sysMsg]);
            saveLocalDirectMessage(sysMsg);

            showToast(`${targetUser.name} unblock ho gaye! ✅`);
            setShowUserProfileModal(false);
        } catch (e) {
            console.error("Unblock user error:", e);
            showToast("Failed to unblock user. Try again.");
        }
    };

    // Realtime Listener for Pinned Messages from Parent Chat Doc
    useEffect(() => {
        if (!chatId) return;
        const chatRef = doc(db, 'directChats', chatId);
        const unsubscribe = onSnapshot(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setPinnedMessages(data.pinnedMessages || []);
            }
        });
        return () => unsubscribe();
    }, [chatId]);

    // Delete Message for Everyone (Both Sides)
    const handleDeleteMessage = async (msg: DirectMessage) => {
        if (!currentUid || !chatId) return;
        try {
            await deleteDoc(doc(db, 'directChats', chatId, 'messages', msg.id));
            setMessages(prev => prev.filter(m => m.id !== msg.id));

            const chatRef = doc(db, 'directChats', chatId);
            await updateDoc(chatRef, {
                pinnedMessages: arrayRemove({
                    id: msg.id,
                    senderName: msg.senderName,
                    text: msg.text || '📷 Attachment'
                })
            }).catch(() => {});

            showToast('Message deleted for everyone 🗑️');
            setSelectedContextMenuMsg(null);
        } catch (e) {
            console.error("Delete msg error:", e);
            showToast('Failed to delete message');
        }
    };

    // Pin or Unpin Message (WhatsApp Multi-Pin)
    const handleTogglePinMessage = async (msg: DirectMessage) => {
        if (!chatId) return;
        const isAlreadyPinned = pinnedMessages.some(p => p.id === msg.id);
        const chatRef = doc(db, 'directChats', chatId);

        const pinItem: PinnedMessage = {
            id: msg.id,
            senderName: msg.senderName,
            text: msg.text || (msg.imageUrl ? '📷 Photo' : msg.audioUrl ? '🎵 Voice Note' : 'Message')
        };

        try {
            if (isAlreadyPinned) {
                await updateDoc(chatRef, {
                    pinnedMessages: arrayRemove(pinItem)
                });
                showToast('Message unpinned 📌');
            } else {
                await updateDoc(chatRef, {
                    pinnedMessages: arrayUnion(pinItem)
                });
                showToast('Message pinned 📌');
            }
            setSelectedContextMenuMsg(null);
        } catch (e) {
            console.error("Pin toggle error:", e);
            showToast('Failed to pin/unpin message');
        }
    };

    // Save Edited Message (Within 5-minute window)
    const handleSaveEditedMessage = async () => {
        if (!editingMsg || !editingText.trim() || !chatId) return;

        const ms = getTimestampMs(editingMsg.timestamp);
        const diffMins = (Date.now() - ms) / (1000 * 60);

        if (diffMins > 5) {
            showToast('Messages can only be edited within 5 minutes ⏱️');
            setEditingMsg(null);
            setSelectedContextMenuMsg(null);
            return;
        }

        const updatedText = editingText.trim();

        let payload: any = {
            senderId: currentUid,
            senderName: currentName,
            text: updatedText,
            isEdited: true,
            status: editingMsg.status,
            timestamp: serverTimestamp()
        };

        const encResult = await encryptOutgoingPayload(payload);
        if (encResult.ok) payload = encResult.payload;

        try {
            await updateDoc(doc(db, 'directChats', chatId, 'messages', editingMsg.id), {
                ...payload,
                isEdited: true
            });

            setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, text: updatedText, isEdited: true } : m));
            saveLocalDirectMessage({ ...editingMsg, text: updatedText, isEdited: true });

            showToast('Message edited ✏️');
            setEditingMsg(null);
            setSelectedContextMenuMsg(null);
        } catch (e) {
            console.error("Edit msg error:", e);
            showToast('Failed to edit message');
        }
    };

    // Delete All Messages/Chats for Both Sides
    const handleDeleteAllChatsBothSides = async () => {
        if (!chatId) return;
        const confirmDelete = window.confirm(`Kya aap ${targetUser.name} ke saath sabhi messages dono taraf se delete karna chahte hain?`);
        if (!confirmDelete) return;

        try {
            const messagesRef = collection(db, 'directChats', chatId, 'messages');
            const snap = await getDocs(messagesRef);

            const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            // Clear parent chat doc fields & pinned messages
            const chatRef = doc(db, 'directChats', chatId);
            await updateDoc(chatRef, {
                lastMessage: '',
                pinnedMessages: []
            }).catch(() => {});

            setMessages([]);
            setPinnedMessages([]);
            showToast('All chats deleted for both sides 🗑️');
            setShowUserProfileModal(false);
        } catch (e) {
            console.error("Delete all chats error:", e);
            showToast("Failed to delete all chats");
        }
    };

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
            const q = collection(db, 'directChats', chatId, 'messages');
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
                    let decryptedSuccess = false;
                    const currentState = ratchetStateRef.current;

                    // 1. Try Ratchet Decryption if active session & v2 format
                    if (currentState && (raw.text?.startsWith('🔒E2EE:v2:') || raw.audioUrl?.startsWith('🔒E2EE:v2:') || raw.imageUrl?.startsWith('🔒E2EE:v2:') || raw.pollData)) {
                        try {
                            const result = await ratchetDecryptPayload(raw, currentState);
                            processed = result.payload;
                            await updateRatchetState(result.state, ratchetSessionMeta.current?.initiatedByMe ?? true);
                            decryptedSuccess = true;
                        } catch (e) {
                            // Ratchet state desynced - fallback to symmetric ECDH below silently
                        }
                    }

                    // 2. Symmetric ECDH Fallback if Ratchet was bypassed/failed or format is v1
                    if (!decryptedSuccess && e2eeStatus?.privateKey) {
                        try {
                            const senderPub = raw.senderId === currentUid 
                                ? targetPublicKey 
                                : (await fetchUserPublicKey(raw.senderId) || targetPublicKey);
                            
                            if (senderPub) {
                                const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, senderPub);
                                
                                // Decrypt main payload fields
                                const symDecrypted = await decryptPayloadWithKey(raw, sharedSecret);
                                if (symDecrypted.text && !symDecrypted.text.startsWith('🔒E2EE:')) {
                                    processed = symDecrypted;
                                    decryptedSuccess = true;
                                }

                                // Check fallback payload text/media if present
                                if (!decryptedSuccess) {
                                    if (raw.fallbackText) {
                                        const fallbackDec = await decryptPayloadWithKey({ text: raw.fallbackText }, sharedSecret);
                                        if (fallbackDec.text && !fallbackDec.text.startsWith('🔒E2EE:')) {
                                            processed = { ...processed, text: fallbackDec.text };
                                            decryptedSuccess = true;
                                        }
                                    }
                                    if (raw.fallbackAudioUrl) {
                                        const fallbackDec = await decryptPayloadWithKey({ audioUrl: raw.fallbackAudioUrl }, sharedSecret);
                                        if (fallbackDec.audioUrl && !fallbackDec.audioUrl.startsWith('🔒E2EE:')) {
                                            processed = { ...processed, audioUrl: fallbackDec.audioUrl };
                                            decryptedSuccess = true;
                                        }
                                    }
                                    if (raw.fallbackImageUrl) {
                                        const fallbackDec = await decryptPayloadWithKey({ imageUrl: raw.fallbackImageUrl }, sharedSecret);
                                        if (fallbackDec.imageUrl && !fallbackDec.imageUrl.startsWith('🔒E2EE:')) {
                                            processed = { ...processed, imageUrl: fallbackDec.imageUrl };
                                            decryptedSuccess = true;
                                        }
                                    }
                                }
                            }
                        } catch (symErr) {
                            console.warn('Symmetric decrypt fallback error:', symErr);
                        }
                    }

                    // 3. Plaintext fallback if text is not encrypted format
                    if (!decryptedSuccess && raw.text && !raw.text.startsWith('🔒E2EE:')) {
                        processed = raw;
                        decryptedSuccess = true;
                    }

                    fetched.push(processed);
                }

                if (!isMounted) return;

                // Merge with local fallback using smart ID & content window deduplication
                const localMsgs = getLocalDirectMessages(chatId);
                const map = new Map<string, DirectMessage>();

                // 1. Add server-fetched messages (source of truth)
                fetched.forEach(m => map.set(m.id, m));

                // 2. Track existing content keys to prevent duplicate local optimistic entries
                const serverContentKeys = new Set(
                    fetched.map(f => `${f.senderId}_${f.text || f.imageUrl || f.audioUrl || ''}_${Math.floor(getTimestampMs(f.timestamp) / 10000)}`)
                );

                // 3. Add local messages only if unique ID and unique content key
                localMsgs.forEach(m => {
                    if (!map.has(m.id)) {
                        const key = `${m.senderId}_${m.text || m.imageUrl || m.audioUrl || ''}_${Math.floor(getTimestampMs(m.timestamp) / 10000)}`;
                        if (!serverContentKeys.has(key)) {
                            map.set(m.id, m);
                        }
                    }
                });

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
     * header if this is our first message in a newly-initiated session.
     * Also attaches a symmetric ECDH fallback payload so recipient decrypts 100% reliably.
     */
    const encryptOutgoingPayload = async (payload: any): Promise<{ ok: true; payload: any } | { ok: false }> => {
        let currentState = ratchetStateRef.current;
        let finalPayload = { ...payload };

        // Create fallback symmetric encrypted text/media using ECDH
        if (e2eeStatus?.privateKey && targetPublicKey) {
            try {
                const sharedSecret = await deriveSharedSecret(e2eeStatus.privateKey, targetPublicKey);
                const symPayload = await encryptPayloadWithKey(payload, sharedSecret);
                if (symPayload.text) {
                    finalPayload.fallbackText = symPayload.text;
                }
                if (symPayload.audioUrl) {
                    finalPayload.fallbackAudioUrl = symPayload.audioUrl;
                }
                if (symPayload.imageUrl) {
                    finalPayload.fallbackImageUrl = symPayload.imageUrl;
                }
            } catch (e) {}
        }

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
                const result = await ratchetEncryptPayload(finalPayload, currentState);
                await updateRatchetState(result.state, ratchetSessionMeta.current?.initiatedByMe ?? true);

                finalPayload = result.payload;
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

            const replyInfoData = replyToMessage ? {
                id: replyToMessage.id,
                senderName: replyToMessage.senderName,
                text: replyToMessage.text || (replyToMessage.imageUrl ? '📷 Photo' : replyToMessage.audioUrl ? '🎵 Voice Note' : 'Message')
            } : undefined;

            let payload: any = {
                senderId: currentUid,
                senderName: currentName,
                audioUrl: base64Audio,
                audioDuration: recordedDuration || 1,
                status: initialStatus,
                timestamp: serverTimestamp(),
                ...(replyInfoData ? { replyTo: replyInfoData } : {})
            };

            const encResult = await encryptOutgoingPayload(payload);
            if (!encResult.ok) return;
            payload = encResult.payload;

            const newMsgRef = doc(collection(db, 'directChats', chatId, 'messages'));
            const msgId = newMsgRef.id;

            const newMsg: DirectMessage = {
                id: msgId,
                senderId: currentUid,
                senderName: currentName,
                audioUrl: base64Audio,
                audioDuration: recordedDuration || 1,
                status: initialStatus,
                timestamp: new Date().toISOString(),
                replyTo: replyInfoData
            };

            setMessages(prev => {
                if (prev.some(m => m.id === msgId)) return prev;
                return [...prev, newMsg];
            });
            saveLocalDirectMessage(newMsg);

            if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
            setRecordedAudioUrl(null);
            setRecordedAudioBlob(null);
            setRecordingTime(0);
            setRecordedDuration(0);
            setReplyToMessage(null);

            showToast('Voice Note bhej diya! 🎙️');

            try {
                await setDoc(newMsgRef, payload);

                await setDoc(doc(db, 'directChats', chatId), {
                    participants: [currentUid, targetUser.uid],
                    lastMessage: '🎵 Voice Note (' + (newMsg.audioDuration || 1) + 's)',
                    lastMessageSenderId: currentUid,
                    lastMessageTimestamp: serverTimestamp(),
                    readBy: [currentUid],
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

        const replyInfoData = replyToMessage ? {
            id: replyToMessage.id,
            senderName: replyToMessage.senderName,
            text: replyToMessage.text || (replyToMessage.imageUrl ? '📷 Photo' : replyToMessage.audioUrl ? '🎵 Voice Note' : 'Message')
        } : undefined;

        let payload: any = {
            senderId: currentUid,
            senderName: currentName,
            senderPublicKey: e2eeStatus?.publicKey || '',
            text: textToSend || '',
            imageUrl: imageToSend || '',
            status: initialStatus,
            timestamp: serverTimestamp(),
            ...(replyInfoData ? { replyTo: replyInfoData } : {})
        };

        const encResult = await encryptOutgoingPayload(payload);
        if (!encResult.ok) return;
        payload = encResult.payload;

        const newMsgRef = doc(collection(db, 'directChats', chatId, 'messages'));
        const msgId = newMsgRef.id;

        const newMsg: DirectMessage = {
            id: msgId,
            senderId: currentUid,
            senderName: currentName,
            text: textToSend || undefined,
            imageUrl: imageToSend || undefined,
            status: initialStatus,
            timestamp: new Date().toISOString(),
            replyTo: replyInfoData
        };

        setMessages(prev => {
            if (prev.some(m => m.id === msgId)) return prev;
            return [...prev, newMsg];
        });
        saveLocalDirectMessage(newMsg);

        setText('');
        setImageUrl('');
        setReplyToMessage(null);

        try {
            await setDoc(newMsgRef, payload);

            await setDoc(doc(db, 'directChats', chatId), {
                participants: [currentUid, targetUser.uid],
                lastMessage: textToSend ? (textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend) : '📷 Photo',
                lastMessageSenderId: currentUid,
                lastMessageTimestamp: serverTimestamp(),
                readBy: [currentUid],
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Trigger FCM Background Push Notification (works when recipient phone is locked / app is killed)
            authFetch(getApiUrl('/api/send-chat-notification'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientUid: targetUser.uid,
                    senderName: currentName || 'User',
                    messageText: textToSend || (imageToSend ? '📷 Photo' : 'Message')
                })
            }).catch(err => console.warn('Failed to dispatch FCM push notification:', err));
        } catch (e) {
            console.warn("Firestore send message error:", e);
        }
    };

    const formatLastSeen = (lastSeen: any) => {
        if (!lastSeen) return 'offline';
        const ms = getTimestampMs(lastSeen);
        if (!ms) return 'offline';

        const now = new Date();
        const last = new Date(ms);
        const diffMs = Date.now() - ms;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) return 'last seen just now';
        if (diffMinutes < 60) return `last seen ${diffMinutes} min ago`;

        const timeStr = last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        const isToday = last.toDateString() === now.toDateString();
        if (isToday) return `last seen today at ${timeStr}`;

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = last.toDateString() === yesterday.toDateString();
        if (isYesterday) return `last seen yesterday at ${timeStr}`;

        const dateStr = last.toLocaleDateString([], { day: 'numeric', month: 'short' });
        return `last seen ${dateStr} at ${timeStr}`;
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

                    <div 
                        onClick={() => setShowUserProfileModal(true)}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition group"
                        title="Click to view user profile & options"
                    >
                        {/* Target User Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-md group-hover:border-indigo-400 transition">
                                {targetUser.photoURL ? (
                                    <img src={targetUser.photoURL} alt={targetUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    targetUser.name ? targetUser.name.charAt(0).toUpperCase() : 'U'
                                )}
                            </div>
                            {/* Real Online Green Dot Indicator */}
                            {presence.isOnline && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#0c1222]" />
                            )}
                        </div>

                        {/* Name & Real Presence Status */}
                        <div>
                            <h2 className="font-bold text-sm text-white flex items-center gap-1.5 group-hover:text-indigo-300 transition">
                                {targetUser.name}
                            </h2>
                            <p className="text-[11px] font-semibold flex items-center gap-1">
                                {presence.isOnline ? (
                                    <span className="text-[#25D366] font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                                        <span>online</span>
                                    </span>
                                ) : (
                                    <span className="text-white/60">
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

            {/* Highlighted E2EE Restore Banner (When modal closed with X without entering PIN) */}
            {!showPinModal && !e2eeStatus?.initialized && e2eeStatus?.isNewDevice && (
                <div 
                    onClick={() => {
                        setPinModalMode('restore');
                        if (e2eeStatus.backupBlob) setBackupBlob(e2eeStatus.backupBlob);
                        setShowPinModal(true);
                    }}
                    className="bg-gradient-to-r from-amber-950/90 via-yellow-900/70 to-amber-950/90 border-b border-amber-500/50 px-4 py-2.5 flex items-center justify-between shadow-[0_4px_20px_rgba(245,158,11,0.25)] backdrop-blur-md cursor-pointer hover:bg-amber-900/60 transition group animate-pulse"
                    style={{ animationDuration: '3s' }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 group-hover:scale-105 transition-transform shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.35)]">
                            <Key className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-black text-amber-200 tracking-wide uppercase">Backup & History Locked</p>
                                <span className="text-[9px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black uppercase shadow-sm">Action Needed</span>
                            </div>
                            <p className="text-[11px] text-amber-300/90 truncate font-medium mt-0.5">Click to enter PIN & restore encrypted chat history</p>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setPinModalMode('restore');
                            if (e2eeStatus.backupBlob) setBackupBlob(e2eeStatus.backupBlob);
                            setShowPinModal(true);
                        }}
                        className="ml-3 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black text-xs font-black rounded-xl shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all active:scale-95 shrink-0 flex items-center gap-1"
                    >
                        Restore Backup
                    </button>
                </div>
            )}

            {/* Highlighted E2EE Setup PIN Banner (For new users who haven't set up a PIN backup) */}
            {!showPinModal && e2eeStatus?.initialized && hasBackup === false && (
                <div 
                    onClick={() => {
                        setPinModalMode('setup');
                        setShowPinModal(true);
                    }}
                    className="bg-gradient-to-r from-indigo-950/90 via-blue-900/70 to-indigo-950/90 border-b border-indigo-500/50 px-4 py-2.5 flex items-center justify-between shadow-[0_4px_20px_rgba(99,102,241,0.25)] backdrop-blur-md cursor-pointer hover:bg-indigo-900/60 transition group"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-indigo-400/20 text-indigo-300 border border-indigo-400/40 group-hover:scale-105 transition-transform shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.35)]">
                            <ShieldCheck className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-black text-indigo-200 tracking-wide uppercase">Set Up PIN For Chat Backup</p>
                                <span className="text-[9px] bg-indigo-400 text-black px-1.5 py-0.5 rounded font-black uppercase shadow-sm">Recommended</span>
                            </div>
                            <p className="text-[11px] text-indigo-300/90 truncate font-medium mt-0.5">Backup chats so you can restore history on any device</p>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setPinModalMode('setup');
                            setShowPinModal(true);
                        }}
                        className="ml-3 px-3.5 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white text-xs font-black rounded-xl shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-all active:scale-95 shrink-0 flex items-center gap-1"
                    >
                        Set Up PIN
                    </button>
                </div>
            )}

            {/* WhatsApp Pinned Messages Bar under Header */}
            {pinnedMessages.length > 0 && (
                <div className="bg-[#0f172a]/95 backdrop-blur-md border-b border-indigo-500/30 px-4 py-2 flex items-center justify-between shadow-md text-xs">
                    <div 
                        onClick={() => {
                            const currentPin = pinnedMessages[currentPinIndex % pinnedMessages.length];
                            if (currentPin) scrollToMessage(currentPin.id);
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-90 transition"
                    >
                        <Pin className="w-4 h-4 text-emerald-400 shrink-0 rotate-45" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                                <span>Pinned message {pinnedMessages.length > 1 ? `${(currentPinIndex % pinnedMessages.length) + 1} of ${pinnedMessages.length}` : ''}</span>
                            </div>
                            <p className="text-white/90 text-xs truncate font-medium">
                                {pinnedMessages[currentPinIndex % pinnedMessages.length]?.senderName}: {pinnedMessages[currentPinIndex % pinnedMessages.length]?.text}
                            </p>
                        </div>
                    </div>

                    {pinnedMessages.length > 1 && (
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button 
                                onClick={() => setCurrentPinIndex(prev => (prev > 0 ? prev - 1 : pinnedMessages.length - 1))}
                                className="p-1 rounded-full hover:bg-white/10 text-white/70 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setCurrentPinIndex(prev => (prev + 1) % pinnedMessages.length)}
                                className="p-1 rounded-full hover:bg-white/10 text-white/70 transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

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
                        if (msg.isSystemNotice) {
                            return (
                                <div key={msg.id} className="flex justify-center my-3">
                                    <div className={`max-w-xs px-3.5 py-1.5 rounded-full text-xs font-semibold text-center shadow-md flex items-center justify-center gap-1.5 ${
                                        msg.systemType === 'block' 
                                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' 
                                            : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                    }`}>
                                        {msg.systemType === 'block' ? (
                                            <Ban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        ) : (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        )}
                                        <span>{msg.text}</span>
                                    </div>
                                </div>
                            );
                        }
                        const isMe = msg.senderId === currentUid;
                        return (
                            <motion.div 
                                key={msg.id}
                                id={`msg-${msg.id}`}
                                drag="x"
                                dragConstraints={isMe ? { left: -80, right: 0 } : { left: 0, right: 80 }}
                                dragElastic={0.15}
                                dragSnapToOrigin={true}
                                onDragEnd={(e, info) => {
                                    if (!isMe && info.offset.x > 45) {
                                        setReplyToMessage(msg);
                                    } else if (isMe && info.offset.x < -45) {
                                        setReplyToMessage(msg);
                                    }
                                }}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative transition-all duration-300 ${
                                    highlightedMsgId === msg.id ? 'scale-[1.03] z-20' : ''
                                }`}
                            >
                                <div 
                                    onTouchStart={() => handleMsgPressStart(msg)}
                                    onTouchEnd={handleMsgPressEnd}
                                    onMouseDown={() => handleMsgPressStart(msg)}
                                    onMouseUp={handleMsgPressEnd}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setSelectedContextMenuMsg(msg);
                                    }}
                                    className={`max-w-[80%] rounded-2xl p-3 shadow-md relative group transition-all duration-300 select-none cursor-pointer ${
                                        highlightedMsgId === msg.id ? 'ring-4 ring-emerald-400 bg-emerald-500/25 shadow-2xl shadow-emerald-500/50 animate-pulse' : ''
                                    } ${
                                        isMe 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none' 
                                            : 'bg-white/10 border border-white/10 text-white rounded-tl-none'
                                    }`}
                                >
                                    {/* Quoted Reply Box (WhatsApp Style) */}
                                    {msg.replyTo && (
                                        <div 
                                            onClick={() => scrollToMessage(msg.replyTo!.id)}
                                            className="mb-2 p-2 rounded-xl bg-black/30 border-l-4 border-emerald-400 text-xs cursor-pointer hover:bg-black/40 transition select-none"
                                        >
                                            <p className="font-bold text-emerald-300 text-[11px] truncate">
                                                {msg.replyTo.senderName}
                                            </p>
                                            <p className="text-white/80 text-[11px] truncate mt-0.5 font-normal">
                                                {msg.replyTo.text || '📷 Attachment / Media'}
                                            </p>
                                        </div>
                                    )}

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
                                            {msg.text.startsWith('🔒E2EE:') || msg.text === '[Encrypted message - Decryption failed]' ? (
                                                <span className="italic text-xs text-amber-200/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-flex items-center gap-1">
                                                    <Lock className="w-3 h-3 text-amber-400" />
                                                    <span>Prior Session Encrypted Message</span>
                                                </span>
                                            ) : (
                                                msg.text
                                            )}
                                        </p>
                                    )}

                                    {/* Time & WhatsApp Blue Ticks Status & Edited Label */}
                                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70 font-medium">
                                        {msg.isEdited && (
                                            <span className="text-[9px] italic text-indigo-200 font-medium mr-0.5">edited</span>
                                        )}
                                        <span>
                                            {msg.timestamp ? new Date(getTimestampMs(msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </span>
                                        {isMe && (
                                            msg.status === 'read' ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1] stroke-[2.5]" />
                                            ) : msg.status === 'delivered' ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5 text-white/50" />
                                            )
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp Reply Preview Bar above Footer */}
            <AnimatePresence>
                {replyToMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="px-3 py-2 bg-[#0c1222]/95 border-t border-white/10 flex items-center justify-between gap-3 text-xs"
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 border-l-4 border-emerald-400 pl-2 py-0.5">
                            <Reply className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-emerald-400 text-[11px] truncate">
                                    Replying to {replyToMessage.senderId === currentUid ? 'Yourself' : replyToMessage.senderName}
                                </p>
                                <p className="text-white/70 text-[11px] truncate font-normal">
                                    {replyToMessage.text || (replyToMessage.imageUrl ? '📷 Photo' : replyToMessage.audioUrl ? '🎵 Voice Note' : 'Message')}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setReplyToMessage(null)}
                            className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer Input Bar / WhatsApp Blocked Bar */}
            {isTargetBlocked ? (
                <div 
                    className="p-3.5 bg-[#0c1222] border-t border-white/10 flex items-center justify-between gap-3 text-xs"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
                >
                    <div className="flex items-center gap-2 text-amber-200/90 font-medium">
                        <Ban className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>You blocked this contact. Tap to unblock.</span>
                    </div>

                    <button 
                        onClick={handleUnblockUser}
                        className="py-1.5 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-bold text-xs transition shadow-md shrink-0 flex items-center gap-1"
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Unblock</span>
                    </button>
                </div>
            ) : isRecording ? (
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

            {/* Target User Profile & Actions Modal (Header Click) */}
            <AnimatePresence>
                {showUserProfileModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowUserProfileModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-[#0c1222] border border-white/15 rounded-3xl p-6 shadow-2xl text-center space-y-4 relative"
                        >
                            <button
                                onClick={() => setShowUserProfileModal(false)}
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* Avatar */}
                            <div className="relative inline-block mx-auto">
                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500/50 bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto">
                                    {targetUser.photoURL ? (
                                        <img src={targetUser.photoURL} alt={targetUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        targetUser.name ? targetUser.name.charAt(0).toUpperCase() : 'U'
                                    )}
                                </div>
                                {presence.isOnline && (
                                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#25D366] border-2 border-[#0c1222]" />
                                )}
                            </div>

                            {/* Name & Badge */}
                            <div>
                                <h3 className="font-bold text-lg text-white">{targetUser.name}</h3>
                                <p className="text-xs text-indigo-300 font-semibold mt-0.5">
                                    {targetUser.badge || 'NEET Aspirant 🌟'}
                                </p>
                                <p className="text-xs text-white/60 mt-1 flex items-center justify-center gap-1">
                                    {presence.isOnline ? (
                                        <span className="text-[#25D366] font-bold flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                                            <span>online</span>
                                        </span>
                                    ) : (
                                        <span>{formatLastSeen(presence.lastSeen)}</span>
                                    )}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 border-t border-white/10 space-y-2">
                                {isTargetBlocked ? (
                                    <button
                                        onClick={handleUnblockUser}
                                        className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        <span>Unblock {targetUser.name}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleBlockUser}
                                        className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 font-bold text-xs transition flex items-center justify-center gap-2"
                                    >
                                        <UserX className="w-4 h-4" />
                                        <span>Block {targetUser.name}</span>
                                    </button>
                                )}

                                {/* Delete All Chats for Both Sides */}
                                <button
                                    onClick={handleDeleteAllChatsBothSides}
                                    className="w-full py-2.5 rounded-xl bg-red-600/30 border border-red-500/50 text-red-300 hover:bg-red-600/50 font-bold text-xs transition flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                    <span>Delete All Chats for Both Sides</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* WhatsApp Style Glassy Context Action Menu Popup (Long Press / Right Click) */}
            <AnimatePresence>
                {selectedContextMenuMsg && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedContextMenuMsg(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-xs bg-[#0c1222]/95 border border-white/20 rounded-3xl p-3 shadow-2xl space-y-1 text-white backdrop-blur-xl"
                        >
                            {/* Pin / Unpin Option */}
                            <button
                                onClick={() => handleTogglePinMessage(selectedContextMenuMsg)}
                                className="w-full px-4 py-3 rounded-2xl hover:bg-white/10 transition flex items-center justify-between text-xs font-semibold"
                            >
                                <span className="flex items-center gap-3 text-white/90">
                                    <Pin className="w-4 h-4 text-emerald-400 rotate-45" />
                                    <span>{pinnedMessages.some(p => p.id === selectedContextMenuMsg.id) ? 'Unpin Message' : 'Pin Message'}</span>
                                </span>
                            </button>

                            {/* Edit Option (Senders own message within 5 mins) */}
                            {selectedContextMenuMsg.senderId === currentUid && selectedContextMenuMsg.text && (
                                <button
                                    onClick={() => {
                                        const ms = getTimestampMs(selectedContextMenuMsg.timestamp);
                                        const diffMins = (Date.now() - ms) / (1000 * 60);
                                        if (diffMins > 5) {
                                            showToast('Messages can only be edited within 5 minutes ⏱️');
                                            return;
                                        }
                                        setEditingMsg(selectedContextMenuMsg);
                                        setEditingText(selectedContextMenuMsg.text || '');
                                        setSelectedContextMenuMsg(null);
                                    }}
                                    className="w-full px-4 py-3 rounded-2xl hover:bg-white/10 transition flex items-center justify-between text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-3 text-indigo-300">
                                        <Edit3 className="w-4 h-4 text-indigo-400" />
                                        <span>Edit Message (5 min limit)</span>
                                    </span>
                                </button>
                            )}

                            {/* Reply Option */}
                            <button
                                onClick={() => {
                                    setReplyToMessage(selectedContextMenuMsg);
                                    setSelectedContextMenuMsg(null);
                                }}
                                className="w-full px-4 py-3 rounded-2xl hover:bg-white/10 transition flex items-center justify-between text-xs font-semibold"
                            >
                                <span className="flex items-center gap-3 text-sky-300">
                                    <Reply className="w-4 h-4 text-sky-400" />
                                    <span>Reply</span>
                                </span>
                            </button>

                            {/* Delete for Everyone Option */}
                            <button
                                onClick={() => handleDeleteMessage(selectedContextMenuMsg)}
                                className="w-full px-4 py-3 rounded-2xl hover:bg-red-500/20 text-red-400 transition flex items-center justify-between text-xs font-semibold border-t border-white/10 mt-1"
                            >
                                <span className="flex items-center gap-3 font-bold">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                    <span>Delete for Everyone</span>
                                </span>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Message Modal (WhatsApp 5-minute Edit Window) */}
            <AnimatePresence>
                {editingMsg && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setEditingMsg(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-[#0c1222] border border-indigo-500/30 rounded-3xl p-5 shadow-2xl space-y-4 text-white"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-indigo-400" />
                                    <span>Edit Message</span>
                                </h3>
                                <button onClick={() => setEditingMsg(null)} className="p-1 rounded-full bg-white/5 text-white/70">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                                    placeholder="Type edited message..."
                                />
                                <p className="text-[10px] text-white/50 italic">
                                    Note: Message label me 'edited' dikhega.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingMsg(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEditedMessage}
                                    disabled={!editingText.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-bold text-xs text-white transition shadow-lg"
                                >
                                    Save Edit
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
