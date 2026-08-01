import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Users, Send, Image as ImageIcon, X, ArrowLeft, Shield, Ban, UserX, 
    UserCheck, Settings, Sparkles, AlertTriangle, Upload, CheckCircle2, Lock,
    Share2, Link as LinkIcon, Sliders, Mic, Square, Play, Pause, Pin, PinOff,
    BarChart2, HelpCircle, Timer, Volume2, VolumeX, Flame, BookOpen, MessageCircle,
    Clock, Calendar, PowerOff
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';

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
}

export interface PollData {
    question: string;
    options: string[];
    correctIdx: number;
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

export default function StudyRoomChat({ room: initialRoom, onBack }: StudyRoomChatProps) {
    const [room, setRoom] = useState<StudyRoom>(initialRoom);
    const [messages, setMessages] = useState<RoomMessage[]>([]);
    const [messageText, setMessageText] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');

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

    // Live MCQ Poll Modal State
    const [showPollModal, setShowPollModal] = useState<boolean>(false);
    const [pollQuestion, setPollQuestion] = useState<string>('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '', '', '']);
    const [pollCorrectIdx, setPollCorrectIdx] = useState<number>(0);

    // Group Pomodoro Timer State
    const [isPomodoroActive, setIsPomodoroActive] = useState<boolean>(false);
    const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(25 * 60); // 25 mins
    const [ambientSound, setAmbientSound] = useState<boolean>(false);
    const audioSynthRef = useRef<AudioContext | null>(null);

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

    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Auto scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    // Group Pomodoro Timer Effect
    useEffect(() => {
        let timer: any = null;
        if (isPomodoroActive && pomodoroSeconds > 0) {
            timer = setInterval(() => {
                setPomodoroSeconds(prev => prev - 1);
            }, 1000);
        } else if (pomodoroSeconds === 0) {
            setIsPomodoroActive(false);
            showToast('🎉 Group Pomodoro Focus Block Complete! Great Job!');
        }
        return () => clearInterval(timer);
    }, [isPomodoroActive, pomodoroSeconds]);

    // Web Audio Sound Generator for Ambient Rain
    useEffect(() => {
        if (!ambientSound) {
            if (audioSynthRef.current) {
                audioSynthRef.current.close();
                audioSynthRef.current = null;
            }
            return;
        }

        try {
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
            filter.frequency.value = 800;

            const gain = ctx.createGain();
            gain.gain.value = 0.05;

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start();
        } catch (e) {
            console.warn("Web Audio API error:", e);
        }

        return () => {
            if (audioSynthRef.current) {
                audioSynthRef.current.close();
                audioSynthRef.current = null;
            }
        };
    }, [ambientSound]);

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

    // Admin Action: Update Max Member Limit
    const handleUpdateMaxMembers = async (newLimit: number) => {
        if (!isHost) return;
        if (isNaN(newLimit) || newLimit < 2 || newLimit > 500) {
            showToast('Member limit 2 se 500 ke beech honi chahiye!');
            return;
        }

        setInputMaxMembers(newLimit);
        setRoom(prev => ({ ...prev, maxMembers: newLimit }));

        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { maxMembers: newLimit });
            showToast(`Room member limit updated to ${newLimit}! ⚙️`);
        } catch (e) {
            console.warn("Update max members error:", e);
        }
    };

    // Admin Action: Update Room Mode / Badge
    const handleUpdateRoomMode = async (mode: RoomMode) => {
        if (!isHost) return;
        setRoom(prev => ({ ...prev, roomMode: mode }));
        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { roomMode: mode });
            showToast('Room Mode updated! 🎯');
        } catch (e) {}
    };

    // Real-time Listener for Messages
    useEffect(() => {
        let unsubscribe = () => {};
        try {
            const q = query(collection(db, 'studyRooms', room.id, 'messages'), orderBy('timestamp', 'asc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetched: RoomMessage[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as RoomMessage));

                const localMsgs = getLocalRoomMessages(room.id);
                const allMap = new Map<string, RoomMessage>();
                [...fetched, ...localMsgs].forEach(m => allMap.set(m.id, m));

                setMessages(Array.from(allMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
            }, (err) => {
                setMessages(getLocalRoomMessages(room.id));
            });
        } catch (e) {
            setMessages(getLocalRoomMessages(room.id));
        }

        return () => unsubscribe();
    }, [room.id]);

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
                    sendVoiceNote(base64Audio);
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
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const sendVoiceNote = async (base64Audio: string) => {
        const newMsg: RoomMessage = {
            id: 'msg_voice_' + Date.now(),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            audioUrl: base64Audio,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        saveLocalRoomMessage(newMsg);

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), {
                senderId: newMsg.senderId,
                senderName: newMsg.senderName,
                audioUrl: base64Audio,
                timestamp: serverTimestamp()
            });
            showToast('Voice Doubt Note sent! 🎙️');
        } catch (e) {}
    };

    // Create Live MCQ Poll Handler
    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = pollOptions.filter(o => o.trim() !== '');
        if (!pollQuestion.trim() || validOptions.length < 2) {
            showToast('Poll question aur kam se kam 2 options likhein!');
            return;
        }

        const pollData: PollData = {
            question: pollQuestion.trim(),
            options: validOptions,
            correctIdx: pollCorrectIdx,
            votes: {}
        };

        const newMsg: RoomMessage = {
            id: 'msg_poll_' + Date.now(),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            pollData: pollData,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        saveLocalRoomMessage(newMsg);

        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '', '', '']);

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), {
                senderId: newMsg.senderId,
                senderName: newMsg.senderName,
                pollData: pollData,
                timestamp: serverTimestamp()
            });
            showToast('Live MCQ Poll launched in Room! 📊');
        } catch (e) {}
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

    // Send Message Handler
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

        const newMsg: RoomMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            roomId: room.id,
            senderId: currentUid,
            senderName: currentName,
            text: messageText.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        saveLocalRoomMessage(newMsg);

        setMessageText('');
        setImageUrl('');

        try {
            await addDoc(collection(db, 'studyRooms', room.id, 'messages'), {
                senderId: newMsg.senderId || 'user',
                senderName: newMsg.senderName || 'NEET Aspirant',
                text: newMsg.text || '',
                imageUrl: newMsg.imageUrl || '',
                timestamp: serverTimestamp()
            });
        } catch (err) {}
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

    // Admin Action: Unblock User
    const handleUnblockUser = async (targetUid: string) => {
        if (!isHost) return;
        try {
            const roomRef = doc(db, 'studyRooms', room.id);
            await updateDoc(roomRef, { blockedUsers: arrayRemove(targetUid) });
            showToast('User unblocked! ✅');
        } catch (e) {
            setRoom(prev => ({ ...prev, blockedUsers: (prev.blockedUsers || []).filter(uid => uid !== targetUid) }));
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
            const d = ts.toDate ? ts.toDate() : new Date(ts);
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
                    {/* Pomodoro Timer Toggle */}
                    <button
                        onClick={() => setIsPomodoroActive(!isPomodoroActive)}
                        className={`p-2 rounded-xl border transition flex items-center gap-1 text-xs font-bold ${
                            isPomodoroActive
                                ? 'bg-pink-500/20 border-pink-500/40 text-pink-300 animate-pulse'
                                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                        title="Group Pomodoro Focus Sync"
                    >
                        <Timer className="w-4 h-4 text-pink-400" />
                        <span className="hidden sm:inline">
                            {isPomodoroActive ? `${Math.floor(pomodoroSeconds / 60)}:${(pomodoroSeconds % 60).toString().padStart(2, '0')}` : 'Pomodoro'}
                        </span>
                    </button>

                    {/* Launch Poll Button */}
                    <button
                        onClick={() => setShowPollModal(true)}
                        className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition flex items-center gap-1 text-xs font-semibold"
                        title="Create Live MCQ Poll"
                    >
                        <BarChart2 className="w-4 h-4 text-amber-400" />
                    </button>

                    {/* Share Room Link */}
                    <button
                        onClick={handleShareRoomLink}
                        className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition text-xs font-semibold"
                        title="Share Room Link"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>

                    {/* Members Drawer */}
                    <button
                        onClick={() => setShowMembersDrawer(true)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition flex items-center gap-1.5 text-xs font-semibold"
                    >
                        <Users className="w-4 h-4 text-indigo-400" />
                        {isHost && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                </div>
            </div>

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

            {/* Live Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="py-20 text-center text-white/40 space-y-2">
                        <Users className="w-12 h-12 text-indigo-400/40 mx-auto" />
                        <h3 className="text-sm font-bold text-white">Live Study Room Open!</h3>
                        <p className="text-xs text-white/60">Voice note 🎙️, MCQ poll 📊, ya image bhej kar discussion shuru karein!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === currentUid;
                        return (
                            <div 
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                            >
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-[10px] text-white/40">
                                        {isMe ? 'You' : msg.senderName}
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
                                            <div className="p-2 rounded-full bg-indigo-500 text-white">
                                                <Mic className="w-4 h-4" />
                                            </div>
                                            <audio src={msg.audioUrl} controls className="h-8 max-w-[200px]" />
                                        </div>
                                    )}

                                    {/* Live MCQ Poll Card */}
                                    {msg.pollData && (
                                        <div className="p-3 rounded-xl bg-black/40 border border-amber-500/30 space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                                                <BarChart2 className="w-4 h-4 text-amber-400" />
                                                <span>Live MCQ Challenge</span>
                                            </div>
                                            <p className="text-xs font-bold text-white">{msg.pollData.question}</p>

                                            <div className="space-y-1.5 pt-1">
                                                {msg.pollData.options.map((opt, idx) => {
                                                    const totalVotes = Object.keys(msg.pollData?.votes || {}).length;
                                                    const optionVotes = Object.values(msg.pollData?.votes || {}).filter(v => v === idx).length;
                                                    const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                                    const hasVoted = msg.pollData?.votes?.[currentUid] === idx;

                                                    return (
                                                        <button
                                                            key={idx}
                                                            disabled={isRoomClosed}
                                                            onClick={() => handleVotePoll(msg.id, idx)}
                                                            className={`w-full p-2 rounded-xl text-left text-xs transition relative overflow-hidden flex items-center justify-between border ${
                                                                hasVoted
                                                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                                                            }`}
                                                        >
                                                            <div 
                                                                className="absolute left-0 top-0 bottom-0 bg-amber-500/20 pointer-events-none transition-all"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                            <span className="relative z-10 flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                                                    {String.fromCharCode(65 + idx)}
                                                                </span>
                                                                <span>{opt}</span>
                                                            </span>
                                                            <span className="relative z-10 text-[10px] font-mono text-amber-300">
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

            {/* Chat Input Bar */}
            {!isRoomClosed && (
                <form onSubmit={handleSendMessage} className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center gap-2">
                    {/* Voice Note Mic Button */}
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-2.5 rounded-xl border transition ${
                            isRecording 
                                ? 'bg-red-500 text-white animate-pulse border-red-400' 
                                : 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10'
                        }`}
                        title="Record Voice Note"
                    >
                        <Mic className="w-5 h-5" />
                    </button>

                    {/* Photo File Picker Trigger */}
                    <label className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-400 cursor-pointer transition">
                        <ImageIcon className="w-5 h-5" />
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>

                    {/* Text Message & Link Input */}
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type doubt, text message or link (https://...)"
                        className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-white/30"
                    />

                    {/* Send Button */}
                    <button
                        type="submit"
                        className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold hover:brightness-110 transition shadow-md"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            )}

            {/* Members & Admin Moderation Drawer Modal */}
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
                                            Room Members ({room.members?.length || 1} / {maxLimit})
                                        </h3>
                                        <p className="text-xs text-white/50">{room.name}</p>
                                    </div>
                                    <button onClick={() => setShowMembersDrawer(false)} className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
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
            </AnimatePresence>
        </motion.div>
    );
}
