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

    if (!filteredQuestions.length) return <div className="p-8 text-center bg-white h-screen">No questions found.</div>;

    return (
        <div className="fixed inset-0 bg-white z-[120] flex flex-col p-4">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold capitalize">{filterType} Questions</h2>
                <div />
            </div>

            <div className="flex-grow overflow-y-auto">
                <div className="p-6 bg-gray-50 rounded-2xl mb-6">
                    <p className="text-lg font-medium">{question.question}</p>
                </div>
                <div className="space-y-4">
                    {Object.entries(question.options).map(([key, value]) => {
                        const isCorrect = key === question.correct_option;
                        const isSelected = answers[question.id] === key;
                        const isWrong = isSelected && !isCorrect;
                        
                        return (
                            <div key={key} className={`p-4 rounded-xl border ${isCorrect ? 'border-green-500 bg-green-50' : isWrong ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                <span className={`font-bold mr-3`}>{key}.</span> {value}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-bold text-blue-900">Explanation</p>
                    <p className="text-blue-800 mt-1">{question.explanation}</p>
                </div>
            </div>

            <div className="p-4 border-t flex justify-between">
                <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="px-6 py-2 bg-gray-100 rounded-lg">Prev</button>
                <span className="self-center font-bold">{currentIndex + 1} / {filteredQuestions.length}</span>
                <button disabled={currentIndex === filteredQuestions.length - 1} onClick={() => setCurrentIndex(prev => prev + 1)} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Next</button>
            </div>
        </div>
    );
}
