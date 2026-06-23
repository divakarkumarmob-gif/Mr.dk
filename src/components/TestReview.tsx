import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Question {
    id: string;
    question: string;
    options: { A: string; B: string; C: string; D: string; };
    correct_option: string;
    explanation: string;
}

interface TestReviewProps {
    questions: Question[];
    answers: Record<string, string>;
    filterType: 'all' | 'correct' | 'incorrect' | 'unattempted';
    onClose: () => void;
}

export default function TestReview({ questions, answers, filterType, onClose }: TestReviewProps) {
    const filteredQuestions = questions.filter(q => {
        const answer = answers[q.id];
        if (filterType === 'correct') return answer === q.correct_option;
        if (filterType === 'incorrect') return answer && answer !== q.correct_option;
        if (filterType === 'unattempted') return !answer;
        return true;
    });

    const [currentIndex, setCurrentIndex] = useState(0);
    const question = filteredQuestions[currentIndex];

    if (!filteredQuestions.length) return (
        <div className="p-8 text-center bg-[#0a0f24] text-white h-screen flex flex-col items-center justify-center">
            <X className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-xl font-bold">No questions found.</p>
            <p className="text-gray-400 mt-2 mb-8">It seems there are no questions matching this filter.</p>
            <button onClick={onClose} className="px-8 py-3 bg-[#161e38] rounded-xl border border-white/10 font-bold">Go Back</button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#0a0f24] text-white z-[120] flex flex-col p-4">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onClose} className="p-2 bg-[#161e38] rounded-full"><X /></button>
                <h2 className="font-bold capitalize text-xl">{filterType} Questions</h2>
                <div className="w-10" />
            </div>

            <div className="flex-grow overflow-y-auto px-1 pb-40">
                <div className="p-6 bg-[#161e38] rounded-2xl mb-6 border border-white/5 shadow-inner">
                    <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-4 tracking-tight">Question Details</p>
                    <p className="text-lg font-medium text-gray-100 leading-relaxed">{question.question}</p>
                </div>
                <div className="space-y-4">
                    {Object.entries(question.options).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
                        const isCorrect = key === question.correct_option;
                        const isSelected = answers[question.id] === key;
                        const isWrong = isSelected && !isCorrect;
                        
                        return (
                            <div key={key} className={`p-4 rounded-xl border transition-all ${
                                isCorrect ? 'border-green-500 bg-green-500/10' : 
                                isWrong ? 'border-red-500 bg-red-500/10' : 
                                'border-white/10 bg-[#161e38]'
                            }`}>
                                <span className={`font-bold mr-3 ${isCorrect ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-blue-400'}`}>{key}.</span> 
                                <span className="text-gray-200">{value}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-8 p-6 bg-[#1e293b] border border-blue-500/30 rounded-2xl">
                    <p className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        Explanation
                    </p>
                    <p className="text-gray-300 leading-relaxed">{question.explanation}</p>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 pb-12 border-t border-white/10 flex justify-between items-center bg-[#0a0f24]/90 backdrop-blur-xl z-[130]">
                <button 
                    disabled={currentIndex === 0} 
                    onClick={() => setCurrentIndex(prev => prev - 1)} 
                    className="px-6 py-4 bg-white/5 text-white rounded-2xl disabled:opacity-20 border border-white/10 active:scale-90 transition-all font-bold min-w-[110px]"
                >
                    Previous
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1 text-center">Position</span>
                    <span className="font-mono font-bold text-blue-400 text-xl">{currentIndex + 1} / {filteredQuestions.length}</span>
                </div>
                <button 
                    disabled={currentIndex === filteredQuestions.length - 1} 
                    onClick={() => setCurrentIndex(prev => prev + 1)} 
                    className="px-6 py-4 bg-blue-600 text-white rounded-2xl disabled:opacity-20 active:scale-90 transition-all shadow-2xl shadow-blue-600/40 font-bold min-w-[110px]"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
