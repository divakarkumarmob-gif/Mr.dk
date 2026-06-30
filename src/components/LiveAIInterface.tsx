import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Mic, Keyboard, X, Send, Square, Camera, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { stripLatexForTTS } from '../lib/utils';
import { getApiUrl } from '@/utils/api';

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
                const response = await fetch(getApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Audio: base64Audio, prompt: "Transcribe and answer concisely." })
                });

                if (!response.ok) throw new Error(`API error: ${response.statusText}`);
                const data = await response.json();
                const aiResponse = data.text;
                
                setMessages(prev => [...prev, {role: 'user', content: "[Audio Input processed]"}]);
                setMessages(prev => [...prev, {role: 'ai', content: aiResponse}]);
                
                const cleanedResponse = stripLatexForTTS(aiResponse);
                
                try {
                    const ttsResponse = await fetch(getApiUrl('/api/tts'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: cleanedResponse })
                    });

                    if (ttsResponse.ok) {
                        const audioBlob = await ttsResponse.blob();
                        const audio = new Audio(URL.createObjectURL(audioBlob));
                        audio.onplay = () => setIsSpeaking(true);
                        audio.onended = () => setIsSpeaking(false);
                        audio.play();
                    } else {
                        throw new Error("Server TTS failed");
                    }
                } catch (ttsErr) {
                    console.error("Server TTS error, falling back:", ttsErr);
                    // Fallback to robotic browser TTS
                    const utterThis = new SpeechSynthesisUtterance(cleanedResponse);
                    utterThis.onstart = () => setIsSpeaking(true);
                    utterThis.onend = () => setIsSpeaking(false);
                    utterThis.lang = "hi-IN";
                    window.speechSynthesis.speak(utterThis);
                }
            };
        } catch (e) {
            console.error(e);
        }
    };

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => setSelectedImage(null);

    const startVoiceTyping = () => {
        const recognition = new ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)();
        recognition.lang = 'en-IN'; // Changed to en-IN for Hinglish support
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + " " + transcript);
        };
        recognition.start();
    };

    const handleSparklesClick = () => {
        if (!input.trim() && !selectedImage) {
            setIsTypingMode(false);
            startRecording();
        } else {
            handleSendMessage(input);
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() && !selectedImage) return;
        
        setMessages(prev => [...prev, {role: 'user', content: selectedImage ? "[Image Input]" : text}]);
        setInput("");
        const imageToSend = selectedImage;
        setSelectedImage(null);
        
        try {
            const response = await fetch(getApiUrl('/api/gemini'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: text,
                    base64Image: imageToSend
                })
            });
            const data = await response.json();
            setMessages(prev => [...prev, {role: 'ai', content: data.text}]);
        } catch (e) {
            setMessages(prev => [...prev, {role: 'ai', content: "Sorry, I'm having trouble connecting to AI."}]);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-gradient-to-b from-[#1a1a40] to-[#0a0f24] text-white flex flex-col pt-[env(safe-area-inset-top,0px)] px-6 pb-12">
            <div className="w-full flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold">NeetMaster AI</h1>
                <button onClick={onClose} className="text-gray-400">
                    <X className="h-8 w-8" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto mb-6 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={`p-4 rounded-2xl max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 ml-auto' : 'bg-white/10'}`}>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>
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
                <div className="flex flex-col w-full gap-2">
                    {selectedImage && (
                        <div className="relative w-16 h-16 ml-4">
                            <img src={selectedImage} alt="preview" className="w-full h-full object-cover rounded-lg" />
                            <button onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X className="h-3 w-3"/></button>
                        </div>
                    )}
                    <div className="flex w-full items-center gap-1 sm:gap-2 bg-[#161e38] rounded-full p-1.5 sm:p-2 pl-3 sm:pl-5">
                        <input 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                            className="flex-grow min-w-0 bg-transparent p-1 sm:p-2 outline-none text-white placeholder-gray-400 text-sm"
                            placeholder="Ask anything"
                        />
                        <button className="p-1.5 sm:p-2 text-white/70 hover:text-blue-400 shrink-0" onClick={startVoiceTyping}>
                            <Mic className="h-5 w-5" />
                        </button>
                        <button className="p-1.5 sm:p-2 text-white/70 hover:text-blue-400 shrink-0">
                             <input type="file" className="hidden" accept="image/*" id="file-upload" onChange={handleImageChange} />
                             <label htmlFor="file-upload" className="cursor-pointer">
                                <Camera className="h-5 w-5" />
                             </label>
                        </button>
                        <button onClick={handleSparklesClick} className={`p-3 sm:p-4 rounded-full transition-colors shrink-0 ${input.trim() || selectedImage ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-[#0a0f24]'}`}>
                            {input.trim() || selectedImage ? <Send className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
