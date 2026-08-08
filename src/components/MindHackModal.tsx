import React from 'react';
import { motion } from 'motion/react';
import { X, Brain, Sparkles, Zap, Copy, Check } from 'lucide-react';
import { mindHackText } from '../data/mindHackData';
import { useModalBackButton } from '../utils/hardwareBackButton';

export default function MindHackModal({ onClose }: { onClose: () => void }) {
    useModalBackButton(true, onClose);
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(mindHackText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 selection:bg-purple-500/30">
            {/* Backdrop Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Glowing High-Tech Mind Hack Container */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ duration: 0.3, type: "spring", damping: 25 }}
                className="relative bg-gradient-to-b from-slate-900 via-[#130b24] to-slate-950 text-white p-6 rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-purple-500/30 z-10 shadow-[0_0_35px_rgba(168,85,247,0.2)]"
            >
                {/* Ambient Background Glow */}
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 relative z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30">
                            <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-white tracking-tight">NEET Mind Hacks</h2>
                                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-purple-400" /> High-Yield
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium">Memory Tricks & Mnemonics for NEET 2026</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition"
                            title="Copy Mind Hacks Text"
                        >
                            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Mind Hack Content Body */}
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 text-xs sm:text-sm leading-relaxed text-gray-200 space-y-4 relative z-10">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="whitespace-pre-line font-sans leading-relaxed text-gray-300">
                            {mindHackText}
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between relative z-10 shrink-0">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">100% NCERT Aligned</span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl font-bold text-xs text-white shadow-lg shadow-purple-500/25 active:scale-95 transition"
                    >
                        Got It!
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
