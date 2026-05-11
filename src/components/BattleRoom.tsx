import React, { useState, useEffect } from 'react';
// import { QUESTIONS } from '../data/questions';

export default function BattleRoom({ chapter, onFinish }: { chapter: string, onFinish: (winner: string) => void }) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins in seconds
    const [botScore, setBotScore] = useState(0);
    const [winner, setWinner] = useState<string | null>(null);

    useEffect(() => {
        // ... (existing useEffect)
        // const allQuestions = [...QUESTIONS.Biology, ...QUESTIONS.Chemistry, ...QUESTIONS.Physics];
const allQuestions: any[] = []; // Replaced legacy QUESTIONS with empty array
        const selected = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 15);
        setQuestions(selected);

        // Dummy bot score logic
        const interval = setInterval(() => {
            setBotScore(prev => prev + (Math.random() > 0.6 ? 1 : 0));
        }, 30000); // Bot gets a point every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const finishBattle = (w: string) => {
        setWinner(w);
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        if (timeLeft <= 0) {
            clearInterval(timer);
            finishBattle(score > botScore ? 'You' : 'Bot');
        }
        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleAnswer = (answer: string) => {
        if (answer === questions[currentIndex].answer) {
            setScore(prev => prev + 1);
        }
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            finishBattle(score > botScore ? 'You' : 'Bot');
        }
    };

    if (winner) {
        return (
            <div className="fixed inset-0 bg-[#0a0f24] flex flex-col items-center justify-center p-6 z-50 text-white">
                <div className="text-6xl mb-4">🏆</div>
                <h1 className="text-3xl font-bold mb-4">Winner: {winner}</h1>
                <button onClick={() => onFinish(winner)} className="bg-blue-600 px-6 py-3 rounded-xl font-bold mt-8">Back to Hub</button>
            </div>
        );
    }

    if (questions.length === 0) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-4 sm:p-6">
            <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-sm font-bold opacity-70">Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                    <div className="text-sm font-bold"><span className="text-blue-500">You: {score}</span> | <span className="text-red-500">Bot: {botScore}</span></div>
                </div>
                <div className="bg-[#161e38] p-4 sm:p-6 rounded-2xl border border-white/10">
                    <p className="mb-6 font-bold text-base sm:text-lg">{questions[currentIndex].text}</p>
                    <div className="space-y-3">
                        {questions[currentIndex].options.map((opt: string) => (
                            <button key={opt} onClick={() => handleAnswer(opt)} className="block w-full p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-orange-500/30 transition-colors text-left text-sm sm:text-base">
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
