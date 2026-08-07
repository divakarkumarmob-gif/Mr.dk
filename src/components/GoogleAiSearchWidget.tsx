import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Search, Sparkles, Camera, Mic, ArrowRight, RefreshCw, Globe, ExternalLink, ShieldCheck, X, ChevronDown, ChevronUp } from 'lucide-react';
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
    
    // Collapsible Web Sources (collapsed by default)
    const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);

    // Input Ref for horizontal sliding auto-scroll during voice typing
    const inputRef = useRef<HTMLInputElement>(null);

    // Image Photo Doubt Search State
    const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Voice Search State
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);

    // Auto-scroll input to the right so live spoken text is always visible
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.scrollLeft = inputRef.current.scrollWidth;
        }
    }, [query]);

    const handleCameraClick = () => {
        cameraInputRef.current?.click();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(previewUrl);

        const reader = new FileReader();
        reader.onload = () => {
            setSelectedImageBase64(reader.result as string);
            showToast('Photo selected! Click search to analyze & search web 📷');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const clearSelectedImage = () => {
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
        setSelectedImageBase64(null);
    };

    const handleMicClick = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.lang = 'en-IN';
                recognition.continuous = false;
                recognition.interimResults = true;

                setIsVoiceRecording(true);
                showToast('Boliye! Voice search web query active hai... 🎙️');

                recognition.onresult = (event: any) => {
                    const transcript = Array.from(event.results)
                        .map((result: any) => result[0].transcript)
                        .join('');
                    setQuery(transcript);
                };

                recognition.onerror = (event: any) => {
                    console.error('[VoiceSearch] Speech recognition error:', event);
                    setIsVoiceRecording(false);
                    onOpenLiveAI();
                };

                recognition.onend = () => {
                    setIsVoiceRecording(false);
                };

                recognition.start();
                return;
            } catch (e) {
                console.warn('[VoiceSearch] SpeechRecognition failed, falling back to Live AI:', e);
            }
        }
        onOpenLiveAI();
    };

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!query.trim() && !selectedImageBase64) || isSearching) return;

        setIsSearching(true);
        setSearchStage('searching_web');
        setAiResponse('');
        setSources([]);
        setIsSourcesExpanded(false); // Collapsed by default

        try {
            const response = await authFetch(getApiUrl('/api/search-stream'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: query.trim() || 'Analyze and solve this photo doubt step-by-step',
                    base64Image: selectedImageBase64
                }),
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
                            const chunkText = parsed.content || parsed.text || parsed.reply;
                            if (chunkText) {
                                setSearchStage('summarizing');
                                accumulatedResult += chunkText;
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
            {/* Hidden Input for Camera Photo Capture */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
            />

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
                    <Globe className="w-2.5 h-2.5" /> Web Grounded AI
                </span>
            </div>

            {/* Photo Attachment Chip Preview */}
            {imagePreviewUrl && (
                <div className="mb-2 flex items-center gap-2 bg-blue-500/15 border border-blue-500/30 rounded-xl p-2 w-fit">
                    <img src={imagePreviewUrl} alt="Photo Doubt" className="w-10 h-10 object-cover rounded-lg" />
                    <div className="text-[11px] text-cyan-200 font-medium pr-1">
                        <span>Photo doubt attached</span>
                        <p className="text-[9px] text-gray-400">Web search will analyze this image</p>
                    </div>
                    <button
                        onClick={clearSelectedImage}
                        className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Google Search Bar Box */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className={`relative w-full flex items-center bg-slate-900/90 border ${isVoiceRecording ? 'border-purple-500 animate-pulse' : 'border-white/15 focus-within:border-cyan-400/80'} rounded-full px-4 py-2.5 shadow-inner transition-all group`}>
                    <Search className="w-5 h-5 text-gray-400 group-focus-within:text-cyan-400 mr-2.5 shrink-0" />
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={isVoiceRecording ? "Listening... Speak your doubt now 🎙️" : "Search web & ask Google AI (e.g. Optics formula, Krebs cycle)..."}
                        className="w-full bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none overflow-x-auto whitespace-nowrap scroll-smooth"
                    />

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleCameraClick}
                            title="Snap Question Photo (Web Search)"
                            className="p-2 rounded-full hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition active:scale-90"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleMicClick}
                            title="Voice Web Search"
                            className={`p-2 rounded-full transition active:scale-90 ${isVoiceRecording ? 'bg-purple-500/30 text-purple-300 animate-pulse' : 'hover:bg-white/10 text-purple-400 hover:text-purple-300'}`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            disabled={isSearching || (!query.trim() && !selectedImageBase64)}
                            className="p-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white disabled:opacity-40 transition active:scale-95 shadow-md shadow-blue-500/30"
                        >
                            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </form>

            {/* Live Web Search Stage Indicator */}
            {isSearching && (
                <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-cyan-300">
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
                                onClick={() => { setAiResponse(null); setSources([]); clearSelectedImage(); }}
                                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Collapsible Web Sources / Sites Browsed */}
                        {sources.length > 0 && (
                            <div className="mb-3 border border-white/10 rounded-xl bg-white/5 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsSourcesExpanded(prev => !prev)}
                                    className="w-full px-3 py-2 flex items-center justify-between text-[11px] text-cyan-300 font-semibold hover:bg-white/5 transition"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                                        Web Sources Consulted ({sources.length})
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-gray-400 font-normal">
                                        {isSourcesExpanded ? 'Collapse' : 'Show Sources'}
                                        {isSourcesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </span>
                                </button>

                                <AnimatePresence>
                                    {isSourcesExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="px-3 pb-3 pt-1 border-t border-white/5"
                                        >
                                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
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
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
