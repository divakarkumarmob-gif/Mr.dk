import React, { useState, useRef, useEffect } from 'react';
import { Mic, Keyboard, X, Send, Square } from 'lucide-react';
import { motion } from 'motion/react';

interface LiveAIInterfaceProps {
    onClose: () => void;
}

const suggestions = [
    "Explain Newton's Laws",
    "Help with Algebra",
    "Summarize Organic Chemistry",
    "Practise Biology MCQs"
];

export default function LiveAIInterface({ onClose }: LiveAIInterfaceProps) {
    const [isTypingMode, setIsTypingMode] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([
        {role: 'ai', content: "Hi! How can I help you with your studies today?"}
    ]);
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current.start();
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
        try {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
                const response = await fetch(`${backendUrl}/api/gemini`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Audio: base64Audio, prompt: "Transcribe and answer concisely." })
                });

                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                const aiResponse = data.text;
                setMessages(prev => [...prev, {role: 'user', content: "[Audio Input processed]"}]);
                setMessages(prev => [...prev, {role: 'ai', content: aiResponse}]);
                
                const utterThis = new SpeechSynthesisUtterance(aiResponse);
                utterThis.onstart = () => setIsSpeaking(true);
                utterThis.onend = () => setIsSpeaking(false);
                utterThis.lang = "hi-IN";
                window.speechSynthesis.speak(utterThis);
            };
        } catch (e) {
            console.error(e);
        }
    };

    const handleSendMessage = (text: string) => {
        if (!text.trim()) return;
        
        setMessages(prev => [...prev, {role: 'user', content: text}]);
        setInput("");
        
        setTimeout(() => {
            setMessages(prev => [...prev, {role: 'ai', content: `That's an interesting question about "${text}". Let me help you understand it better...`}]);
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-gradient-to-b from-[#1a1a40] to-[#0a0f24] text-white flex flex-col p-6 pb-12">
            <div className="w-full flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold">NeetMaster AI</h1>
                <button onClick={onClose} className="text-gray-400">
                    <X className="h-8 w-8" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto mb-6 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 ml-auto' : 'bg-white/10'}`}>
                        {m.content}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {!isTypingMode && (
                <div className="mb-8 w-full max-w-sm mx-auto text-center">
                    <p className="text-gray-400 mb-6">Suggested topics</p>
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {suggestions.map((s, i) => (
                            <button key={i} onClick={() => handleSendMessage(s)} className="bg-white/10 p-3 rounded-2xl text-xs font-medium hover:bg-white/20 transition-colors">
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="w-full flex justify-between items-center px-4 gap-4">
                {!isTypingMode ? (
                    <>
                        <button onClick={() => setIsTypingMode(true)} className="p-3 bg-white/10 rounded-full">
                            <Keyboard className="h-6 w-6" />
                        </button>
                        
                        <div className="flex flex-col items-center">
                            <button 
                                onClick={isRecording ? stopRecording : startRecording}
                                className="w-20 h-20 rounded-full relative z-50"
                            >
                                <motion.div 
                                    className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,orange,blue,green)]"
                                    animate={{ rotate: isRecording || isSpeaking ? 360 : 0 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                />
                                <motion.div 
                                    className="absolute inset-[2px] rounded-full bg-[#0a0f24] flex items-center justify-center"
                                    animate={{ scale: isRecording ? [1, 1.1, 1] : 1 }}
                                    transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
                                >
                                    {isRecording ? <Square className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                                </motion.div>
                            </button>
                            <span className="mt-4 text-sm font-medium">{isRecording ? "Listening..." : isSpeaking ? "Speaking..." : "Tap to talk"}</span>
                        </div>
                        <div className="w-12"></div> {/* Spacer */}
                    </>
                ) : (
                    <div className="flex w-full items-center gap-2 bg-white/10 rounded-full p-2">
                        <input 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                            className="flex-grow bg-transparent p-2 outline-none"
                            placeholder="Type a question..."
                        />
                        <button onClick={() => handleSendMessage(input)} className="p-2 bg-blue-600 rounded-full">
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
