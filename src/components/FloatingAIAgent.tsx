import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Mic, Square } from 'lucide-react';
import { stripLatexForTTS } from '../lib/utils';
import { getApiUrl, authFetch } from '@/utils/api';
import AgentFace from './AgentFace';

export default function FloatingAIAgent({ onNavigate, isTyping, isCentered }: {
    onNavigate: (view: string, origin?: { x: number; y: number }) => void;
    isTyping: boolean;
    isCentered?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [aiText, setAiText] = useState("");
    const [status, setStatus] = useState("Tap to start recording");
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [volume, setVolume] = useState(0);
    const [isClicked, setIsClicked] = useState(false);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isRecordingRef = useRef(false);
    const silenceStartTimeRef = useRef<number | null>(null);
    const colorIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasCycledRef = useRef(false);
    const [colorIndex, setColorIndex] = useState(0);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const scale = useMotionValue(1);

    useEffect(() => {
        // Run Right-to-Left Floating Icon Intro Animation ONLY ONCE for new users / app install
        const hasSeenIntroAnimation = localStorage.getItem('has_seen_app_intro_ai_animation') === 'true';
        if (!hasSeenIntroAnimation) {
            animate(x, [250, 0], { duration: 1.2, ease: "easeOut" });
            localStorage.setItem('has_seen_app_intro_ai_animation', 'true');
        }
    }, [x]);

    useEffect(() => {
        isRecordingRef.current = isRecording;
        if (isTyping) {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(y, -550, { type: "spring", stiffness: 300, damping: 30 });
        } else if (isCentered) {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(y, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(scale, 1.5, { type: "spring", stiffness: 300, damping: 30 });
        } else {
            animate(scale, 1, { type: "spring", stiffness: 300, damping: 30 });
        }
    }, [isTyping, isRecording, isCentered, x, y, scale]);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };
    
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
                    const vol = sum / dataArray.length;
                    setVolume(vol);

                    // Silence detection
                    if (vol < 5) {
                        if (silenceStartTimeRef.current === null) {
                            silenceStartTimeRef.current = Date.now();
                        } else if (Date.now() - silenceStartTimeRef.current > 2000) {
                            addLog("Silence detected, stopping recording");
                            stopRecording();
                            silenceStartTimeRef.current = null;
                            return;
                        }
                    } else {
                        silenceStartTimeRef.current = null;
                    }

                    if (isRecordingRef.current) requestAnimationFrame(updateVolume);
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
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                
                const response = await authFetch(getApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream'
                    },
                    body: JSON.stringify({
                        base64Audio: base64Audio,
                        prompt: "Transcribe the audio and then answer the query concisely as a helpful assistant."
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                let streamedText = '';
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
                                    streamedText += parsed.text;
                                    setAiText(streamedText);
                                }
                            } catch {
                                // Skip partial JSON parse errors
                            }
                        }
                    }
                }

                const finalText = streamedText.trim() || "Completed response.";
                setAiText(finalText);
                addLog(`AI: ${finalText}`);
                speak(finalText);
            };
        } catch (e) {
            addLog(`Error processing audio: ${e}`);
            setStatus("Error");
        }
    };

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            setIsSpeaking(true);
            setStatus("Speaking...");
            const cleanText = stripLatexForTTS(text);
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.onend = () => {
                setIsSpeaking(false);
                setStatus("Tap to start recording");
            };
            window.speechSynthesis.speak(utterance);
        } else {
            addLog("TTS not supported");
        }
    };

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.y > 50) {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
            animate(y, 0, { type: "spring", stiffness: 300, damping: 30 });
            return;
        }
        
        const screenWidth = window.innerWidth;
        const buttonWidth = 56;
        const margin = 24;
        const currentLeft = 24;
        
        const isLeft = (info.point.x + buttonWidth / 2) < screenWidth / 2;
        const targetXPos = isLeft ? currentLeft : (screenWidth - buttonWidth - margin);
        const targetXValue = targetXPos - currentLeft; 
        
        animate(x, targetXValue, { type: "spring", stiffness: 300, damping: 30 });
    };

    const handleIconClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

        setIsClicked(true);
        onNavigate('liveAI', origin);
        setTimeout(() => setIsClicked(false), 600);
    };

    return (
        <>
            {/* Floating AI Icon Button with Glossy Wave Aura Animation */}
            <motion.div
                id="agent-face-container"
                style={{ x, y, scale }}
                drag
                dragMomentum={false}
                dragConstraints={{ top: -500, bottom: 100, left: -24, right: 300 }}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                animate={{ y: [0, -6, 0] }}
                transition={{ y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }}
                className="fixed bottom-28 left-6 cursor-pointer z-[2000] touch-none select-none"
                onPointerDown={() => {
                    hasCycledRef.current = false;
                    const el = document.getElementById('agent-face-container');
                    if (el) el.classList.add('angry');
                    setStatus("Changing color...");
                    
                    colorIntervalRef.current = setInterval(() => {
                        setColorIndex((prev) => (prev + 1) % 12);
                        hasCycledRef.current = true;
                    }, 300);
                }}
                onPointerUp={() => {
                    if (colorIntervalRef.current) clearInterval(colorIntervalRef.current);
                    
                    const el = document.getElementById('agent-face-container');
                    if (el) el.classList.remove('angry');
                    setTimeout(() => setStatus(""), 900);
                    
                    if (!hasCycledRef.current) {
                        setColorIndex((prev) => (prev + 1) % 12);
                    }
                }}
                onPointerLeave={() => {
                    if (colorIntervalRef.current) clearInterval(colorIntervalRef.current);
                }}
                onClick={handleIconClick}
            >
                {/* Simple click feedback ripple */}
                <AnimatePresence>
                    {isClicked && (
                        <motion.div
                            key="click-pulse"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.35, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className="absolute inset-0 rounded-full bg-blue-500/40 pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* Transparent Button Container */}
                <div className="relative flex items-center justify-center bg-transparent border-0 shadow-none p-0">
                    <AgentFace status={status} volume={0} size={54} colorIndex={colorIndex} />
                </div>
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                             initial={{ scale: 0.9, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             exit={{ scale: 0.9, opacity: 0 }}
                             className="relative bg-[#0a0f24] p-[2px] rounded-[36px] w-80 h-96 flex flex-col items-center justify-between shadow-[0_0_50px_rgba(139,92,246,0.4)] border border-purple-500/30"
                             onClick={(e) => e.stopPropagation()}
                        >
                            {/* Rotating RGB / Neon Border */}
                            <motion.div
                                className="absolute inset-0 rounded-[36px] bg-[conic-gradient(from_0deg,transparent_0_300deg,#8b5cf6_340deg,#ec4899_360deg)] opacity-100"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{ opacity: 0.6 + volume / 100 }}
                            />
                            <div className="relative w-full h-full bg-[#0a0f24]/95 backdrop-blur-xl p-6 rounded-[34px] flex flex-col items-center justify-between border border-purple-500/20">
                                <h2 className="text-white text-lg font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">Live Voice Assistant</h2>
                                
                                <AgentFace status={status} volume={volume} size={135} colorIndex={colorIndex} />

                                <p className="text-slate-300 text-sm font-medium text-center h-14 overflow-y-auto w-full px-4">
                                    {status}
                                </p>

                                {showLogs && (
                                    <div className="bg-slate-950/90 text-emerald-400 text-xs p-2 rounded-xl w-full h-32 overflow-y-auto mt-2 font-mono border border-emerald-500/30">
                                        {logs.map((log, i) => <div key={i}>{log}</div>)}
                                    </div>
                                )}

                                <div className="flex items-center gap-4 w-full justify-center">
                                    <button
                                        onClick={() => setShowLogs(!showLogs)}
                                        className="text-slate-400 text-xs underline hover:text-slate-200 transition-colors"
                                    >
                                        {showLogs ? "Hide Logs" : "Show Logs"}
                                    </button>
                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`p-4 rounded-full text-white transition-all shadow-lg cursor-pointer ${isRecording ? 'bg-red-600 hover:bg-red-500 shadow-red-500/30' : 'gradient-btn-primary shadow-purple-500/30'}`}
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
}
