import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Settings, RotateCcw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import ThinkingIndicator from './ThinkingIndicator';
import { getApiUrl } from '@/utils/api';

interface AIStudyPlanChatProps {
    onClose: () => void;
}

interface Message {
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp?: any;
}

const RESET_MARKER = '__CHAT_RESET__';
const MEMORY_DOC_PATH = (uid: string) => doc(db, `users/${uid}/ai-study-plan-memory/profile`);
const LOCAL_GREETING: Message = { role: 'ai', content: "Hi! 👋 Kuch bhi likh ke shuru karo." };

export default function AIStudyPlanChat({ onClose }: AIStudyPlanChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isAILoading, setIsAILoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [studentMemory, setStudentMemory] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Subscribe to chat history
    useEffect(() => {
        if (!auth.currentUser) return;
        const messagesRef = collection(db, `users/${auth.currentUser.uid}/ai-study-plan-chats`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = [];
            snapshot.forEach((doc) => {
                msgs.push(doc.data() as Message);
            });
            // Initial prompt if empty
            if (msgs.length === 0) {
                setMessages([LOCAL_GREETING]);
            } else {
                setMessages(msgs);
            }
        });
        return unsubscribe;
    }, []);

    // Load persistent student memory (long-term profile, survives resets)
    useEffect(() => {
        if (!auth.currentUser) return;
        const loadMemory = async () => {
            try {
                const snap = await getDoc(MEMORY_DOC_PATH(auth.currentUser!.uid));
                if (snap.exists()) {
                    setStudentMemory(snap.data().content || "");
                }
            } catch (e) {
                console.error("Failed to load student memory:", e);
            }
        };
        loadMemory();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isAILoading]);

    const saveMessage = async (role: 'user' | 'ai' | 'system', content: string) => {
        if (!auth.currentUser) return;
        await addDoc(collection(db, `users/${auth.currentUser.uid}/ai-study-plan-chats`), {
            role,
            content,
            timestamp: serverTimestamp()
        });
    };

    // Returns only the messages that should be sent to the AI as context —
    // i.e. everything after the most recent reset marker (or all messages if never reset),
    // excluding the local-only placeholder greeting (which was never saved to Firestore).
    const getContextMessages = (allMessages: Message[]) => {
        const realMessages = allMessages.filter(m => m !== LOCAL_GREETING);
        let lastResetIndex = -1;
        realMessages.forEach((m, i) => {
            if (m.role === 'system' && m.content === RESET_MARKER) {
                lastResetIndex = i;
            }
        });
        return realMessages
            .slice(lastResetIndex + 1)
            .filter(m => m.role !== 'system');
    };

    const saveMemory = async (content: string) => {
        if (!auth.currentUser || !content) return;
        setStudentMemory(content);
        try {
            await setDoc(MEMORY_DOC_PATH(auth.currentUser.uid), {
                content,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Failed to save student memory:", e);
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        setInput("");
        const userMessage: Message = { role: 'user', content: text };
        await saveMessage('user', text);
        setIsAILoading(true);

        try {
            const contextMessages = getContextMessages([...messages, userMessage]);
            const response = await fetch(getApiUrl('/api/gemini'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: contextMessages,
                    isStudyPlanChat: true,
                    studentMemory
                })
            });

            if (!response.ok) {
                throw new Error(`Server error (${response.status})`);
            }

            const data = await response.json();

            if (!data.text || !data.text.trim()) {
                throw new Error("Empty response from AI");
            }

            await saveMessage('ai', data.text);
            if (data.updatedMemory) {
                await saveMemory(data.updatedMemory);
            }
        } catch (e) {
            console.error(e);
            await saveMessage('ai', "⚠️ Kuch gadbad ho gayi, reply nahi mila. Please dobara try karo.");
        } finally {
            setIsAILoading(false);
        }
    };

    const handleResetAllData = async () => {
        setShowSettings(false);
        // Insert a hidden reset marker: chat history stays visible, but the AI's
        // conversation flow starts fresh from this point onward. Long-term memory is untouched.
        await saveMessage('system', RESET_MARKER);
        await saveMessage('system', '🔄 Chat reset ho gaya. Naye sire se shuru karte hain!');
    };

    const handleClearMemory = async () => {
        setShowSettings(false);
        setStudentMemory("");
        if (auth.currentUser) {
            try {
                await setDoc(MEMORY_DOC_PATH(auth.currentUser.uid), { content: "", updatedAt: serverTimestamp() });
            } catch (e) {
                console.error("Failed to clear student memory:", e);
            }
        }
        await saveMessage('system', '🧹 AI ki saari memory clear ho gayi. Ab AI tumhare baare me kuch nahi jaanta.');
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] text-white flex flex-col">
            {/* Header */}
            <div className="w-full flex justify-between items-center px-4 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3 border-b border-white/10">
                <h1 className="text-lg font-bold">NEET AI Planner</h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowSettings(true)} className="text-gray-300">
                        <Settings className="h-6 w-6" />
                    </button>
                    <button onClick={onClose} className="text-gray-400">
                        <X className="h-7 w-7" />
                    </button>
                </div>
            </div>

            {/* Chat messages - WhatsApp style */}
            <div className="flex-grow overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((m, i) => {
                    if (m.role === 'system') {
                        if (m.content === RESET_MARKER) return null;
                        return (
                            <div key={i} className="flex justify-center">
                                <span className="text-xs bg-white/10 text-gray-300 px-3 py-1 rounded-full">
                                    {m.content}
                                </span>
                            </div>
                        );
                    }
                    return (
                        <div key={i} className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 ml-auto rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                    );
                })}
                {isAILoading && (
                    <div className="p-3 rounded-2xl max-w-[85%] bg-white/10 rounded-bl-sm">
                        <ThinkingIndicator />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input bar - WhatsApp style */}
            <div className="w-full px-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] pt-2 bg-[#0f172a]/60 border-t border-white/10">
                <div className="w-full flex items-center gap-2 bg-[#1e293b] rounded-full p-1.5 pl-4">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                        className="flex-grow bg-transparent p-2 outline-none text-white placeholder-gray-400 text-sm"
                        placeholder="Message..."
                    />
                    <button onClick={() => handleSendMessage(input)} className={`p-3 rounded-full transition-colors ${input.trim() ? 'bg-blue-600' : 'bg-[#0f172a]'}`}>
                        <Send className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Settings popup */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[1100]" onClick={() => setShowSettings(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1e293b] w-full max-w-sm rounded-2xl p-5 border border-white/10"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold">Settings</h2>
                                <button onClick={() => setShowSettings(false)} className="text-gray-400">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <button
                                onClick={handleResetAllData}
                                className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition text-left p-4 rounded-xl mb-3"
                            >
                                <RotateCcw className="h-5 w-5 text-yellow-400" />
                                <div>
                                    <p className="font-semibold text-sm">Reset Chat</p>
                                    <p className="text-xs text-gray-400">Conversation fresh start hogi. Chat history yahin rahegi, lekin AI ki saved memory (goal, subjects, routine, etc.) safe rahegi.</p>
                                </div>
                            </button>

                            <button
                                onClick={handleClearMemory}
                                className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition text-left p-4 rounded-xl"
                            >
                                <Trash2 className="h-5 w-5 text-red-400" />
                                <div>
                                    <p className="font-semibold text-sm">Clear Memory</p>
                                    <p className="text-xs text-gray-400">AI tumhare baare me sab bhool jayega (goal, routine, subjects, etc.). Isse best hoga naya, fresh start.</p>
                                </div>
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
