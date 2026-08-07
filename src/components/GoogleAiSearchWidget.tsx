import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Search, Sparkles, Camera, Mic, ArrowRight, Zap, RefreshCw, Globe, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { getApiUrl, authFetch } from '../utils/api';
import { showToast } from '../utils/toast';

interface GoogleAiSearchWidgetProps {
    onOpenNeuralSolver: () => void;
    onOpenLiveAI: () => void;
}

export default function GoogleAiSearchWidget({ onOpenNeuralSolver, onOpenLiveAI }: GoogleAiSearchWidgetProps) {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchStage, setSearchStage] = useState<'idle' | 'searching_web' | 'summarizing'>('idle');
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [sources, setSources] = useState<{ title: string; url: string; snippet?: string }[]>([]);

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;

        setIsSearching(true);
        setSearchStage('searching_web');
        setAiResponse('');
        setSources([]);

        try {
            const response = await authFetch(getApiUrl('/api/search-stream'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: query.trim() }),
            });

            if (!response.body) throw new Error('No stream body received');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResult = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.sources && Array.isArray(parsed.sources)) {
                                setSources(prev => {
                                    const newSources = [...prev];
                                    parsed.sources.forEach((s: any) => {
                                        if (s && (s.url || s.title) && !newSources.some(existing => existing.url === s.url)) {
                                            newSources.push({
                                                title: s.title || 'Web Source',
                                                url: s.url || '#',
                                                snippet: s.snippet
                                            });
                                        }
                                    });
                                    return newSources;
                                });
                                setSearchStage('summarizing');
                            }
                            if (parsed.content) {
                                setSearchStage('summarizing');
                                accumulatedResult += parsed.content;
                                setAiResponse(accumulatedResult);
                            }
                        } catch (e) {
                            // parse chunk catch
                        }
                    }
                }
            }

            if (!accumulatedResult.trim()) {
                setAiResponse('Google AI searched the web but could not generate a summary. Please rephrase your question.');
            }
        } catch (err) {
            console.error('[GoogleAiWidget] Grounded Search error:', err);
            showToast('AI Search failed. Check internet connection.');
        } finally {
            setIsSearching(false);
            setSearchStage('idle');
        }
    };

    return (
        <div className="w-full bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#0F172A] border border-blue-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl my-4 text-white">
            {/* Widget Top Title Header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">
                        Google AI Search Mode
                    </span>
                </div>
                <span className="text-[9px] font-mono bg-blue-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 animate-pulse" /> Web Grounded AI
                </span>
            </div>

            {/* Google Search Bar Box */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="relative w-full flex items-center bg-slate-900/90 border border-white/15 focus-within:border-cyan-400/80 rounded-full px-4 py-2.5 shadow-inner transition-all group">
                    <Search className="w-5 h-5 text-gray-400 group-focus-within:text-cyan-400 mr-2.5 shrink-0" />
                    
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search web & ask Google AI (e.g. Optics formula, Krebs cycle)..."
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
                            className="p-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white disabled:opacity-40 transition active:scale-95 shadow-md shadow-blue-500/30"
                        >
                            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </form>

            {/* Live Web Search Stage Indicator */}
            {isSearching && (
                <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-cyan-300 animate-pulse">
                    <span className="flex items-center gap-2 font-medium">
                        <Globe className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        {searchStage === 'searching_web' ? 'Searching websites across the web...' : 'Synthesizing web results into Google AI Overview...'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">Google AI Mode</span>
                </div>
            )}

            {/* Live Web Grounded Sources & Overview Answer Box */}
            <AnimatePresence>
                {(aiResponse || sources.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: 10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 10 }}
                        className="mt-4 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 text-xs text-gray-200 leading-relaxed shadow-2xl overflow-hidden"
                    >
                        {/* Header Badge */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                            <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                Google AI Overview
                            </span>
                            <button
                                onClick={() => { setAiResponse(null); setSources([]); }}
                                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Web Sources / Sites Browsed */}
                        {sources.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-cyan-400" /> Web Sources Consulted ({sources.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                    {sources.map((src, idx) => (
                                        <a
                                            key={idx}
                                            href={src.url !== '#' ? src.url : undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-[11px] text-cyan-200 transition truncate max-w-[200px]"
                                        >
                                            <span className="font-bold text-cyan-400">[{idx + 1}]</span>
                                            <span className="truncate">{src.title}</span>
                                            {src.url !== '#' && <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Streamed AI Overview Text */}
                        {aiResponse && (
                            <div className="max-h-64 overflow-y-auto custom-scrollbar pr-1 text-gray-200 prose prose-invert max-w-none prose-sm leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {aiResponse}
                                </ReactMarkdown>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
