import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Mic, Square } from 'lucide-react';
import { stripLatexForTTS } from '../lib/utils';
import { getApiUrl } from '@/utils/api';

const FloatingAIAgent: React.FC<{onNavigate: (view: 'liveAI') => void, isTyping: boolean}> = ({ onNavigate, isTyping }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [aiText, setAiText] = useState("");
    const [status, setStatus] = useState("Tap to start recording");
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [volume, setVolume] = useState(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const scale = useMotionValue(1);

    useEffect(() => {
        if (isTyping) {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(y, -550, { type: "spring", stiffness: 300, damping: 30 });
        }
    }, [isTyping, x, y]);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };
    
    // ...
    
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup Volume Analyzer
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            
            const updateVolume = () => {
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    setVolume(sum / dataArray.length);
                    if (isRecording) requestAnimationFrame(updateVolume);
                }
            };
            requestAnimationFrame(updateVolume);

            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                analyserRef.current = null;
                setVolume(0);
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatus("Recording...");
        } catch (e) {
            addLog(`Error recording: ${e}`);
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus("Processing...");
        }
    };
    
    const processAudio = async (audioBlob: Blob) => {
        try {
            // Convert Blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                
                // Call /api/gemini proxy
                const response = await fetch(getApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base64Audio: base64Audio,
                        prompt: "Transcribe the audio and then answer the query concisely as a helpful assistant."
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to call AI API: ${response.statusText}`);
                }

                const data = await response.json();
                const aiResponse = data.text;
                
                setAiText(aiResponse);
                
                // Browser TTS -> Server TTS
                setStatus("Speaking...");
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
                        audio.onended = () => {
                            setIsSpeaking(false);
                            setStatus("Done");
                        };
                        audio.play();
                    } else {
                        throw new Error("Server TTS failed");
                    }
                } catch (ttsErr) {
                    console.error("Server TTS error, falling back:", ttsErr);
                    // Fallback to robotic browser TTS
                    const utterThis = new SpeechSynthesisUtterance(cleanedResponse);
                    utterThis.onstart = () => setIsSpeaking(true);
                    utterThis.onend = () => {
                        setIsSpeaking(false);
                        setStatus("Done");
                    };
                    utterThis.lang = "hi-IN";
                    window.speechSynthesis.speak(utterThis);
                }
            };
        } catch (e) {
            addLog(`Error processing audio: ${e}`);
            setStatus("Error");
        }
    };
    const handleDragEnd = (_: any, info: any) => {
        // Reset if dragged down more than 50px
        if (info.offset.y > 50) {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(y, 0, { type: "spring", stiffness: 300, damping: 30 });
            return;
        }
        
        const screenWidth = window.innerWidth;
        const buttonWidth = 56; // 14 pixels * 4
        const margin = 24;
        const currentLeft = 24;
        
        // Determine whether to snap to left or right side
        const isLeft = (info.point.x + buttonWidth / 2) < screenWidth / 2;
        const targetXPos = isLeft ? currentLeft : (screenWidth - buttonWidth - margin);
        const targetXValue = targetXPos - currentLeft; 
        
        animate(x, targetXValue, { type: "spring", stiffness: 300, damping: 30 });
    };

    return (
        <>
            {/* Floating Button */}
            <motion.div
                style={{ x, y, scale }}
                className="fixed bottom-16 right-6 w-14 h-14 rounded-full shadow-lg cursor-grab z-[2000]"
                drag
                dragMomentum={false}
                dragConstraints={{ top: -500, bottom: 100, left: -24, right: 300 }}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, cursor: "grabbing" }}
                onClick={() => {
                   const screenWidth = window.innerWidth;
                   const targetX = (screenWidth / 2) - 52; 
                   const midX = screenWidth / 6;
                   const midY = -130;
                   const targetY = -65;
                   
                   animate(x, [0, midX, targetX], { duration: 0.4, ease: "easeInOut" });
                   animate(y, [0, midY, targetY], { duration: 0.4, ease: "easeInOut" });
                   animate(scale, 1.45, { duration: 0.4, ease: "easeInOut" });
                   setTimeout(() => onNavigate('liveAI'), 400);
                }}
            >
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,orange,blue,green)] animate-spin"></div>
                <div className="absolute inset-[2px] rounded-full bg-[#0a0f24] flex items-center justify-center">
                    <Mic className="text-white w-6 h-6" />
                </div>
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                             initial={{ scale: 0.9, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             exit={{ scale: 0.9, opacity: 0 }}
                             className="relative bg-[#0f172a] p-[2px] rounded-[32px] w-72 h-80 flex flex-col items-center justify-between"
                             onClick={(e) => e.stopPropagation()}
                        >
                            {/* Rotating RGB Border */}
                            <motion.div
                                className="absolute inset-0 rounded-[32px] bg-[conic-gradient(from_0deg,transparent_0_340deg,#3b82f6_350deg,#8b5cf6_360deg)] opacity-100"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                style={{ opacity: 0.5 + volume / 100 }}
                            />
                            <div className="relative w-full h-full bg-[#0f172a] p-6 rounded-[30px] flex flex-col items-center justify-between border border-white/10">
                                <h2 className="text-white text-lg font-medium tracking-wide">Live Conversation</h2>
                                
                                {/* Neural/Wave Animation */}
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <motion.div
                                        className="absolute w-24 h-24 rounded-full bg-blue-500/20"
                                        animate={{ scale: [1, 1 + volume / 50, 1] }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                    />
                                    <motion.div
                                        className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                                        animate={{ scale: isRecording ? [1, 1.1 + volume / 100, 1] : 1 }}
                                        transition={{ duration: 0.2, repeat: isRecording ? Infinity : 0 }}
                                    />
                                </div>

                                <p className="text-white/70 text-sm font-light text-center h-16 overflow-y-auto w-full px-4">
                                    {status}
                                </p>

                                {showLogs && (
                                    <div className="bg-black/80 text-green-400 text-xs p-2 rounded w-full h-32 overflow-y-auto mt-2 font-mono">
                                        {logs.map((log, i) => <div key={i}>{log}</div>)}
                                    </div>
                                )}

                                <div className="flex gap-4 w-full justify-center">
                                    <button
                                        onClick={() => setShowLogs(!showLogs)}
                                        className="text-white/50 text-xs underline"
                                    >
                                        {showLogs ? "Hide Logs" : "Show Logs"}
                                    </button>
                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`p-5 rounded-full text-white transition-all ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FloatingAIAgent;
