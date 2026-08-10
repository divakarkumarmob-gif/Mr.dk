import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, Search, MessageSquare, Shield, CheckCheck, Check, 
    Circle, Sparkles, User, Image as ImageIcon, Mic, X, Filter, UserPlus,
    Volume2, VolumeX, BellOff, Trash2, Ban, UserX, CheckCircle2, MoreVertical
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, limit, doc, getDoc, getDocs, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';
import { DirectUser } from './DirectChat';

interface DirectMessagesInboxProps {
    onBack: () => void;
    onSelectUser: (user: DirectUser) => void;
}

interface ChatConversation {
    chatId: string;
    otherUid: string;
    otherName: string;
    otherPhoto?: string;
    otherBadge?: string;
    isOnline?: boolean;
    lastSeen?: any;
    lastMessageText?: string;
    lastMessageSenderId?: string;
    lastMessageTimestamp?: any;
    lastMessageType?: 'text' | 'image' | 'audio' | 'poll';
    unreadCount: number;
    lastMessageStatus?: 'sent' | 'read';
}

export default function DirectMessagesInbox({ onBack, onSelectUser }: DirectMessagesInboxProps) {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'online'>('all');
    const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
    const [allUsersList, setAllUsersList] = useState<DirectUser[]>([]);
    const [userSearchQuery, setUserSearchQuery] = useState<string>('');
    const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

    const [currentUid, setCurrentUid] = useState<string>(() => {
        if (auth.currentUser?.uid) return auth.currentUser.uid;
        try {
            const guest = localStorage.getItem('guest_user');
            if (guest) return JSON.parse(guest).uid;
            const cached = localStorage.getItem('neetmaster_cached_user');
            if (cached) return JSON.parse(cached).uid;
        } catch {}
        return '';
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user?.uid) {
                setCurrentUid(user.uid);
            } else {
                try {
                    const guest = localStorage.getItem('guest_user');
                    if (guest) {
                        setCurrentUid(JSON.parse(guest).uid);
                        return;
                    }
                } catch {}
                setCurrentUid('');
            }
        });
        return () => unsubscribe();
    }, []);

    // Long Press Context Menu & Mute States
    const [selectedChatMenu, setSelectedChatMenu] = useState<ChatConversation | null>(null);
    const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());

    const chatPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleChatPressStart = (chat: ChatConversation) => {
        chatPressTimerRef.current = setTimeout(() => {
            if (window.navigator?.vibrate) {
                window.navigator.vibrate(35);
            }
            setSelectedChatMenu(chat);
        }, 450);
    };

    const handleChatPressEnd = () => {
        if (chatPressTimerRef.current) {
            clearTimeout(chatPressTimerRef.current);
            chatPressTimerRef.current = null;
        }
    };

    // Realtime Listener for Muted Chats Subcollection
    useEffect(() => {
        if (!currentUid) return;
        const mutedRef = collection(db, 'users', currentUid, 'mutedChats');
        const unsubscribe = onSnapshot(mutedRef, (snapshot) => {
            const set = new Set<string>();
            snapshot.docs.forEach(d => set.add(d.id));
            setMutedUserIds(set);
        }, (err) => {
            console.warn("Muted chats listener error:", err);
        });
        return () => unsubscribe();
    }, [currentUid]);

    // Toggle Mute / Unmute Chat Notifications
    const handleToggleMuteChat = async (targetUid: string, targetName: string) => {
        if (!currentUid) return;
        const isMuted = mutedUserIds.has(targetUid);
        const muteDocRef = doc(db, 'users', currentUid, 'mutedChats', targetUid);

        try {
            if (isMuted) {
                await deleteDoc(muteDocRef);
                showToast(`${targetName} unmuted 🔔`);
            } else {
                await setDoc(muteDocRef, { mutedAt: serverTimestamp() });
                showToast(`${targetName} muted for notifications 🔕`);
            }
            setSelectedChatMenu(null);
        } catch (e) {
            console.error("Mute toggle error:", e);
            showToast("Failed to update mute status");
        }
    };

    // Block User
    const handleBlockUserFromInbox = async (targetUid: string, targetName: string) => {
        if (!currentUid) return;
        try {
            const blockRef = doc(db, 'users', currentUid, 'blockedUsers', targetUid);
            await setDoc(blockRef, { blockedAt: serverTimestamp() });
            showToast(`${targetName} blocked 🚫`);
            setSelectedChatMenu(null);
        } catch (e) {
            console.error("Block user error:", e);
            showToast("Failed to block user");
        }
    };

    // Delete Chat
    const handleDeleteChat = async (chatId: string, targetName: string) => {
        if (!currentUid || !chatId) return;
        try {
            await deleteDoc(doc(db, 'directChats', chatId));
            setConversations(prev => prev.filter(c => c.chatId !== chatId));
            showToast(`Chat with ${targetName} deleted 🗑️`);
            setSelectedChatMenu(null);
        } catch (e) {
            console.error("Delete chat error:", e);
            showToast("Failed to delete chat");
        }
    };

    // Register Android hardware back button
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (showNewChatModal) {
                setShowNewChatModal(false);
                return true;
            }
            onBack();
            return true;
        });
        return unregister;
    }, [showNewChatModal, onBack]);

    // Subscribe to all 1v1 conversations where currentUser is a participant
    useEffect(() => {
        if (!currentUid) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'directChats'),
            where('participants', 'array-contains', currentUid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatListPromises = snapshot.docs.map(async (chatDoc) => {
                const data = chatDoc.data();
                const chatId = chatDoc.id;
                const participants: string[] = data.participants || [];
                const otherUid = participants.find(id => id !== currentUid) || currentUid;

                // Fetch recipient user details
                let otherName = 'NEET Aspirant';
                let otherPhoto = undefined;
                let otherBadge = undefined;
                let isOnline = false;
                let lastSeen = null;

                try {
                    const userSnap = await getDoc(doc(db, 'users', otherUid));
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        otherName = uData.name || uData.displayName || 'NEET Aspirant';
                        otherPhoto = uData.photoURL;
                        lastSeen = uData.lastSeen;
                        const lastSeenMs = uData.lastSeen ? (
                            typeof uData.lastSeen === 'number' ? uData.lastSeen :
                            typeof uData.lastSeen === 'string' ? new Date(uData.lastSeen).getTime() :
                            uData.lastSeen.toDate ? uData.lastSeen.toDate().getTime() :
                            uData.lastSeen.seconds ? uData.lastSeen.seconds * 1000 : 0
                        ) : 0;
                        const isFresh = lastSeenMs > 0 && (Date.now() - lastSeenMs < 45000);
                        isOnline = !!(uData.online && isFresh);
                    }
                } catch (e) {}

                // Fetch latest message & calculate unread count
                let lastMessageText = data.lastMessage || '';
                let lastMessageSenderId = data.lastMessageSenderId || '';
                let lastMessageTimestamp = data.lastMessageTimestamp || data.updatedAt;
                let lastMessageType: 'text' | 'image' | 'audio' | 'poll' = 'text';
                let unreadCount = 0;
                let lastMessageStatus: 'sent' | 'read' = 'sent';

                try {
                    const msgsQ = query(
                        collection(db, 'directChats', chatId, 'messages'),
                        orderBy('timestamp', 'desc'),
                        limit(20)
                    );
                    const msgsSnap = await getDocs(msgsQ);
                    if (!msgsSnap.empty) {
                        const topMsg = msgsSnap.docs[0].data();
                        lastMessageSenderId = topMsg.senderId;
                        lastMessageTimestamp = topMsg.timestamp || lastMessageTimestamp;
                        lastMessageStatus = topMsg.status === 'read' ? 'read' : 'sent';

                        if (topMsg.imageUrl) {
                            lastMessageType = 'image';
                            lastMessageText = '📷 Photo';
                        } else if (topMsg.audioUrl) {
                            lastMessageType = 'audio';
                            lastMessageText = '🎤 Voice Note';
                        } else if (topMsg.pollData) {
                            lastMessageType = 'poll';
                            lastMessageText = '📊 MCQ Poll';
                        } else if (topMsg.text) {
                            let textVal = topMsg.text;
                            if (textVal.startsWith('🔒E2EE:v2:')) textVal = '🔒 Encrypted Message';
                            else if (textVal.startsWith('🔒E2EE:v1:') || textVal.startsWith('🔒ENC:')) textVal = '🔒 Message';
                            lastMessageText = textVal;
                        }

                        // Calculate unread count
                        msgsSnap.docs.forEach(mDoc => {
                            const mData = mDoc.data();
                            if (mData.senderId !== currentUid && mData.status !== 'read') {
                                unreadCount++;
                            }
                        });
                    }
                } catch (e) {}

                return {
                    chatId,
                    otherUid,
                    otherName,
                    otherPhoto,
                    otherBadge,
                    isOnline,
                    lastSeen,
                    lastMessageText,
                    lastMessageSenderId,
                    lastMessageTimestamp,
                    lastMessageType,
                    unreadCount,
                    lastMessageStatus
                } as ChatConversation;
            });

            Promise.all(chatListPromises).then(results => {
                // Sort by last message timestamp descending
                results.sort((a, b) => {
                    const tA = getTimestampMs(a.lastMessageTimestamp);
                    const tB = getTimestampMs(b.lastMessageTimestamp);
                    return tB - tA;
                });
                setConversations(results);
                setLoading(false);
            });
        }, (err) => {
            console.warn('Inbox subscription error:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUid]);

    // Fetch all users for "Start New Chat" modal
    const handleOpenNewChatModal = async () => {
        setShowNewChatModal(true);
        setLoadingUsers(true);
        try {
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
            const list: DirectUser[] = [];
            usersSnap.docs.forEach(uDoc => {
                if (uDoc.id !== currentUid) {
                    const data = uDoc.data();
                    list.push({
                        uid: uDoc.id,
                        name: data.name || data.displayName || 'NEET Aspirant',
                        photoURL: data.photoURL,
                        badge: data.userBadge || data.role
                    });
                }
            });
            setAllUsersList(list);
        } catch (e) {
            console.error('Failed to fetch users:', e);
        } finally {
            setLoadingUsers(false);
        }
    };

    const getTimestampMs = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.seconds === 'number') return ts.seconds * 1000;
        const parsed = new Date(ts).getTime();
        return isNaN(parsed) ? 0 : parsed;
    };

    const formatTimeLabel = (ts: any): string => {
        const ms = getTimestampMs(ts);
        if (!ms) return '';
        const d = new Date(ms);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter conversations
    const filteredConversations = conversations.filter(c => {
        const matchesQuery = c.otherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (c.lastMessageText && c.lastMessageText.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesQuery) return false;
        if (activeTab === 'unread') return c.unreadCount > 0;
        if (activeTab === 'online') return !!c.isOnline;
        return true;
    });

    const filteredNewChatUsers = allUsersList.filter(u => 
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-50 bg-[#060913] text-white flex flex-col font-sans overflow-hidden"
        >
            {/* Ambient Vibrant Blurred Glowing Spheres (Red, Blue, Pink) */}
            <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-red-600/20 blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/20 blur-[140px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-pink-600/20 blur-[130px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Header: WhatsApp-Style Glassy Navbar */}
            <div 
                className="relative z-10 bg-[#0a0f1d]/80 backdrop-blur-2xl border-b border-white/10 px-4 pb-3 flex items-center justify-between shadow-2xl"
                style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
            >
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 transition active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                            <span>Chat List</span>
                        </h1>
                        <p className="text-xs text-blue-300/70 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-400" />
                            <span>End-to-End Encrypted Private Inbox</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleOpenNewChatModal}
                    className="p-2.5 rounded-2xl bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-pink-500/25 hover:brightness-110 transition active:scale-95 flex items-center gap-1.5 border border-white/20"
                    title="Start New Chat"
                >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">New Chat</span>
                </button>
            </div>

            {/* Search Bar & Glassy Filter Tabs */}
            <div className="relative z-10 px-4 pt-3 pb-2 space-y-3 bg-[#080d19]/60 backdrop-blur-md border-b border-white/5">
                {/* Search Input */}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-blue-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search conversations, names or messages..."
                        className="w-full bg-[#0c1324]/80 border border-white/10 focus:border-pink-500/60 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition backdrop-blur-md"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filter Tabs (All / Unread / Online) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {[
                        { id: 'all', label: '💬 All Chats', count: conversations.length },
                        { id: 'unread', label: '🔥 Unread', count: conversations.filter(c => c.unreadCount > 0).length },
                        { id: 'online', label: '⚡ Online Now', count: conversations.filter(c => c.isOnline).length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 text-white shadow-lg shadow-pink-500/30 border border-white/30'
                                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                    activeTab === tab.id ? 'bg-black/30 text-white' : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chat Conversations List */}
            <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-10 h-10 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-slate-400">Loading your E2EE chats...</p>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 max-w-sm mx-auto">
                        <div className="p-4 rounded-3xl bg-gradient-to-br from-red-500/10 via-pink-500/10 to-blue-500/10 border border-pink-500/30 text-pink-400 shadow-2xl">
                            <MessageSquare className="w-10 h-10" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1">
                                {searchQuery ? 'No matching chats found' : 'No direct conversations yet'}
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {searchQuery 
                                    ? 'Try searching with a different user name.' 
                                    : 'Community me kisi bhi student ke profile par click karke 1v1 private encrypted message shuru karein.'
                                }
                            </p>
                        </div>
                        <button
                            onClick={handleOpenNewChatModal}
                            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 font-bold text-xs text-white shadow-xl shadow-pink-500/30 hover:scale-105 transition"
                        >
                            + Start New Conversation
                        </button>
                    </div>
                ) : (
                    filteredConversations.map((chat) => {
                        const isMyLastMessage = chat.lastMessageSenderId === currentUid;
                        return (
                            <motion.div
                                key={chat.chatId}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onTouchStart={() => handleChatPressStart(chat)}
                                onTouchEnd={handleChatPressEnd}
                                onMouseDown={() => handleChatPressStart(chat)}
                                onMouseUp={handleChatPressEnd}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setSelectedChatMenu(chat);
                                }}
                                onClick={() => onSelectUser({
                                    uid: chat.otherUid,
                                    name: chat.otherName,
                                    photoURL: chat.otherPhoto,
                                    badge: chat.otherBadge
                                })}
                                className="group relative p-3.5 rounded-2xl bg-[#0c1324]/70 hover:bg-[#111b33]/90 border border-white/10 hover:border-pink-500/40 transition-all duration-200 shadow-lg cursor-pointer backdrop-blur-xl flex items-center justify-between gap-3 overflow-hidden select-none"
                            >
                                {/* Left Side: Glowing Ambient Hover Accent Line */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-pink-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* Avatar with Online Ring */}
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-tr from-red-500/20 via-pink-500/20 to-blue-500/20 border border-white/20 p-0.5 flex items-center justify-center">
                                        {chat.otherPhoto ? (
                                            <img src={chat.otherPhoto} alt={chat.otherName} className="w-full h-full object-cover rounded-xl" />
                                        ) : (
                                            <div className="w-full h-full bg-[#162038] rounded-xl flex items-center justify-center text-pink-400 font-extrabold text-lg">
                                                {chat.otherName.substring(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    {chat.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#060913] shadow-md animate-pulse" />
                                    )}
                                </div>

                                {/* Center: User Name, Badge & Last Message Snippet */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-pink-300 transition flex items-center gap-1.5">
                                            <span>{chat.otherName}</span>
                                            {mutedUserIds.has(chat.otherUid) && (
                                                <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            )}
                                        </h3>
                                        <span className="px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-semibold border border-indigo-500/30 shrink-0">
                                            {chat.otherBadge || 'NEET Aspirant'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-slate-300/80 truncate">
                                        {isMyLastMessage && (
                                            chat.lastMessageStatus === 'read' ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1] shrink-0 stroke-[2.5]" />
                                            ) : (
                                                <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            )
                                        )}

                                        {chat.lastMessageType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                                        {chat.lastMessageType === 'audio' && <Mic className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                        {chat.lastMessageType === 'poll' && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}

                                        <span className={`truncate ${chat.unreadCount > 0 ? 'font-bold text-white' : 'font-normal'}`}>
                                            {chat.lastMessageText || 'Tap to start conversation'}
                                        </span>
                                    </div>
                                </div>

                                {/* Right Side: Time Label & Unread Badge Counter */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <span className="text-[10px] font-semibold text-slate-400">
                                        {formatTimeLabel(chat.lastMessageTimestamp)}
                                    </span>

                                    {chat.unreadCount > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-black shadow-lg shadow-pink-500/40 animate-bounce">
                                            {chat.unreadCount}
                                        </span>
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-blue-500/20 opacity-0 group-hover:opacity-100 transition" />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Start New Chat Modal */}
            <AnimatePresence>
                {showNewChatModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#0c1222] border border-pink-500/40 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[80vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
                                <div>
                                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                        <UserPlus className="w-4 h-4 text-pink-400" />
                                        <span>Start New 1v1 Chat</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400">Select any student to start an encrypted chat</p>
                                </div>
                                <button onClick={() => setShowNewChatModal(false)} className="p-1 text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-pink-400" />
                                <input
                                    type="text"
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    placeholder="Search by student name..."
                                    className="w-full bg-[#141d33] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {loadingUsers ? (
                                    <div className="py-10 text-center text-xs text-slate-400">Loading aspirants list...</div>
                                ) : filteredNewChatUsers.length === 0 ? (
                                    <div className="py-10 text-center text-xs text-slate-400">No students found.</div>
                                ) : (
                                    filteredNewChatUsers.map((u) => (
                                        <div
                                            key={u.uid}
                                            onClick={() => {
                                                setShowNewChatModal(false);
                                                onSelectUser(u);
                                            }}
                                            className="p-2.5 rounded-xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/40 transition cursor-pointer flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 font-bold text-sm overflow-hidden">
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover rounded-xl" />
                                                    ) : (
                                                        u.name.substring(0, 1).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-white">{u.name}</h4>
                                                    <span className="text-[10px] text-indigo-300">{u.badge || 'NEET Aspirant'}</span>
                                                </div>
                                            </div>
                                            <button className="px-3 py-1 rounded-lg bg-pink-500/20 text-pink-300 font-bold text-[10px] border border-pink-500/40">
                                                Chat
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* WhatsApp Style Glassy Chat Action Popup Modal */}
            <AnimatePresence>
                {selectedChatMenu && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedChatMenu(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-xs bg-[#0c1222]/95 border border-white/20 rounded-3xl p-4 shadow-2xl space-y-2 text-white backdrop-blur-xl"
                        >
                            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 font-bold text-sm shrink-0">
                                    {selectedChatMenu.otherPhoto ? (
                                        <img src={selectedChatMenu.otherPhoto} alt={selectedChatMenu.otherName} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedChatMenu.otherName.substring(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-sm text-white truncate">{selectedChatMenu.otherName}</h4>
                                    <p className="text-[11px] text-slate-400 truncate">{selectedChatMenu.otherBadge || 'NEET Aspirant'}</p>
                                </div>
                                <button onClick={() => setSelectedChatMenu(null)} className="p-1 rounded-full text-slate-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-1 pt-1">
                                {/* Mute Notifications Toggle */}
                                <button
                                    onClick={() => handleToggleMuteChat(selectedChatMenu.otherUid, selectedChatMenu.otherName)}
                                    className="w-full px-4 py-3 rounded-2xl hover:bg-white/10 transition flex items-center justify-between text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-3 text-amber-300">
                                        {mutedUserIds.has(selectedChatMenu.otherUid) ? (
                                            <>
                                                <Volume2 className="w-4 h-4 text-emerald-400" />
                                                <span>Unmute Notifications</span>
                                            </>
                                        ) : (
                                            <>
                                                <BellOff className="w-4 h-4 text-amber-400" />
                                                <span>Mute Notifications</span>
                                            </>
                                        )}
                                    </span>
                                </button>

                                {/* Block User */}
                                <button
                                    onClick={() => handleBlockUserFromInbox(selectedChatMenu.otherUid, selectedChatMenu.otherName)}
                                    className="w-full px-4 py-3 rounded-2xl hover:bg-white/10 transition flex items-center justify-between text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-3 text-red-300">
                                        <Ban className="w-4 h-4 text-red-400" />
                                        <span>Block {selectedChatMenu.otherName}</span>
                                    </span>
                                </button>

                                {/* Delete Chat */}
                                <button
                                    onClick={() => handleDeleteChat(selectedChatMenu.chatId, selectedChatMenu.otherName)}
                                    className="w-full px-4 py-3 rounded-2xl hover:bg-red-500/20 text-red-400 transition flex items-center justify-between text-xs font-bold border-t border-white/10 mt-1"
                                >
                                    <span className="flex items-center gap-3">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                        <span>Delete Chat</span>
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
