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
            scheduleNeuralSolverResponseNotification(text.slice(0, 30) || 'Doubt Solution').catch(console.warn);
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
        <div className="fixed inset-0 bg-[#0a0f24] z-[2000] p-4 flex flex-col text-white select-none">
            <div className="flex justify-between items-center mb-4 bg-[#161e38] p-4 rounded-xl shadow-md text-white">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold">Neural Doubt Solver</h2>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 p-2" onClick={() => setSelectedMessageIndex(null)}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {selectedMessageIndex === i && i !== 0 && (
                          <button onClick={() => deleteMessage(i)} className="text-red-300 text-xs">Delete</button>
                        )}
                        <div onClick={(e) => { e.stopPropagation(); setSelectedMessageIndex(i); }} 
                             className={`p-3 px-4 rounded-2xl max-w-[80%] shadow-sm ${m.role === 'user' ? 'bg-blue-600 rounded-tr-none' : 'bg-[#161e38] rounded-tl-none'}`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                components={{
                                    u: ({node, ...props}) => <u className="text-red-500 font-bold" {...props} />
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

            <div className="flex gap-2 bg-[#161e38] p-3 rounded-full shadow-md">
                <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-transparent p-2 outline-none text-white" placeholder="Message..." />
                <button onClick={handleSend} className="bg-blue-600 text-white p-3 rounded-full"><Send size={20} /></button>
            </div>
        </div>
    );
}
