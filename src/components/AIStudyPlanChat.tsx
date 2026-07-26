import React, { useState, useRef, useEffect } from 'react';
import { Mic, Keyboard, X, Send, Square, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import ThinkingIndicator from './ThinkingIndicator';
import { getApiUrl } from '@/utils/api';

interface AIStudyPlanChatProps {
    onClose: () => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp?: any;
}

export default function AIStudyPlanChat({ onClose }: AIStudyPlanChatProps) {
    const [isTypingMode, setIsTypingMode] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    
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
                setMessages([{role: 'ai', content: "Hi! I am your personalized NEET Study Planner. 📅 \n\nTell me about your daily routine, your strongest and weakest subjects, and how many hours you can dedicate to study."}]);
            } else {
                setMessages(msgs);
            }
        });
        return unsubscribe;
    }, []);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const saveMessage = async (role: 'user' | 'ai', content: string) => {
        if (!auth.currentUser) return;
        await addDoc(collection(db, `users/${auth.currentUser.uid}/ai-study-plan-chats`), {
            role,
            content,
            timestamp: serverTimestamp()
        });
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;
        
        setInput("");
        await saveMessage('user', text);
        setIsAILoading(true);
        
        try {
            const response = await fetch(getApiUrl('/api/gemini'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: [...messages, {role: 'user', content: text}]
                })
            });
            const data = await response.json();
            await saveMessage('ai', data.text);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAILoading(false);
        }
    };
    
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder; // Set ref
            const audioChunks: Blob[] = [];
            
            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                await processAudio(audioBlob);
            };
            
            mediaRecorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error(`Error recording: ${e}`);
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const processAudio = async (audioBlob: Blob) => {
        setIsAILoading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                await saveMessage('user', '[Audio Input]');

                const response = await fetch(getApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        base64Audio,
                        messages: [...messages, { role: 'user', content: '[Audio Input]' }]
                    })
                });

                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                const aiResponse = data.text;
                
                await saveMessage('ai', aiResponse);
                
                const utterThis = new SpeechSynthesisUtterance(aiResponse);
                utterThis.onstart = () => setIsSpeaking(true);
                utterThis.onend = () => setIsSpeaking(false);
                utterThis.lang = "en-IN";
                window.speechSynthesis.speak(utterThis);
            };
        } catch (e) {
            console.error(e);
        } finally {
            setIsAILoading(false);
        }
    };
    return (
        <div className="fixed inset-0 z-[1000] bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] text-white flex flex-col p-6 pb-12">
            <div className="w-full flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold">NEET AI Planner</h1>
                <button onClick={onClose} className="text-gray-400">
                    <X className="h-8 w-8" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto mb-6 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={`p-4 rounded-2xl max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 ml-auto' : 'bg-white/10'}`}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                ))}
                {isAILoading && (
                    <div className="p-4 rounded-2xl max-w-[85%] bg-white/10">
                        <ThinkingIndicator />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="w-full flex justify-center items-center gap-4">
                {!isTypingMode ? (
                    <div className="flex flex-col items-center w-full">
                        <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className="w-20 h-20 rounded-full relative z-50 mb-4"
                        >
                            <motion.div 
                                className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,orange,blue,green)]"
                                animate={{ rotate: isRecording || isSpeaking ? 360 : 0 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.div 
                                className="absolute inset-[2px] rounded-full bg-[#0f172a] flex items-center justify-center"
                                animate={{ scale: isRecording ? [1, 1.1, 1] : 1 }}
                                transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
                            >
                                {isRecording ? <Square className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                            </motion.div>
                        </button>
                        <span className="text-sm font-medium">{isRecording ? "Listening..." : isSpeaking ? "Speaking..." : "Tap to talk plan"}</span>
                        <button onClick={() => setIsTypingMode(true)} className="mt-4 text-blue-300 underline">Switch to typing</button>
                    </div>
                ) : (
                <div className="w-full flex items-center gap-2 bg-[#1e293b] rounded-full p-2 pl-5">
                    <input 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                        className="flex-grow bg-transparent p-2 outline-none text-white placeholder-gray-400"
                        placeholder="Type your study routine..."
                    />
                    <button onClick={() => handleSendMessage(input)} className={`p-4 rounded-full transition-colors ${input.trim() ? 'bg-blue-600' : 'bg-[#0f172a]'}`}>
                        <Send className="h-5 w-5" />
                    </button>
                </div>
                )}
            </div>
        </div>
    );
}