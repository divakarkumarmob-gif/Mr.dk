import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Mic, Square } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FloatingAIAgent: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [aiText, setAiText] = useState("");
    const [status, setStatus] = useState("Tap to start recording");
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const addLog = (msg: string) => {
        console.log(msg);
        setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };
    
    // ...
    
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
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
                
                // Call Gemini
                // Use a flash model as it's fast
                const result = await ai.models.generateContent({
                    model: "gemini-2.0-flash", // Use a suitable model
                    contents: [{
                        role: "user",
                        parts: [
                            { inlineData: { data: base64Audio, mimeType: "audio/webm" } },
                            { text: "Transcribe the audio and then answer the query concisely as a helpful assistant." }
                        ]
                    }]
                });
                
                const aiResponse = result.text;
                setAiText(aiResponse);
                
                // Browser TTS
                setStatus("Speaking...");
                const utterThis = new SpeechSynthesisUtterance(aiResponse);
                utterThis.onstart = () => setIsSpeaking(true);
                utterThis.onend = () => {
                    setIsSpeaking(false);
                    setStatus("Done");
                };
                utterThis.lang = "hi-IN";
                window.speechSynthesis.speak(utterThis);
            };
        } catch (e) {
            addLog(`Error processing audio: ${e}`);
            setStatus("Error");
        }
    };
    const handleDragEnd = (_: any, info: any) => {
        const screenWidth = window.innerWidth;
        const buttonWidth = 64; 
        const margin = 24;
        
        // Determine whether to snap to left or right side
        const isLeft = (info.point.x + buttonWidth / 2) < screenWidth / 2;
        
        // Calculate target X position relative to initial fixed position
        const currentLeft = 24;
        const targetXPos = isLeft ? currentLeft : (screenWidth - buttonWidth - margin);
        const targetXValue = targetXPos - currentLeft; 
        
        animate(x, targetXValue, { type: "spring", stiffness: 300, damping: 30 });
    };

    return (
        <>
            {/* Floating Button */}
            <motion.div
                style={{ x, y }}
                className="fixed bottom-20 left-6 w-16 h-16 rounded-full flex items-center justify-center p-[3px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-lg cursor-grab z-50 overflow-hidden"
                drag
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, cursor: "grabbing" }}
                onClick={() => !isOpen && setIsOpen(true)}
            >
                <div className="w-full h-full rounded-full bg-[#0a0f24] flex items-center justify-center">
                    <Mic className="text-white w-8 h-8" />
                </div>
                {/* Rotating Border Animation */}
                <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-conic from-blue-500 via-purple-500 to-pink-500 opacity-70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
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
                            className="bg-[#0f172a] p-8 rounded-[40px] w-80 h-96 flex flex-col items-center justify-between border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-white text-xl font-medium tracking-wide">Live Conversation</h2>
                            
                            {/* Neural/Wave Animation */}
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                <motion.div
                                    className="absolute w-24 h-24 rounded-full bg-blue-500/20"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <motion.div
                                    className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                                    animate={{ scale: isRecording ? [1, 1.1, 1] : 1 }}
                                    transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
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
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FloatingAIAgent;
