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
        <div className="fixed inset-0 bg-background z-[120] flex flex-col p-6 text-foreground overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold text-xl">Test Analysis</h2>
                <div />
            </div>

            {loading ? (
                <div className="flex-grow flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                    <p>Analyzing your performance...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-card p-6 rounded-3xl">
                        <h3 className="font-bold mb-3 flex items-center gap-2"><BookOpen/> Detailed Insights</h3>
                        <div className="prose prose-invert text-sm whitespace-pre-line">{analysis}</div>
                    </div>

                    <button 
                        onClick={() => setShowReview(true)}
                        className="w-full bg-red-600 py-4 rounded-2xl font-bold text-lg"
                    >
                        Review Mistakes
                    </button>
                </div>
            )}
        </div>
    );
}
