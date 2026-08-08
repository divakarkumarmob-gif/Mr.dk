import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Target, AlertTriangle, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import FocusAnalytics from './FocusAnalytics';
import { useModalBackButton } from '../utils/hardwareBackButton';

export default function FocusSessionSummary({ 
    focusedTime, 
    distractedTime, 
    onClose 
}: { 
    focusedTime: number, 
    distractedTime: number, 
    onClose: () => void 
}) {
    useModalBackButton(true, onClose);
    const totalTime = focusedTime + distractedTime;
    const focusPercentage = totalTime > 0 ? Math.round((focusedTime / totalTime) * 100) : 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
                {/* Backdrop Blur */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Glassmorphic Summary Modal */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, type: "spring", damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative bg-gradient-to-b from-slate-900 via-[#0a142e] to-slate-950 border border-white/15 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl z-10 text-white space-y-6 overflow-hidden"
                >
                    {/* Background Glow Orbs */}
                    <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-white/10 pb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/25">
                                <Trophy className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Focus Session Summary</h2>
                                <p className="text-xs text-gray-400 font-medium">NEET Study Efficiency Report</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Big Efficiency Ring Card */}
                    <div className="relative p-6 bg-white/5 rounded-3xl border border-white/10 text-center backdrop-blur-md relative z-10 flex flex-col items-center">
                        <div className="relative inline-flex items-center justify-center">
                            <div className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                                {focusPercentage}%
                            </div>
                        </div>
                        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mt-2 flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" /> Focus Efficiency Score
                        </p>
                    </div>

                    {/* Detailed Time Stats Cards */}
                    <div className="space-y-2.5 relative z-10">
                        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                                    <Clock className="h-4 w-4 text-blue-400" />
                                </div>
                                <span className="text-xs font-bold text-gray-300">Total Study Duration</span>
                            </div>
                            <span className="text-white font-mono font-bold text-xs">{Math.floor(totalTime / 60000)}m {Math.floor((totalTime % 60000) / 1000)}s</span>
                        </div>

                        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                                    <Target className="h-4 w-4 text-emerald-400" />
                                </div>
                                <span className="text-xs font-bold text-emerald-300">Pure Focused Time</span>
                            </div>
                            <span className="text-emerald-400 font-mono font-extrabold text-xs">{Math.floor(focusedTime / 60000)}m {Math.floor((focusedTime % 60000) / 1000)}s</span>
                        </div>

                        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
                                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                                </div>
                                <span className="text-xs font-bold text-amber-300">Distracted Time</span>
                            </div>
                            <span className="text-amber-400 font-mono font-extrabold text-xs">{Math.floor(distractedTime / 60000)}m {Math.floor((distractedTime % 60000) / 1000)}s</span>
                        </div>
                    </div>

                    <FocusAnalytics data={[]} />

                    <div className="pt-2 relative z-10">
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/25 active:scale-95 transition"
                        >
                            Complete & Save Session
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
