import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, BookOpen, AlertCircle, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { analyzeTestPerformance } from '../services/analysisService';
import TestReview from './TestReview';

interface TestAnalysisProps {
    result: any;
    onClose: () => void;
}

export default function TestAnalysis({ result, onClose }: TestAnalysisProps) {
    const [analysis, setAnalysis] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [showReview, setShowReview] = useState(false);

    const deepAnalysis = result.deepAnalysis;

    useEffect(() => {
        if (!result || deepAnalysis) {
            setLoading(false);
            return;
        }
        analyzeTestPerformance(result?.questions || [], result?.answers || {})
            .then(setAnalysis)
            .catch(() => setAnalysis("Analysis currently unavailable."))
            .finally(() => setLoading(false));
    }, [result, deepAnalysis]);

    if (showReview) {
        return <TestReview questions={result?.questions || []} answers={result?.answers || {}} filterType="incorrect" onClose={() => setShowReview(false)} />;
    }

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-[#0a0f24]/95 backdrop-blur-2xl text-slate-100 z-[120] flex flex-col p-4 sm:p-6 overflow-y-auto"
        >
            <div className="max-w-2xl mx-auto w-full flex-grow flex flex-col pt-[env(safe-area-inset-top,0px)]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-purple-500/25">
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-slate-900 border border-purple-500/30 rounded-full hover:bg-slate-800 transition active:scale-95 text-purple-300 hover:text-white cursor-pointer shadow-md"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                        <h2 className="font-black text-lg text-white tracking-tight">AI Test Analysis</h2>
                    </div>
                    <div className="w-9" />
                </div>

                {loading ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400 mb-4" />
                        <p className="text-slate-200 font-extrabold text-sm">Analyzing NEET performance metrics...</p>
                        <p className="text-purple-300/80 text-xs mt-1 font-medium">Checking accuracy, speed, & subject weak spots</p>
                    </div>
                ) : (
                    <div className="space-y-5 flex-grow">
                        {deepAnalysis ? (
                            <div className="space-y-4">
                                <div className="space-y-1.5 glass-card p-5 rounded-2xl border border-rose-500/30 shadow-lg">
                                    <h4 className="text-sm font-extrabold text-rose-300 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-rose-400" /> Kya galati hua (Key Mistakes)
                                    </h4>
                                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line pt-1">{deepAnalysis.mistakes}</p>
                                </div>

                                <div className="space-y-1.5 glass-card p-5 rounded-2xl border border-purple-500/30 shadow-lg">
                                    <h4 className="text-sm font-extrabold text-purple-300 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-purple-400" /> Kaise improve kare (Improvement Plan)
                                    </h4>
                                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line pt-1">{deepAnalysis.improvement}</p>
                                </div>

                                <div className="space-y-1.5 glass-card p-5 rounded-2xl border border-emerald-500/30 shadow-lg">
                                    <h4 className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Future me galti se bache (Action Steps)
                                    </h4>
                                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line pt-1">{deepAnalysis.future}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card p-6 rounded-3xl border border-purple-500/25 shadow-2xl backdrop-blur-xl">
                                <h3 className="font-extrabold mb-4 flex items-center gap-2 text-purple-300 text-sm tracking-wide uppercase">
                                    <BookOpen className="w-4 h-4 text-purple-400" /> Detailed Mentor Insights
                                </h3>
                                <div className="text-xs text-slate-100 leading-relaxed whitespace-pre-line bg-slate-950/80 p-4.5 rounded-2xl border border-purple-500/20">
                                    {analysis}
                                </div>
                            </div>
                        )}


                        <div className="p-4.5 bg-rose-950/40 border border-rose-500/30 rounded-2xl shadow-lg mt-4">
                            <p className="text-rose-300 text-xs font-semibold mb-3 text-center">We found conceptual gaps that need targeted review.</p>
                            <button 
                                onClick={() => setShowReview(true)}
                                className="w-full bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white py-3.5 rounded-xl font-extrabold text-sm transition-all shadow-lg shadow-rose-600/30 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Review Incorrect Questions</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <button 
                            onClick={onClose}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 py-3.5 rounded-xl font-extrabold text-xs transition border border-slate-800 cursor-pointer mt-2"
                        >
                            Back to Scorecard
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

