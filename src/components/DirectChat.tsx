import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, X, 
    Camera, Phone, Video, Shield, Sparkles, User, Circle
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, setDoc, getDoc, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';

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

    // Target User Real Presence State (No fake status)
    const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: any }>({
        isOnline: false,
        lastSeen: null
    });

    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || 'user_local_' + Date.now();
    const currentName = currentUser?.displayName || 'NEET Aspirant';

    // Deterministic 1v1 Chat ID (Sorted UIDs)
    const chatId = [currentUid, targetUser.uid].sort().join('_direct_');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Auto Scroll to Latest Message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update Current User's Own Online Presence in Firestore
    useEffect(() => {
        if (!currentUid) return;
        const userRef = doc(db, 'users', currentUid);
        setDoc(userRef, {
            online: true,
            lastSeen: serverTimestamp()
        }, { merge: true }).catch(() => {});

        // On unmount / tab close
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

    // Subscribe to Target User's REAL Presence Status from Firestore (Real Online / Last Seen)
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
    useEffect(() => {
        let unsubscribe = () => {};
        try {
            const q = query(collection(db, 'directChats', chatId, 'messages'), orderBy('timestamp', 'asc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetched: DirectMessage[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data()
                } as DirectMessage));

                // Merge with local fallback
                const localMsgs = getLocalDirectMessages(chatId);
                const map = new Map<string, DirectMessage>();
                [...fetched, ...localMsgs].forEach(m => map.set(m.id, m));

                const sortedMsgs = Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
                setMessages(getLocalDirectMessages(chatId));
            });
        } catch (e) {
            setMessages(getLocalDirectMessages(chatId));
        }

        return () => unsubscribe();
    }, [chatId, currentUid]);

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

    // Send Message Handler
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && !imageUrl.trim()) return;

        // If recipient is online, initial status is 'delivered' (double grey tick); otherwise 'sent' (single grey tick)
        const initialStatus: 'sent' | 'delivered' = presence.isOnline ? 'delivered' : 'sent';

        const newMsg: DirectMessage = {
            id: 'dmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            senderId: currentUid,
            senderName: currentName,
            text: text.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            status: initialStatus,
            timestamp: new Date().toISOString()
        };

        // Optimistic State Update
        setMessages(prev => [...prev, newMsg]);
        saveLocalDirectMessage(newMsg);

        const textToSend = text.trim();
        setText('');
        setImageUrl('');

        // Save Message to Firestore
        try {
            await addDoc(collection(db, 'directChats', chatId, 'messages'), {
                senderId: currentUid,
                senderName: currentName,
                text: textToSend || '',
                imageUrl: newMsg.imageUrl || '',
                status: initialStatus,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, 'directChats', chatId), {
                lastMessage: textToSend || 'Photo attachment',
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.warn("Firestore direct message error:", e);
        }
    };

    // File Upload Handler for Photo Attachments
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            showToast('Photo attached! Tap Send. 📸');
        };
        reader.readAsDataURL(file);
    };

    // Format Timestamp
    const formatTime = (ts: any) => {
        if (!ts) return '';
        try {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    // Format Real Last Seen Date
    const formatLastSeen = (ts: any) => {
        if (!ts) return 'Offline';
        try {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            return `Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
            return 'Offline';
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col font-sans overflow-hidden"
        >
            {/* Header: Target User Profile & REAL Presence Status */}
            <div className="bg-[#0c1222]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-xl">
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
                    <button 
                        onClick={() => showToast('Voice calling feature coming soon!')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition"
                    >
                        <Phone className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Private 1v1 Encryption Notice */}
            <div className="px-4 py-1.5 bg-indigo-950/40 border-b border-indigo-500/20 text-center">
                <span className="text-[10px] text-indigo-300/80 font-medium flex items-center justify-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Private 1v1 Direct Message • Real-time Sync & Ticks</span>
                </span>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                                <div className={`max-w-[82%] sm:max-w-[70%] p-3 rounded-2xl space-y-2 ${
                                    isMe 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-lg' 
                                        : 'bg-[#0c1222] border border-white/10 text-white/90 rounded-bl-none shadow-md'
                                }`}>
                                    {/* Message Text */}
                                    {msg.text && (
                                        <p className="text-xs leading-relaxed whitespace-pre-line font-sans">
                                            {msg.text}
                                        </p>
                                    )}

                                    {/* Attached Image */}
                                    {msg.imageUrl && (
                                        <div 
                                            onClick={() => setActiveMediaUrl(msg.imageUrl!)}
                                            className="rounded-xl overflow-hidden cursor-pointer max-h-60 border border-white/10 bg-black/40"
                                        >
                                            <img 
                                                src={msg.imageUrl} 
                                                alt="Attached Photo" 
                                                className="w-full h-full object-cover hover:scale-102 transition" 
                                            />
                                        </div>
                                    )}

                                    {/* Message Timestamp & WhatsApp Ticks Indicator */}
                                    <div className="flex items-center justify-end gap-1 text-[9px] text-white/60 pt-0.5">
                                        <span>{formatTime(msg.timestamp)}</span>
                                        {isMe && (
                                            <span className="ml-0.5">
                                                {msg.status === 'read' ? (
                                                    <span title="Read (Blue Ticks)"><CheckCheck className="w-3.5 h-3.5 text-blue-400 font-bold" /></span>
                                                ) : msg.status === 'delivered' ? (
                                                    <span title="Delivered (Double Ticks)"><CheckCheck className="w-3.5 h-3.5 text-white/60" /></span>
                                                ) : (
                                                    <span title="Sent (Single Tick)"><Check className="w-3.5 h-3.5 text-white/40" /></span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Photo Attachment Preview Strip */}
            {imageUrl && (
                <div className="px-4 py-2 bg-indigo-950/80 border-t border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={imageUrl} alt="Attached Preview" className="w-10 h-10 object-cover rounded-lg border border-white/20" />
                        <span className="text-xs text-indigo-200 font-semibold">Photo Attached! Tap Send to share. 📸</span>
                    </div>
                    <button onClick={() => setImageUrl('')} className="p-1 text-white/60 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 bg-[#0c1222] border-t border-white/10 flex items-center gap-2">
                <label className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-400 cursor-pointer transition">
                    <ImageIcon className="w-5 h-5" />
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>

                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${targetUser.name}...`}
                    className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-white/30"
                />

                <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold hover:brightness-110 transition shadow-md"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>

            {/* Zoom Media Modal */}
            {activeMediaUrl && (
                <div onClick={() => setActiveMediaUrl(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                    <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
                        <X className="w-8 h-8" />
                    </button>
                    <img src={activeMediaUrl} alt="Enlarged Photo" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}
        </motion.div>
    );
}
