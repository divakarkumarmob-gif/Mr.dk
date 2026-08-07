import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, Camera, Mic, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { showToast } from '../utils/toast';

interface GoogleAiSearchWidgetProps {
    onOpenNeuralSolver: () => void;
    onOpenLiveAI: () => void;
}

export default function GoogleAiSearchWidget({ onOpenNeuralSolver, onOpenLiveAI }: GoogleAiSearchWidgetProps) {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        setAiResponse(null);

        try {
            const res = await fetch(getApiUrl('/api/tutor'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Explain this NEET question clearly with step-by-step logic, key concepts, and short formula summary: ${query}`,
                    mode: 'tutor',
                }),
            });

            const data = await res.json();
            if (data.reply) {
                setAiResponse(data.reply);
            } else {
                setAiResponse('Could not fetch AI answer. Please try again.');
            }
        } catch (err) {
            console.error('[GoogleAiWidget] Search error:', err);
            showToast('AI Search failed. Check internet connection.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="w-full bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#0F172A] border border-blue-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl my-4 text-white">
            {/* Widget Top Title */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                        Google Gemini AI Search Widget
                    </span>
                </div>
                <span className="text-[9px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    Instant AI
                </span>
            </div>

            {/* Google Search Bar Box */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="relative w-full flex items-center bg-slate-900/90 border border-white/15 focus-within:border-blue-500/80 rounded-full px-4 py-2.5 shadow-inner transition-all group">
                    <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-400 mr-2.5 shrink-0" />
                    
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask Google Gemini AI anything (e.g. Optics formula, Krebs cycle)..."
                        className="w-full bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <button
                            type="button"
                            onClick={onOpenNeuralSolver}
                            title="Snap Question Photo (Neural 2.0)"
                            className="p-2 rounded-full hover:bg-white/10 text-blue-400 hover:text-blue-300 transition active:scale-90"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onOpenLiveAI}
                            title="Voice Search (Live AI Tutor)"
                            className="p-2 rounded-full hover:bg-white/10 text-purple-400 hover:text-purple-300 transition active:scale-90"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            disabled={isSearching || !query.trim()}
                            className="p-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-40 transition active:scale-95 shadow-md shadow-blue-500/30"
                        >
                            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </form>

            {/* Live Inline AI Answer Box */}
            <AnimatePresence>
                {aiResponse && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: 10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 10 }}
                        className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-blue-500/30 text-xs text-gray-200 leading-relaxed shadow-xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                            <span className="font-bold text-blue-400 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                Google Gemini AI Answer
                            </span>
                            <button
                                onClick={() => setAiResponse(null)}
                                className="text-[10px] text-gray-400 hover:text-white"
                            >
                                Close
                            </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap pr-1">
                            {aiResponse}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
