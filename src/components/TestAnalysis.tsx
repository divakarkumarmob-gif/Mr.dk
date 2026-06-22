import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, BookOpen } from 'lucide-react';
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

    useEffect(() => {
        analyzeTestPerformance(result.questions || [], result.answers || {})
            .then(setAnalysis)
            .catch(() => setAnalysis("Analysis currently unavailable."))
            .finally(() => setLoading(false));
    }, [result]);

    if (showReview) {
        return <TestReview questions={result.questions || []} answers={result.answers || {}} filterType="incorrect" onClose={() => setShowReview(false)} />;
    }

    return (
        <div className="fixed inset-0 bg-[#0a0f24] text-white z-[120] flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onClose} className="p-2 bg-[#161e38] rounded-full"><X /></button>
                <h2 className="font-bold text-xl">Test Analysis</h2>
                <div className="w-10" />
            </div>

            {loading ? (
                <div className="flex-grow flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                    <p className="text-gray-400">Analyzing your performance...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-[#161e38] p-6 rounded-3xl border border-white/5 shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400">
                            <BookOpen className="w-5 h-5" /> 
                            Detailed Insights
                        </h3>
                        <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-line bg-[#0a0f24]/50 p-4 rounded-xl border border-white/5">
                            {analysis}
                        </div>
                    </div>

                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <p className="text-red-400 text-sm font-medium mb-3 text-center">We found some areas that need improvement.</p>
                        <button 
                            onClick={() => setShowReview(true)}
                            className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                        >
                            Review Mistakes
                        </button>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        className="w-full bg-[#161e38] py-4 rounded-2xl font-bold text-gray-300 transition-all border border-white/5"
                    >
                        Back to Result
                    </button>
                </div>
            )}
        </div>
    );
}
