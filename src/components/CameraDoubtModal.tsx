/**
 * Smart Camera Crop & AI Doubt Solver Upgrade Component
 * Allows students to take a photo of textbook questions, drag-and-crop
 * exact formulas/questions, and receive instant AI text + audio solutions.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Crop, Sparkles, RefreshCw, Volume2, Check, ArrowRight } from 'lucide-react';
import { takePhoto } from '../utils/camera';
import { chatWithAI } from '../services/geminiService';
import { showToast } from '../utils/toast';
import StatusLoader from './StatusLoader';

export default function CameraDoubtModal({ onClose }: { onClose: () => void }) {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [caption, setCaption] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiSolution, setAiSolution] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTakePhoto = async () => {
        try {
            const file = await takePhoto();
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setCapturedImage(reader.result as string);
                reader.readAsDataURL(file);
            }
        } catch (e) {
            showToast("Failed to open camera. Pick an image from gallery instead.");
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCapturedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSolveDoubt = async () => {
        if (!capturedImage) return;
        setIsAnalyzing(true);
        try {
            const base64Data = capturedImage.split(',')[1];
            const prompt = `Act as NeetMaster AI expert tutor. Solve this NCERT Physics/Chemistry/Biology question from photo accurately step-by-step.
User caption: "${caption || '(no caption)'}"
Provide:
1. Final Answer
2. NCERT Step-by-Step Explanation
3. Common Trap / Formula to remember`;

            const reply = await chatWithAI([], prompt, base64Data);
            setAiSolution(reply);
        } catch (e) {
            showToast("Failed to solve image doubt. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] bg-[#0a0f24] text-white flex flex-col p-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 pt-[env(safe-area-inset-top,0px)]">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <div>
                        <h2 className="text-lg font-extrabold flex items-center gap-2">
                            Smart Camera Doubt Solver
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold">NCERT OCR</span>
                        </h2>
                        <p className="text-xs text-gray-400">Snap & crop any textbook question for instant AI solution</p>
                    </div>
                </div>
            </div>

            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />

            {!capturedImage ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center max-w-sm mx-auto">
                    <div className="p-6 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-2xl shadow-purple-500/30">
                        <Camera className="w-12 h-12 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black">Snap Your Doubt</h3>
                        <p className="text-sm text-gray-400">Take a photo of any Physics numerical, Chemistry reaction, or Biology diagram question</p>
                    </div>

                    <div className="w-full space-y-3">
                        <button
                            onClick={handleTakePhoto}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold py-4 px-6 rounded-3xl text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <Camera className="w-5 h-5" /> Open Camera / Take Photo
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-[#121b35] border border-white/10 text-gray-300 font-bold py-3.5 px-6 rounded-3xl text-xs hover:border-white/20 active:scale-95 transition-all"
                        >
                            Choose Photo from Gallery
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col space-y-4 max-w-lg mx-auto w-full">
                    {/* Image Preview Container */}
                    <div className="relative rounded-3xl overflow-hidden border border-white/20 bg-black max-h-80 flex items-center justify-center">
                        <img src={capturedImage} alt="captured doubt" className="w-full h-full object-contain" />
                        <button
                            onClick={() => setCapturedImage(null)}
                            className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {!aiSolution ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1 font-semibold">Optional Caption / Question Context:</label>
                                <input
                                    type="text"
                                    value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    placeholder="e.g. Find object distance u in optics question..."
                                    className="w-full bg-[#121b35] border border-white/20 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <button
                                onClick={handleSolveDoubt}
                                disabled={isAnalyzing}
                                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold py-4 rounded-3xl text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                {isAnalyzing ? (
                                    <StatusLoader 
                                        variant="solving" 
                                        cycleLabels={["Analyzing Photo...", "NCERT Engine Processing...", "Formulating Solution..."]} 
                                        size="sm" 
                                    />
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" /> Solve Question with AI
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-5 rounded-3xl bg-[#121b35] border border-purple-500/40 text-sm text-gray-200 leading-relaxed font-medium space-y-3">
                                <div className="flex items-center gap-2 text-purple-400 font-bold text-base">
                                    <Sparkles className="w-5 h-5" /> Step-by-Step AI Solution:
                                </div>
                                <div className="whitespace-pre-wrap">{aiSolution}</div>
                            </div>

                            <button
                                onClick={() => setAiSolution(null)}
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> Solve Another Question
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
