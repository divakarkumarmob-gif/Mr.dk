import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Users, Send, Image as ImageIcon, X, ArrowLeft, Shield, Ban, UserX, 
    UserCheck, Settings, Sparkles, AlertTriangle, Upload, CheckCircle2, Lock,
    Share2, Link as LinkIcon, Sliders, Mic, Square, Play, Pause, Pin, PinOff,
    BarChart2, HelpCircle, Timer, Volume2, VolumeX, Flame, BookOpen, MessageCircle,
    Clock, Calendar, PowerOff, Trash2, ArrowDown, Plus, Check, Vote, Music
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';
import { decryptLegacyXOR } from '../utils/encryption';
import { 
    initUserE2EE, 
    fetchUserPublicKey, 
    generateRoomSymmetricKey, 
    wrapRoomKeyForMember, 
    unwrapRoomKeyForMember, 
    getRoomSymmetricKey, 
    setRoomSymmetricKey, 
    encryptPayloadWithKey, 
    decryptPayloadWithKey,
    ensureSodium,
    UserE2EEStatus
} from '../utils/e2ee';
import PinSetupModal, { PinModalMode } from './e2ee/PinSetupModal';

export type RoomMode = 'doubt_solving' | 'silent_study' | 'mcq_battle' | 'general';

export interface StudyRoom {
    id: string;
    name: string;
    topic: string;
    description: string;
    hostId: string;
    hostName: string;
    members: string[];
    blockedUsers?: string[];
    maxMembers?: number; // Max Users Limit
    roomMode?: RoomMode; // Room Mode / Badge
    pinnedMessageId?: string | null;
    expiryOption?: string; // 'none' | '1_hour' | '3_hours' | '6_hours' | '24_hours'
    expiresAt?: string | null; // ISO timestamp when room expires
    isClosed?: boolean; // Manual Admin closure status
    createdAt: any;
    isMusicActive?: boolean; // Admin started music status
    musicStartedBy?: string; // Host / Admin name who started music
}

export interface PollData {
    question: string;
    options: string[];
    correctIdx: number; // -1 for opinion poll, 0..N for MCQ
    votes: Record<string, number>; // uid -> optionIndex
}

export interface RoomMessage {
    id: string;
    roomId: string;
    senderId: string;
    senderName: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string; // Voice Note Base64 / URL
    pollData?: PollData; // Live MCQ Poll Data
    isPinned?: boolean;
    timestamp: any;
}

interface StudyRoomChatProps {
    room: StudyRoom;
    onBack: () => void;
}

// Safe timestamp millisecond extractor (prevents NaN sorting issues in Firestore)
const parseTimestampMs = (ts: any): number => {
    if (!ts) return Date.now();
    if (typeof ts === 'number') return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'string') {
        const parsed = new Date(ts).getTime();
        return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
};

export default function StudyRoomChat({ room: initialRoom, onBack }: StudyRoomChatProps) {
    const [room, setRoom] = useState<StudyRoom>(initialRoom);
    const [messages, setMessages] = useState<RoomMessage[]>([]);
    const [messageText, setMessageText] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');

    // E2EE Room States
    const [e2eeStatus, setE2eeStatus] = useState<UserE2EEStatus | null>(null);
    const [roomSymmetricKey, setRoomSymmetricKeyBytes] = useState<Uint8Array | null>(null);
    const [showPinModal, setShowPinModal] = useState<boolean>(false);
    const [pinModalMode, setPinModalMode] = useState<PinModalMode>('setup');

    // Active Media Preview State
    const [showMembersDrawer, setShowMembersDrawer] = useState<boolean>(false);
    const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

    // Admin Max Members Limit Input State
    const [inputMaxMembers, setInputMaxMembers] = useState<number>(initialRoom.maxMembers || 50);

    // Countdown Timer State
    const [timeLeftStr, setTimeLeftStr] = useState<string>('');

    // Voice Note Recorder State
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingTime, setRecordingTime] = useState<number>(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);

    // Voice Note Preview State (WhatsApp style before sending)
    const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
    const [recordedAudioDuration, setRecordedAudioDuration] = useState<number>(0);
    const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Live MCQ Poll Modal State
    const [showPollModal, setShowPollModal] = useState<boolean>(false);
    const [pollQuestion, setPollQuestion] = useState<string>('');
    const [pollOptions, setPollOptions] = useState<string[]>(['Option A', 'Option B', 'Option C', 'Option D']);
    const [pollCorrectIdx, setPollCorrectIdx] = useState<number>(0);

    // Group Focus Audio & Mute State
    const [isUserMuted, setIsUserMuted] = useState<boolean>(false);
    const audioSynthRef = useRef<AudioContext | null>(null);

    // Chat Container & Scroll Refs
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);

    // Pinned Message state
    const pinnedMessage = messages.find(m => m.id === room.pinnedMessageId || m.isPinned);

    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || 'user_guest_' + Date.now();
    const currentName = currentUser?.displayName || 'NEET Aspirant';

    const isHost = currentUser?.uid === room.hostId || room.hostId.startsWith('user_');
    const isBlocked = room.blockedUsers?.includes(currentUid);
    const maxLimit = room.maxMembers || 50;

    // Check if room is expired or manually closed by Admin
    const isExpired = room.expiresAt ? new Date(room.expiresAt).getTime() <= Date.now() : false;
    const isRoomClosed = !!room.isClosed || isExpired;
    const isFull = !room.members?.includes(currentUid) && (room.members?.length || 0) >= maxLimit;

    // Android Hardware Physical Back Button Handler
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (activeMediaUrl) {
                setActiveMediaUrl(null);
                return true;
            }
            if (showPollModal) {
                setShowPollModal(false);
                return true;
            }
            if (showMembersDrawer) {
                setShowMembersDrawer(false);
                return true;
            }
            onBack();
            return true;
        });
        return unregister;
    }, [activeMediaUrl, showPollModal, showMembersDrawer, onBack]);

    // Auto scroll to latest message (WhatsApp style - scroll strictly to bottom)
    const scrollToBottom = (smooth = true) => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    };

    useEffect(() => {
        scrollToBottom(true);
        const timeout = setTimeout(() => scrollToBottom(false), 250);
        return () => clearTimeout(timeout);
    }, [messages.length]);

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isUp = scrollHeight - scrollTop - clientHeight > 150;
        setShowScrollToBottom(isUp);
    };

    // Live Countdown Timer Effect for Expiry
    useEffect(() => {
        if (!room.expiresAt || room.isClosed) {
            setTimeLeftStr('');
            return;
        }

        const updateCountdown = () => {
            const diff = new Date(room.expiresAt!).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeftStr('EXPIRED');
                setRoom(prev => ({ ...prev, isClosed: true }));
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeftStr(`${hours > 0 ? hours + 'h ' : ''}${mins}m ${secs}s`);
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [room.expiresAt, room.isClosed]);

    // Admin Action: Manually Close Room on Server
    const handleCloseRoom = async () => {
        if (!isHost) return;
        if (!window.confirm('Kya aap is study room ko hamesha ke liye Close/Expire karna chahte hain? Server par ye close ho jayega aur koi join nahi kar sakega.')) return;

        setRoom(prev => ({ ...prev, isClosed: true }));

        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { isClosed: true });
            showToast('Study Room Server par Close kar diya gaya hai! 🔴');
        } catch (e) {
            showToast('Room Closed!');
        }
    };

    // Focus Ambient Music Audio Synthesizer (Plays when Admin turns on Music & User is not muted)
    useEffect(() => {
        const shouldPlay = !!room.isMusicActive && !isUserMuted;

        if (!shouldPlay) {
            if (audioSynthRef.current) {
                try { audioSynthRef.current.close(); } catch (e) {}
                audioSynthRef.current = null;
            }
            return;
        }

        try {
            if (!audioSynthRef.current) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioSynthRef.current = ctx;

                const bufferSize = ctx.sampleRate * 2;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                noise.loop = true;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 750;

                const gain = ctx.createGain();
                gain.gain.value = 0.05;

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                noise.start();
            }
        } catch (e) {
            console.warn("Web Audio API error:", e);
        }

        return () => {
            if (audioSynthRef.current) {
                try { audioSynthRef.current.close(); } catch (e) {}
                audioSynthRef.current = null;
            }
        };
    }, [room.isMusicActive, isUserMuted]);

    // Admin Action: Start / Stop Room Music
    const handleToggleAdminMusic = async () => {
        if (!isHost) return;
        const nextState = !room.isMusicActive;

        setRoom(prev => ({
            ...prev,
            isMusicActive: nextState,
            musicStartedBy: currentName
        }));

        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, {
                isMusicActive: nextState,
                musicStartedBy: currentName
            });

            if (nextState) {
                showToast('🎵 Focus Music started for Room!');
                const newMsg: RoomMessage = {
                    id: 'msg_music_' + Date.now(),
                    roomId: room.id,
                    senderId: currentUid,
                    senderName: 'SYSTEM ADMIN',
                    text: `🎵 music started by admin (${currentName})`,
                    timestamp: new Date().toISOString()
                };
                await addDoc(collection(db, 'studyRooms', room.id, 'messages'), {
                    senderId: newMsg.senderId,
                    senderName: newMsg.senderName,
                    text: newMsg.text,
                    timestamp: serverTimestamp()
                });
            } else {
                showToast('🔇 Focus Music stopped.');
            }
        } catch (e) {
            console.warn("Toggle admin music error:", e);
        }
    };

    // Non-Admin Action: Request Music (Automatic chat message sent to room)
    const handleRequestMusic = async () => {
        if (isRoomClosed) return;
        
        const newMsg: RoomMessage = {
            id: 'msg_req_music_' + Date.now(),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            text: '🎵 pls start music',
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg].sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
        saveLocalRoomMessage(newMsg);

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), {
                senderId: newMsg.senderId,
                senderName: newMsg.senderName,
                text: newMsg.text,
                timestamp: serverTimestamp()
            });
            showToast('Music request sent to Admin! 🎵');
        } catch (e) {}

        setTimeout(() => scrollToBottom(true), 100);
    };

    // Real-time Listener for Room Data
    useEffect(() => {
        let unsubscribe = () => {};
        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            unsubscribe = onSnapshot(roomRef, (snapshot) => {
                if (snapshot.exists()) {
                    const updated = { id: snapshot.id, ...snapshot.data() } as StudyRoom;
                    setRoom(updated);
                    if (updated.maxMembers) setInputMaxMembers(updated.maxMembers);
                }
            });
        } catch (e) {
            console.warn("Room metadata snapshot error:", e);
        }

        // Add current user to members list if not already
        if (!room.members?.includes(currentUid) && !isBlocked && !isFull && !isRoomClosed) {
            joinRoom(currentUid);
        }

        return () => unsubscribe();
    }, [room.id]);

    // Helper: Join Room with Limit & Expiry Check
    const joinRoom = async (uid: string) => {
        if (isRoomClosed) {
            showToast('🔴 Study Room is closed/expired!');
            return;
        }
        if ((room.members?.length || 0) >= maxLimit) {
            showToast(`Room is full! Maximum limit of ${maxLimit} members reached.`);
            return;
        }
        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, {
                members: arrayUnion(uid)
            });
        } catch (e) {
            setRoom(prev => ({
                ...prev,
                members: [...(prev.members || []), uid]
            }));
        }
    };

    // Initialize User E2EE & Resolve Room Symmetric Key
    useEffect(() => {
        let isMounted = true;
        initUserE2EE(currentUid).then(async (status) => {
            if (!isMounted) return;
            setE2eeStatus(status);

            if (!status.initialized) {
                if (status.isNewDevice && status.backupBlob) {
                    setPinModalMode('restore');
                    setShowPinModal(true);
                } else if (status.isFirstTime) {
                    setPinModalMode('setup');
                    setShowPinModal(true);
                }
                return;
            }

            // Resolve Room Symmetric Key
            try {
                const sodium = await ensureSodium();
                let keyBase64 = await getRoomSymmetricKey(room.id);

                if (!keyBase64) {
                    // Check wrapped keys in Firestore room document
                    const roomRef = doc(db, 'studyRooms', room.id);
                    const roomSnap = await getDoc(roomRef);
                    const roomData = roomSnap.exists() ? roomSnap.data() : {};
                    const wrappedKeys = roomData.wrappedKeys || {};

                    if (wrappedKeys[currentUid] && status.publicKey && status.privateKey) {
                        // Unwrap room key
                        keyBase64 = await unwrapRoomKeyForMember(wrappedKeys[currentUid], status.publicKey, status.privateKey);
                        await setRoomSymmetricKey(room.id, keyBase64);
                    } else if (status.publicKey) {
                        // Create or wrap room key
                        keyBase64 = await generateRoomSymmetricKey();
                        const wrapped = await wrapRoomKeyForMember(keyBase64, status.publicKey);
                        await setDoc(roomRef, {
                            wrappedKeys: { ...wrappedKeys, [currentUid]: wrapped }
                        }, { merge: true });
                        await setRoomSymmetricKey(room.id, keyBase64);
                    }
                }

                if (keyBase64 && isMounted) {
                    const bytes = sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
                    setRoomSymmetricKeyBytes(bytes);
                }
            } catch (e) {
                console.error("Room E2EE key resolution error:", e);
            }
        });

        return () => { isMounted = false; };
    }, [room.id, currentUid]);

    // Real-time Listener for Messages with Strict Chronological Timestamp Sorting
    useEffect(() => {
        let unsubscribe = () => {};
        try {
            const q = query(collection(db, 'studyRooms', room.id, 'messages'), orderBy('timestamp', 'asc'));
            unsubscribe = onSnapshot(q, async (snapshot) => {
                const fetchedPromises = snapshot.docs.map(async docSnap => {
                    const raw = { id: docSnap.id, ...docSnap.data() } as RoomMessage;
                    if (roomSymmetricKey) {
                        return await decryptPayloadWithKey(raw, roomSymmetricKey, (str) => decryptLegacyXOR(str, room.id));
                    }
                    return raw;
                });

                const fetched = await Promise.all(fetchedPromises);

                const localMsgs = getLocalRoomMessages(room.id);
                const allMap = new Map<string, RoomMessage>();
                [...fetched, ...localMsgs].forEach(m => allMap.set(m.id, m));

                const sortedMsgs = Array.from(allMap.values()).sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp));
                setMessages(sortedMsgs);
            }, (err) => {
                const localMsgs = getLocalRoomMessages(room.id);
                setMessages(localMsgs.sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
            });
        } catch (e) {
            const localMsgs = getLocalRoomMessages(room.id);
            setMessages(localMsgs.sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
        }

        return () => unsubscribe();
    }, [room.id, roomSymmetricKey]);

    // Local Storage Helpers for Messages
    const getLocalRoomMessages = (roomId: string): RoomMessage[] => {
        try {
            const stored = localStorage.getItem('study_room_msgs_' + roomId);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    };

    const saveLocalRoomMessage = (msg: RoomMessage) => {
        try {
            const current = getLocalRoomMessages(room.id);
            const updated = [...current, msg];
            localStorage.setItem('study_room_msgs_' + room.id, JSON.stringify(updated));
        } catch {}
    };

    // Share Room Link Handler
    const handleShareRoomLink = () => {
        const shareUrl = `${window.location.origin}/?view=neetCommunity&roomId=${room.id}`;
        const shareText = `Join my Live NEET Study Room: "${room.name}" on NEETMaster! 🚀\n${shareUrl}`;
        if (navigator.share) {
            navigator.share({ title: room.name, text: shareText, url: shareUrl });
        } else {
            navigator.clipboard.writeText(shareText);
            showToast('Room link copied to clipboard! 📋');
        }
    };

    // Voice Note Recording Handlers
    const startRecording = async () => {
        if (isRoomClosed) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    setRecordedAudioBase64(base64Audio);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            showToast('Recording Voice Note... Speak now 🎙️');
        } catch (err) {
            showToast('Microphone permission enable karein!');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            setRecordedAudioDuration(recordingTime);
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const cancelVoiceNotePreview = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        setIsPlayingPreview(false);
        setRecordedAudioBase64(null);
        setRecordedAudioDuration(0);
    };

    const togglePlayPreview = () => {
        if (!recordedAudioBase64) return;

        if (isPlayingPreview) {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
            }
            setIsPlayingPreview(false);
        } else {
            const audio = new Audio(recordedAudioBase64);
            previewAudioRef.current = audio;
            audio.onended = () => setIsPlayingPreview(false);
            audio.play().catch(() => {});
            setIsPlayingPreview(true);
        }
    };

    const handleSendVoiceNote = async () => {
        if (!recordedAudioBase64) return;

        if (!roomSymmetricKey) {
            showToast('Encryption ready nahi hai, thoda wait karo');
            return;
        }

        const base64Audio = recordedAudioBase64;

        let payload: any = {
            senderId: currentUid,
            senderName: currentName,
            audioUrl: base64Audio,
            timestamp: serverTimestamp()
        };

        try {
            payload = await encryptPayloadWithKey(payload, roomSymmetricKey);
        } catch (e) {
            console.error("Voice note encryption error:", e);
            showToast('Encryption error, message bhej nahi paye');
            return;
        }

        cancelVoiceNotePreview();

        const newMsg: RoomMessage = {
            id: 'msg_voice_' + Date.now(),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            audioUrl: base64Audio,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg].sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
        saveLocalRoomMessage(newMsg);

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), payload);
            showToast('Voice Doubt Note sent! 🎙️');
        } catch (e) {}

        setTimeout(() => scrollToBottom(true), 100);
    };

    // Question Poll Option Helpers
    const handleAddPollOption = () => {
        if (pollOptions.length < 6) {
            setPollOptions(prev => [...prev, '']);
        } else {
            showToast('Maximum 6 options allowed!');
        }
    };

    const handleRemovePollOption = (idx: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(prev => prev.filter((_, i) => i !== idx));
        } else {
            showToast('Kam se kam 2 options zaruri hain!');
        }
    };

    // Create Live MCQ Question Poll Handler
    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!roomSymmetricKey) {
            showToast('Encryption ready nahi hai, thoda wait karo');
            return;
        }

        const validOptions = pollOptions.map(o => o.trim()).filter(o => o !== '');
        if (!pollQuestion.trim() || validOptions.length < 2) {
            showToast('Poll question aur kam se kam 2 valid options likhein!');
            return;
        }

        const pollData: PollData = {
            question: pollQuestion.trim(),
            options: validOptions,
            correctIdx: pollCorrectIdx,
            votes: {}
        };

        let payload: any = {
            senderId: currentUid,
            senderName: currentName,
            pollData: pollData,
            timestamp: serverTimestamp()
        };

        try {
            payload = await encryptPayloadWithKey(payload, roomSymmetricKey);
        } catch (e) {
            console.error("Poll encryption error:", e);
            showToast('Encryption error, message bhej nahi paye');
            return;
        }

        const newMsg: RoomMessage = {
            id: 'msg_poll_' + Date.now(),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            pollData: pollData,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg].sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
        saveLocalRoomMessage(newMsg);

        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['Option A', 'Option B', 'Option C', 'Option D']);
        setPollCorrectIdx(0);

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), payload);
            showToast('Live MCQ Question Poll posted! 📊');
        } catch (e) {}

        setTimeout(() => scrollToBottom(true), 100);
    };

    // Vote on MCQ Poll Handler
    const handleVotePoll = async (msgId: string, optionIdx: number) => {
        if (isRoomClosed) return;
        setMessages(prev => prev.map(m => {
            if (m.id === msgId && m.pollData) {
                const newVotes = { ...m.pollData.votes, [currentUid]: optionIdx };
                return { ...m, pollData: { ...m.pollData, votes: newVotes } };
            }
            return m;
        }));

        try {
            const msgRef = doc(db, 'studyRooms', room.id, 'messages', msgId);
            await updateDoc(msgRef, {
                [`pollData.votes.${currentUid}`]: optionIdx
            });
            showToast('Vote recorded! 🗳️');
        } catch (e) {}
    };

    // Pin Message Handler
    const handleTogglePinMessage = async (msg: RoomMessage) => {
        if (!isHost) return;
        const newPinnedId = room.pinnedMessageId === msg.id ? null : msg.id;
        setRoom(prev => ({ ...prev, pinnedMessageId: newPinnedId }));

        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { pinnedMessageId: newPinnedId });
            showToast(newPinnedId ? 'Message pinned to top! 📌' : 'Message unpinned.');
        } catch (e) {}
    };

    // Send Text Message Handler
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRoomClosed) {
            showToast('🔴 Room is closed/expired. Cannot send messages.');
            return;
        }
        if (isBlocked) {
            showToast('You are blocked from sending messages in this room.');
            return;
        }

        if (!messageText.trim() && !imageUrl.trim()) {
            return;
        }

        if (!roomSymmetricKey) {
            showToast('Encryption ready nahi hai, thoda wait karo');
            return;
        }

        const textToSend = messageText.trim();
        const imageToSend = imageUrl.trim();

        let payload: any = {
            senderId: currentUid || 'user',
            senderName: currentName || 'NEET Aspirant',
            text: textToSend || '',
            imageUrl: imageToSend || '',
            timestamp: serverTimestamp()
        };

        try {
            payload = await encryptPayloadWithKey(payload, roomSymmetricKey);
        } catch (err) {
            console.error("Message encryption error:", err);
            showToast('Encryption error, message bhej nahi paye');
            return;
        }

        const newMsg: RoomMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            text: textToSend || undefined,
            imageUrl: imageToSend || undefined,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg].sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)));
        saveLocalRoomMessage(newMsg);

        setMessageText('');
        setImageUrl('');

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), payload);
        } catch (err) {}

        setTimeout(() => scrollToBottom(true), 100);
    };

    // File Upload Handler for Photos
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isRoomClosed) return;
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            showToast('Photo size 15MB se kam honi chahiye!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setImageUrl(result);
            showToast('Photo attached! Tap Send to share. 📸');
        };
        reader.readAsDataURL(file);
    };

    // Admin Action: Remove User
    const handleRemoveUser = async (targetUid: string) => {
        if (!isHost) return;
        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { members: arrayRemove(targetUid) });
            showToast('User removed from study room.');
        } catch (e) {
            setRoom(prev => ({ ...prev, members: prev.members.filter(uid => uid !== targetUid) }));
            showToast('User removed!');
        }
    };

    // Admin Action: Block User
    const handleBlockUser = async (targetUid: string) => {
        if (!isHost) return;
        if (!window.confirm('Kya aap is user ko block karna chahte hain?')) return;

        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, {
                members: arrayRemove(targetUid),
                blockedUsers: arrayUnion(targetUid)
            });
            showToast('User blocked and removed! 🚫');
        } catch (e) {
            setRoom(prev => ({
                ...prev,
                members: prev.members.filter(uid => uid !== targetUid),
                blockedUsers: [...(prev.blockedUsers || []), targetUid]
            }));
        }
    };

    // Clickable URL Formatter
    const renderFormattedMessageText = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-300 underline font-bold break-all hover:text-white transition"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // Helper: Mode Badge Render
    const getModeBadge = (mode?: RoomMode) => {
        switch (mode) {
            case 'doubt_solving':
                return { label: '🔴 Live Doubt Solving', color: 'bg-red-500/20 text-red-300 border-red-500/40' };
            case 'silent_study':
                return { label: '📖 Silent Group Study', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
            case 'mcq_battle':
                return { label: '🧪 MCQ Speed Battle', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
            default:
                return { label: '📚 General Discussion', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
        }
    };

    // Date Time Formatter
    const formatDate = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const ms = parseTimestampMs(ts);
            const d = new Date(ms);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        } catch {
            return 'Recently';
        }
    };

    // Blocked Screen
    if (isBlocked) {
        return (
            <div className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="p-4 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse">
                    <Lock className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold text-white">Access Denied to Study Room</h2>
                <p className="text-sm text-white/60 max-w-md">
                    Host (Admin) ne aapko is study room se block kar diya hai.
                </p>
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-indigo-500 font-bold text-sm text-white">
                    Back to Community
                </button>
            </div>
        );
    }

    // Room Full Screen
    if (isFull) {
        return (
            <div className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="p-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-bounce">
                    <Users className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold text-white">Study Room Full!</h2>
                <p className="text-sm text-white/60 max-w-md">
                    Is room ki capacity complete ho gayi hai (Max {maxLimit} members limit).
                </p>
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-indigo-500 font-bold text-sm text-white">
                    Back to Community
                </button>
            </div>
        );
    }

    const modeBadge = getModeBadge(room.roomMode);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col font-sans overflow-hidden"
        >
            {/* Room Header Bar */}
            <div 
                className="bg-[#0c1222]/90 backdrop-blur-md border-b border-white/10 px-4 pb-2.5 flex items-center justify-between shadow-xl"
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
            >
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold text-white flex items-center gap-1.5">
                                {room.name}
                            </h1>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${modeBadge.color}`}>
                                {modeBadge.label}
                            </span>
                            {isRoomClosed && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/40">
                                    🔴 EXPIRED / CLOSED
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-indigo-300/70 flex items-center gap-2">
                            <span>#{room.topic}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">{room.members?.length || 1} / {maxLimit} Members</span>
                            {timeLeftStr && (
                                <>
                                    <span>•</span>
                                    <span className="text-amber-400 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3 animate-pulse" />
                                        <span>Expires in {timeLeftStr}</span>
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Launch Poll Button */}
                    <button
                        onClick={() => setShowPollModal(true)}
                        className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-1.5 text-xs font-semibold"
                        title="Create Question Poll"
                    >
                        <BarChart2 className="w-4.5 h-4.5 text-amber-400" />
                        <span className="hidden sm:inline">Poll</span>
                    </button>

                    {/* Share Room Link */}
                    <button
                        onClick={handleShareRoomLink}
                        className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition text-xs font-semibold"
                        title="Share Room Link"
                    >
                        <Share2 className="w-4.5 h-4.5" />
                    </button>

                    {/* Members & Settings Panel Drawer Trigger */}
                    <button
                        onClick={() => setShowMembersDrawer(true)}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition flex items-center gap-1.5 text-xs font-semibold relative"
                        title="Room Panel & Members"
                    >
                        <Users className="w-4.5 h-4.5 text-indigo-400" />
                        {room.isMusicActive && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-pink-500 animate-ping" />
                        )}
                        {isHost && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                </div>
            </div>

            {/* Admin Music Started Banner Notification in Room Header */}
            {room.isMusicActive && (
                <div className="bg-gradient-to-r from-pink-600/40 via-purple-600/40 to-indigo-600/40 border-b border-pink-500/40 px-4 py-2 flex items-center justify-between backdrop-blur-md shadow-lg animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-bold text-pink-200">
                        <Volume2 className="w-4 h-4 text-pink-300 animate-bounce shrink-0" />
                        <span>🎵 music started by admin ({room.musicStartedBy || room.hostName})</span>
                    </div>
                    <button
                        onClick={() => setIsUserMuted(!isUserMuted)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 border shadow-sm ${
                            isUserMuted
                                ? 'bg-red-500/30 text-red-200 border-red-500/50 hover:bg-red-500/40'
                                : 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/40'
                        }`}
                    >
                        {isUserMuted ? (
                            <>
                                <VolumeX className="w-3.5 h-3.5 text-red-300" />
                                <span>Muted</span>
                            </>
                        ) : (
                            <>
                                <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Playing</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Room Banner with Post Date/Time & Host Tag */}
            <div className="px-4 py-2 bg-indigo-900/20 border-b border-indigo-500/20 flex items-center justify-between text-xs text-indigo-200">
                <div className="flex items-center gap-3 truncate">
                    <div className="flex items-center gap-1 text-white/60 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Posted: {formatDate(room.createdAt)}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5 truncate">
                        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Host: <strong>{room.hostName}</strong></span>
                        {isHost && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">ADMIN</span>}
                    </div>
                </div>

                {timeLeftStr ? (
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        ⏱️ Expiring in {timeLeftStr}
                    </span>
                ) : (
                    <span className="text-[10px] text-white/40">{room.description}</span>
                )}
            </div>

            {/* Expired / Closed Room Red Alert Banner */}
            {isRoomClosed && (
                <div className="p-3 bg-red-500/20 border-b border-red-500/40 text-center text-xs text-red-300 font-bold flex items-center justify-center gap-2">
                    <PowerOff className="w-4 h-4 text-red-400" />
                    <span>🔴 Is Study Room ko Host (Admin) dwara Close/Expire kar diya gaya hai. New messages locked hain.</span>
                </div>
            )}

            {/* Live Chat Messages Feed (WhatsApp Style Chronological Order) */}
            <div 
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 relative scroll-smooth"
            >
                {/* WhatsApp-Style End-to-End Encryption Banner */}
                <div className="flex justify-center my-2">
                    <div className="max-w-xs px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 text-center font-medium shadow-md flex items-center justify-center gap-1.5 leading-snug">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.</span>
                    </div>
                </div>
                {messages.length === 0 ? (
                    <div className="py-20 text-center text-white/40 space-y-2">
                        <Users className="w-12 h-12 text-indigo-400/40 mx-auto" />
                        <h3 className="text-sm font-bold text-white">Live Study Room Open!</h3>
                        <p className="text-xs text-white/60">Voice note 🎙️, MCQ poll 📊, ya image bhej kar discussion shuru karein!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === currentUid;
                        const isSystem = msg.senderName === 'SYSTEM ADMIN';

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <div className="px-3.5 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold flex items-center gap-2 shadow-md animate-pulse">
                                        <Volume2 className="w-3.5 h-3.5 text-pink-400" />
                                        <span>{msg.text}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                            >
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-[10px] text-white/40 font-medium">
                                        {isMe ? 'You' : msg.senderName} • {formatDate(msg.timestamp)}
                                    </span>
                                    {isHost && (
                                        <button
                                            onClick={() => handleTogglePinMessage(msg)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-white/40 hover:text-amber-400 transition"
                                            title="Pin message to top"
                                        >
                                            <Pin className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                <div className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl space-y-2 ${
                                    isMe 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-lg' 
                                        : 'bg-[#0c1222] border border-white/10 text-white/90 rounded-bl-none shadow-md'
                                }`}>
                                    {/* Text Content */}
                                    {msg.text && (
                                        <p className="text-xs leading-relaxed whitespace-pre-line font-sans">
                                            {renderFormattedMessageText(msg.text)}
                                        </p>
                                    )}

                                    {/* Voice Doubt Note Audio Player */}
                                    {msg.audioUrl && (
                                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3">
                                            <div className="p-2 rounded-full bg-indigo-500 text-white shrink-0">
                                                <Mic className="w-4 h-4" />
                                            </div>
                                            <audio src={msg.audioUrl} controls className="h-8 max-w-[200px]" />
                                        </div>
                                    )}

                                    {/* Live MCQ Poll Card */}
                                    {msg.pollData && (
                                        <div className="p-3.5 rounded-xl bg-black/50 border border-amber-500/30 space-y-2.5 min-w-[240px]">
                                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                                                    <BarChart2 className="w-4 h-4 text-amber-400" />
                                                    <span>{msg.pollData.correctIdx !== -1 ? 'Live MCQ Quiz' : 'Opinion Poll'}</span>
                                                </div>
                                                <span className="text-[10px] text-amber-400/70 font-semibold">
                                                    {Object.keys(msg.pollData.votes || {}).length} votes
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-white leading-snug">{msg.pollData.question}</p>

                                            <div className="space-y-2 pt-1">
                                                {msg.pollData.options.map((opt, idx) => {
                                                    const totalVotes = Object.keys(msg.pollData?.votes || {}).length;
                                                    const optionVotes = Object.values(msg.pollData?.votes || {}).filter(v => v === idx).length;
                                                    const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                                    const userVotedIdx = msg.pollData?.votes?.[currentUid];
                                                    const hasVoted = userVotedIdx === idx;
                                                    const isCorrectOpt = msg.pollData?.correctIdx === idx;
                                                    const showAnswers = userVotedIdx !== undefined && msg.pollData?.correctIdx !== -1;

                                                    let borderBgStyle = 'bg-white/5 border-white/10 hover:bg-white/10 text-white';
                                                    if (hasVoted) {
                                                        borderBgStyle = 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold';
                                                    }
                                                    if (showAnswers) {
                                                        if (isCorrectOpt) {
                                                            borderBgStyle = 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold';
                                                        } else if (hasVoted && !isCorrectOpt) {
                                                            borderBgStyle = 'bg-red-500/25 border-red-400 text-red-300 font-bold';
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={idx}
                                                            disabled={isRoomClosed}
                                                            onClick={() => handleVotePoll(msg.id, idx)}
                                                            className={`w-full p-2.5 rounded-xl text-left text-xs transition relative overflow-hidden flex items-center justify-between border ${borderBgStyle}`}
                                                        >
                                                            <div 
                                                                className={`absolute left-0 top-0 bottom-0 pointer-events-none transition-all ${
                                                                    showAnswers && isCorrectOpt ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                                                                }`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                            <span className="relative z-10 flex items-center gap-2 pr-2">
                                                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                    {String.fromCharCode(65 + idx)}
                                                                </span>
                                                                <span>{opt}</span>
                                                                {showAnswers && isCorrectOpt && (
                                                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                                )}
                                                            </span>
                                                            <span className="relative z-10 text-[10px] font-mono text-amber-300 shrink-0">
                                                                {pct}% ({optionVotes})
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Image Attachment */}
                                    {msg.imageUrl && (
                                        <div 
                                            onClick={() => setActiveMediaUrl(msg.imageUrl!)}
                                            className="rounded-xl overflow-hidden cursor-pointer max-h-60 border border-white/10 bg-black/40"
                                        >
                                            <img 
                                                src={msg.imageUrl} 
                                                alt="Room Attached Media" 
                                                className="w-full h-full object-cover hover:scale-102 transition" 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Floating Button */}
            {showScrollToBottom && (
                <button
                    onClick={() => scrollToBottom(true)}
                    className="absolute bottom-20 right-5 z-30 p-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xl hover:brightness-110 transition border border-white/20 flex items-center justify-center animate-bounce"
                    title="Scroll to latest message"
                >
                    <ArrowDown className="w-5 h-5" />
                </button>
            )}

            {/* Image Preview Overlay */}
            {imageUrl && !isRoomClosed && (
                <div className="px-4 py-2 bg-[#0c1222] border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={imageUrl} alt="Attached Preview" className="w-10 h-10 object-cover rounded-lg border border-white/20" />
                        <span className="text-xs text-white/70">Photo attached and ready to send</span>
                    </div>
                    <button onClick={() => setImageUrl('')} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* WhatsApp-Style Chat Input & Voice Preview Bar */}
            {!isRoomClosed && (
                recordedAudioBase64 ? (
                    <div className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center justify-between gap-2">
                        {/* WhatsApp-style Voice Note Preview Bar before sending */}
                        <div className="flex items-center gap-2 flex-1 bg-white/5 p-2 rounded-xl border border-white/10">
                            {/* Delete/Cancel Preview */}
                            <button
                                type="button"
                                onClick={cancelVoiceNotePreview}
                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition shrink-0"
                                title="Discard Voice Note"
                            >
                                <Trash2 className="w-4.5 h-4.5" />
                            </button>

                            {/* Play/Pause Preview */}
                            <button
                                type="button"
                                onClick={togglePlayPreview}
                                className="p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition shrink-0"
                                title={isPlayingPreview ? "Pause" : "Play Preview"}
                            >
                                {isPlayingPreview ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
                            </button>

                            {/* Audio Progress & Timer */}
                            <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
                                <Mic className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
                                <span className="text-xs font-mono font-bold text-white/90 shrink-0">
                                    Voice Note ({Math.floor(recordedAudioDuration / 60)}:{(recordedAudioDuration % 60).toString().padStart(2, '0')})
                                </span>
                                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden hidden sm:block">
                                    <div className={`h-full bg-gradient-to-r from-indigo-400 to-purple-400 ${isPlayingPreview ? 'w-full transition-all duration-[3000ms]' : 'w-1/2'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Send Voice Note Button */}
                        <button
                            type="button"
                            onClick={handleSendVoiceNote}
                            disabled={!roomSymmetricKey}
                            className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold hover:brightness-110 transition shadow-lg flex items-center gap-1.5 text-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={roomSymmetricKey ? "Send Voice Note" : "Encryption ready nahi hai"}
                        >
                            <span className="hidden sm:inline">Send Voice</span>
                            <Send className="w-4.5 h-4.5" />
                        </button>
                    </div>
                ) : isRecording ? (
                    <div className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center justify-between gap-3">
                        {/* Active Voice Recording UI with Stop Button */}
                        <div className="flex items-center gap-3 flex-1 bg-red-500/10 border border-red-500/30 p-2 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                            <span className="text-xs font-mono font-bold text-red-400">
                                Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            </span>
                            <div className="flex-1 flex gap-1 items-center justify-center">
                                <span className="w-1 h-3 bg-red-400 animate-bounce" />
                                <span className="w-1 h-5 bg-red-400 animate-bounce delay-100" />
                                <span className="w-1 h-2 bg-red-400 animate-bounce delay-200" />
                                <span className="w-1 h-4 bg-red-400 animate-bounce delay-150" />
                            </div>
                        </div>

                        {/* Stop Recording & Go to Preview Button */}
                        <button
                            type="button"
                            onClick={stopRecording}
                            className="px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition shadow-md flex items-center gap-2 text-xs"
                            title="Stop & Preview Voice Note"
                        >
                            <Square className="w-4 h-4 fill-white" />
                            <span>Stop & Preview</span>
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center gap-2">
                        {/* Voice Note Mic Button */}
                        <button
                            type="button"
                            onClick={startRecording}
                            disabled={!roomSymmetricKey}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-indigo-400 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            title={roomSymmetricKey ? "Record Voice Note" : "Encryption ready nahi hai"}
                        >
                            <Mic className="w-5 h-5" />
                        </button>

                        {/* Photo File Picker Trigger */}
                        <label className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-400 cursor-pointer transition" title="Attach Image">
                            <ImageIcon className="w-5 h-5" />
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>

                        {/* Question Poll Icon Button */}
                        <button
                            type="button"
                            onClick={() => setShowPollModal(true)}
                            disabled={!roomSymmetricKey}
                            className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            title={roomSymmetricKey ? "Create Question Poll" : "Encryption ready nahi hai"}
                        >
                            <BarChart2 className="w-5 h-5" />
                        </button>

                        {/* Text Message & Link Input */}
                        <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type doubt, message or link (https://...)"
                            className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-white/30"
                        />

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={(!messageText.trim() && !imageUrl.trim()) || !roomSymmetricKey}
                            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                )
            )}

            {/* Live Question Poll Creation Modal */}
            <AnimatePresence>
                {showPollModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-lg bg-[#0c1222] border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-amber-400" />
                                    <h3 className="font-bold text-base text-white">Create Question Poll</h3>
                                </div>
                                <button onClick={() => setShowPollModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreatePoll} className="space-y-4 overflow-y-auto pr-1 flex-1">
                                <div>
                                    <label className="text-xs font-bold text-amber-300 block mb-1">
                                        Question / Quiz Title *
                                    </label>
                                    <textarea
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        placeholder="e.g. Which cell organelle is known as the powerhouse of the cell?"
                                        rows={3}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-white/30"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-white/70 block">
                                            Options *
                                        </label>
                                        {pollOptions.length < 6 && (
                                            <button
                                                type="button"
                                                onClick={handleAddPollOption}
                                                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Option</span>
                                            </button>
                                        )}
                                    </div>

                                    {pollOptions.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => {
                                                    const updated = [...pollOptions];
                                                    updated[idx] = e.target.value;
                                                    setPollOptions(updated);
                                                }}
                                                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                                className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-white/30"
                                                required={idx < 2}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePollOption(idx)}
                                                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white/70 block mb-1">
                                        Select Correct Answer (For NEET Quiz)
                                    </label>
                                    <select
                                        value={pollCorrectIdx}
                                        onChange={(e) => setPollCorrectIdx(Number(e.target.value))}
                                        className="w-full p-2.5 rounded-xl bg-[#070b14] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
                                    >
                                        <option value={-1}>Opinion Poll (No single correct answer)</option>
                                        {pollOptions.map((_, idx) => (
                                            <option key={idx} value={idx}>
                                                Option {String.fromCharCode(65 + idx)} is Correct
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowPollModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/70 hover:bg-white/10 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!roomSymmetricKey}
                                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span>Post Question Poll 🚀</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Media Overlay */}
            {activeMediaUrl && (
                <div 
                    onClick={() => setActiveMediaUrl(null)}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
                >
                    <button onClick={() => setActiveMediaUrl(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
                        <X className="w-6 h-6" />
                    </button>
                    <img src={activeMediaUrl} alt="Enlarged view" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* Members & Room Settings Panel Drawer */}
            <AnimatePresence>
                {showMembersDrawer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end"
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="w-full max-w-md h-full bg-[#0c1222] border-l border-white/15 p-5 flex flex-col justify-between space-y-4 shadow-2xl"
                        >
                            <div className="space-y-4 flex-1 overflow-y-auto">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div>
                                        <h3 className="font-bold text-base text-white flex items-center gap-2">
                                            Room Panel ({room.members?.length || 1} / {maxLimit})
                                        </h3>
                                        <p className="text-xs text-white/50">{room.name}</p>
                                    </div>
                                    <button onClick={() => setShowMembersDrawer(false)} className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Room Focus Music & Timer Controls Card inside Panel */}
                                <div className="p-3.5 rounded-2xl bg-[#070b14] border border-pink-500/30 space-y-3 shadow-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Timer className="w-4.5 h-4.5 text-pink-400" />
                                            <h4 className="text-xs font-bold text-pink-300">Focus Music & Timer Controls</h4>
                                        </div>
                                        {room.isMusicActive && (
                                            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/40 animate-pulse">
                                                🎵 Music Active
                                            </span>
                                        )}
                                    </div>

                                    {/* Admin vs Non-Admin Focus Music Control */}
                                    {isHost ? (
                                        <button
                                            onClick={handleToggleAdminMusic}
                                            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                                                room.isMusicActive
                                                    ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg'
                                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white shadow-md'
                                            }`}
                                        >
                                            {room.isMusicActive ? (
                                                <>
                                                    <VolumeX className="w-4 h-4" />
                                                    <span>Stop Room Focus Music</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Volume2 className="w-4 h-4" />
                                                    <span>Start Room Focus Music</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRequestMusic}
                                            className="w-full py-2.5 px-3 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 hover:bg-pink-500/30 font-bold text-xs transition flex items-center justify-center gap-2"
                                        >
                                            <Volume2 className="w-4 h-4 text-pink-400" />
                                            <span>🎵 pls start music (Request Admin)</span>
                                        </button>
                                    )}

                                    {/* User Local Mute/Unmute Control */}
                                    <div className="pt-2 flex items-center justify-between border-t border-white/10">
                                        <span className="text-[11px] text-white/60 font-medium">Your Local Audio Status:</span>
                                        <button
                                            onClick={() => setIsUserMuted(!isUserMuted)}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                                                isUserMuted
                                                    ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                            }`}
                                        >
                                            {isUserMuted ? (
                                                <>
                                                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                                                    <span>Muted (Tap to Unmute)</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>Unmuted (Tap to Mute)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Admin Direct Close Room Control */}
                                {isHost && !isRoomClosed && (
                                    <button
                                        onClick={handleCloseRoom}
                                        className="w-full py-2.5 px-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs hover:bg-red-500/30 transition flex items-center justify-center gap-2"
                                    >
                                        <PowerOff className="w-4 h-4 text-red-400" />
                                        <span>Close & Expire Room on Server</span>
                                    </button>
                                )}

                                {/* Share Room Link Action */}
                                <button
                                    onClick={handleShareRoomLink}
                                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs hover:bg-indigo-500/30 transition flex items-center justify-center gap-2"
                                >
                                    <Share2 className="w-4 h-4 text-indigo-400" />
                                    <span>Share Room Link with Classmates</span>
                                </button>

                                {/* Active Members List */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">Active Room Members</h4>
                                    {(room.members || [currentUid]).map((memberUid) => {
                                        const isMemberHost = memberUid === room.hostId;
                                        return (
                                            <div 
                                                key={memberUid}
                                                className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white">
                                                        U
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-white block">
                                                            {memberUid === currentUid ? 'You' : `User (${memberUid.substring(0, 6)})`}
                                                        </span>
                                                        {isMemberHost && (
                                                            <span className="text-[9px] font-semibold text-amber-400">HOST ADMIN</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {isHost && !isMemberHost && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleRemoveUser(memberUid)}
                                                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[11px] font-semibold transition"
                                                        >
                                                            Remove
                                                        </button>
                                                        <button
                                                            onClick={() => handleBlockUser(memberUid)}
                                                            className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400 text-[11px] font-bold transition flex items-center gap-1"
                                                        >
                                                            <Ban className="w-3 h-3" />
                                                            <span>Block</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button onClick={() => setShowMembersDrawer(false)} className="w-full py-2.5 rounded-xl bg-white/10 font-bold text-xs text-white">
                                Close Panel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                {/* Pin Setup / Restore Modal */}
                {showPinModal && (
                    <PinSetupModal 
                        uid={currentUid}
                        mode={pinModalMode}
                        onSuccess={(keys) => {
                            setShowPinModal(false);
                            setE2eeStatus({ initialized: true, publicKey: keys.publicKey, privateKey: keys.privateKey });
                        }}
                        onCancel={() => setShowPinModal(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
