import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { X, Send, Loader2, Trash2 } from 'lucide-react';
import StatusLoader from './StatusLoader';
import { scheduleNeuralSolverResponseNotification } from '../utils/studyNotificationEngine';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getApiUrl, authFetch } from '@/utils/api';
import { enableScreenshot, disableScreenshot } from '../utils/screenSecurity';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function NeuralSolver({ onClose }: { onClose: () => void }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

    useEffect(() => {
        enableScreenshot();
        loadChat();
        return () => {
            disableScreenshot();
        };
    }, []);

    // Android Hardware Physical Back Button Handler
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (selectedMessageIndex !== null) {
                setSelectedMessageIndex(null);
                return true;
            }
            onClose();
            return true;
        });
        return unregister;
    }, [selectedMessageIndex, onClose]);

    useEffect(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, [messages]);

    const loadChat = async () => {
        if (!auth.currentUser) return;
        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'neural_chat');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().messages) {
                setMessages(docSnap.data().messages);
            }
        } catch (e) {
            handleFirestoreError(e, OperationType.GET, 'users/settings/neural_chat');
        }
    };

    const saveChat = async (msgs: Message[]) => {
        if (!auth.currentUser) return;
        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'neural_chat');
            await setDoc(docRef, { messages: msgs });
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'users/settings/neural_chat');
        }
    };

    const deleteMessage = async (index: number) => {
        const newMessages = messages.filter((_, i) => i !== index);
        setMessages(newMessages);
        saveChat(newMessages);
        setSelectedMessageIndex(null);
    };

    const handleClearHistory = async () => {
        if (!auth.currentUser) return;
        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'neural_chat');
            await deleteDoc(docRef);
            setMessages([]);
        } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'users/settings/neural_chat');
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user' as const, content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        saveChat(newMessages); // Save user message
        setInput('');
        setLoading(true);

        const assistantIndex = newMessages.length;
        setMessages([...newMessages, { role: 'assistant', content: '' }]);

        let fullText = '';
        try {
            const response = await authFetch(getApiUrl('/api/neural-chat'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ messages: newMessages })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data:')) continue;
                        const dataStr = trimmed.replace(/^data:\s*/, '');
                        if (dataStr === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.text) {
                                fullText += parsed.text;
                                setMessages(prev => {
                                    const next = [...prev];
                                    if (next[assistantIndex]) {
                                        next[assistantIndex] = { role: 'assistant', content: fullText };
                                    }
                                    return next;
                                });
                            }
                        } catch {
                            // Skip partial JSON parse errors
                        }
                    }
                }
            }

            if (!fullText.trim()) {
                fullText = "Sorry, error aa gaya. Study related pucho.";
            }

            const updatedMessages = [...newMessages, { role: 'assistant' as const, content: fullText }];
            setMessages(updatedMessages);
            saveChat(updatedMessages); // Save updated history
            scheduleNeuralSolverResponseNotification(fullText.slice(0, 30) || 'Doubt Solution').catch(console.warn);
        } catch (error) {
            console.error('[NeuralSolver] Streaming error:', error);
            const fallbackMessages = [...newMessages, { role: 'assistant' as const, content: "Sorry, error aa gaya. Study related pucho." }];
            setMessages(fallbackMessages);
            saveChat(fallbackMessages);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[2000] p-3 sm:p-5 flex flex-col text-white select-none backdrop-blur-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 bg-slate-900/80 border border-purple-500/30 p-3.5 px-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl text-white pt-[max(env(safe-area-inset-top,0px),14px)]">
                <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white transition-colors cursor-pointer border border-purple-500/20">
                    <X className="h-5 w-5" />
                </button>
                <div className="text-center">
                    <h2 className="font-black text-base sm:text-lg bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-blue-200 to-pink-300 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">Neural Doubt Solver</h2>
                    <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">AI NEET 24x7 Problem Solver</p>
                </div>
                <button onClick={handleClearHistory} title="Clear Chat" className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer border border-rose-500/30">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Chat Messages List */}
            <div className="flex-grow overflow-y-auto space-y-3.5 p-2" onClick={() => setSelectedMessageIndex(null)}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {selectedMessageIndex === i && i !== 0 && (
                          <button onClick={() => deleteMessage(i)} className="text-rose-400 text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-800/50 cursor-pointer shadow-md">Delete</button>
                        )}
                        <div onClick={(e) => { e.stopPropagation(); setSelectedMessageIndex(i); }} 
                             className={`p-3.5 px-4 sm:px-5 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-lg border text-sm sm:text-base leading-relaxed ${
                                 m.role === 'user' 
                                     ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 border-purple-400/40 text-white rounded-tr-none shadow-[0_0_20px_rgba(139,92,246,0.35)]' 
                                     : 'glass-card border-purple-500/25 text-slate-100 rounded-tl-none backdrop-blur-xl shadow-md'
                             }`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                components={{
                                    u: ({node, ...props}) => <u className="text-pink-400 font-bold" {...props} />
                                }}
                            >
                                {m.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
                {loading && (
                    <div className="self-start p-2 my-1">
                        <StatusLoader 
                            variant="solving" 
                            cycleLabels={["Neural Solving....", "Analyzing Doubt....", "Generating Solution...."]} 
                            size="md" 
                        />
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl p-2.5 px-4 rounded-3xl border border-purple-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    className="flex-1 bg-transparent px-2 py-1 outline-none text-white text-sm sm:text-base placeholder-slate-400 font-medium" 
                    placeholder="Ask any Physics, Chemistry, Biology doubt..." 
                />
                <button 
                    onClick={handleSend} 
                    disabled={!input.trim() || loading}
                    className="gradient-btn-primary p-3 rounded-2xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-white"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

