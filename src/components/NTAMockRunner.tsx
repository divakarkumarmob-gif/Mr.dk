import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Menu, X, Hourglass, Info, User, CheckCircle2, Circle, Clock, LogOut } from 'lucide-react';
import Pressable from './Pressable';

interface Question {
    id: string;
    question: string;
    options: { A: string; B: string; C: string; D: string; };
    correct_option: string;
    explanation: string;
    subject: string;
}

interface NTAMockRunnerProps {
    questions: Question[];
    onBack: () => void;
    title: string;
}

type QuestionStatus = 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED' | 'MARKED_ANSWERED';

export default function NTAMockRunner({ questions = [], onBack, title }: NTAMockRunnerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [status, setStatus] = useState<Record<string, QuestionStatus>>({});
    const [timeLeft, setTimeLeft] = useState(questions.length * 60); // 1 min per question
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [activeSubject, setActiveSubject] = useState<string>('All');

    // NTA logic for status
    useEffect(() => {
        const initialStatus: Record<string, QuestionStatus> = {};
        questions.forEach((q, idx) => {
            initialStatus[q.id] = idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED';
        });
        setStatus(initialStatus);
    }, [questions]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleNext = () => {
        const currentQ = questions[currentIndex];
        if (!answers[currentQ.id]) {
            setStatus(prev => ({ ...prev, [currentQ.id]: 'NOT_ANSWERED' }));
        }
        if (currentIndex < questions.length - 1) {
            const nextIdx = currentIndex + 1;
            setCurrentIndex(nextIdx);
            const nextQ = questions[nextIdx];
            if (status[nextQ.id] === 'NOT_VISITED') {
                setStatus(prev => ({ ...prev, [nextQ.id]: 'NOT_ANSWERED' }));
            }
        }
    };

    const handleSaveAndNext = () => {
        const currentQ = questions[currentIndex];
        if (answers[currentQ.id]) {
            setStatus(prev => ({ ...prev, [currentQ.id]: 'ANSWERED' }));
        } else {
            setStatus(prev => ({ ...prev, [currentQ.id]: 'NOT_ANSWERED' }));
        }
        handleNext();
    };

    const handleMarkForReview = () => {
        const currentQ = questions[currentIndex];
        const isAnswered = !!answers[currentQ.id];
        setStatus(prev => ({ ...prev, [currentQ.id]: isAnswered ? 'MARKED_ANSWERED' : 'MARKED' }));
        handleNext();
    };

    const handleClearResponse = () => {
        const currentQ = questions[currentIndex];
        setAnswers(prev => {
            const newAns = { ...prev };
            delete newAns[currentQ.id];
            return newAns;
        });
        setStatus(prev => ({ ...prev, [currentQ.id]: 'NOT_ANSWERED' }));
    };

    const handleSubmit = async () => {
        if (!auth.currentUser) return;

        const totalQuestions = questions.length;
        const results = {
            testName: title,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            totalQuestions: totalQuestions,
            userId: auth.currentUser.uid,
            timestamp: new Date().toISOString(),
            answers: answers,
            questions: questions,
        };

        questions.forEach(q => {
            if (answers[q.id]) {
                if (answers[q.id] === q.correct_option) results.correct++;
                else results.incorrect++;
            } else {
                results.unattempted++;
            }
        });

        const obtainedMarks = (results.correct * 4) - (results.incorrect * 1);
        const totalPossibleMarks = totalQuestions * 4;
        const timeTakenSeconds = (totalQuestions * 60) - timeLeft;

        try {
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'results'), {
                ...results,
                obtainedMarks,
                totalPossibleMarks,
                percentage: Math.round((obtainedMarks / totalPossibleMarks) * 100) || 0,
                timeTakenSeconds,
                accuracy: (results.correct + results.incorrect) > 0 ? Math.round((results.correct / (results.correct + results.incorrect)) * 100) : 0,
                speed: Math.min(100, Math.round(((results.correct + results.incorrect) / (timeTakenSeconds / 60)) * 20)), // Arbitrary scaling for UI
                attemptedRate: Math.round(((results.correct + results.incorrect) / totalQuestions) * 100),
                difficulty: 'NTA Official',
            });
            setIsSubmitted(true);
        } catch (err) {
            console.error("Error submitting NTA test:", err);
            alert("Error saving results. Check console.");
        }
    };

    const currentQuestion = questions[currentIndex];
    const subjects = ['All', ...Array.from(new Set(questions.map(q => q.subject)))];
    const filteredQuestions = activeSubject === 'All' ? questions : questions.filter(q => q.subject === activeSubject);

    const [submissionTimer, setSubmissionTimer] = useState(120);
    useEffect(() => {
        let interval: any;
        if (isSubmitted && submissionTimer > 0) {
            interval = setInterval(() => {
                setSubmissionTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isSubmitted, submissionTimer]);

    const formatSubmissionTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isSubmitted) {
        return (
            <div className="fixed inset-0 bg-[#f4f7f9] z-[200] flex flex-col items-center justify-center p-6 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key="nta-submission"
                        initial={{ scale: 0.9, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md w-full"
                    >
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Test Submitted!</h2>
                        
                        {submissionTimer > 0 ? (
                            <>
                                <p className="text-gray-500 mb-2">Generating detailed NTA analysis...</p>
                                <div className="text-5xl font-mono font-bold text-blue-600 mb-8">{formatSubmissionTime(submissionTimer)}</div>
                                <button onClick={() => onBack()} className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold transition-all hover:bg-gray-200">
                                    Back to Home
                                </button>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <button onClick={() => onBack()} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200">
                                    View Detailed Analysis
                                </button>
                                <button onClick={() => onBack()} className="w-full text-gray-500 font-medium py-2">
                                    Back to Dashboard
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#f4f7f9] z-[150] flex flex-col overflow-hidden select-none">
            {/* NTA Top Bar */}
            <header className="bg-white border-b border-gray-200 flex items-center justify-between px-6 py-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <User className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Candidate Name</p>
                        <p className="text-xs font-bold text-gray-900">{auth.currentUser?.displayName || 'Aspirant'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-10">
                    <div className="flex flex-col items-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Time Left</p>
                        <div className="flex items-center gap-2 text-xl font-mono font-bold text-red-600">
                            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                        </div>
                    </div>
                    <button onClick={() => setShowSubmitModal(true)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-red-700 transition-colors">
                        Submit Test
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Content Area */}
                <main className="flex-1 flex flex-col bg-white overflow-hidden">
                    {/* Subject Tabs */}
                    <div className="flex border-b border-gray-100 bg-[#fafbfc]">
                        {subjects.map(s => (
                            <button 
                                key={s} 
                                onClick={() => setActiveSubject(s)}
                                className={`px-8 py-3 text-xs font-bold transition-all border-r border-gray-100 ${activeSubject === s ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {s.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-4xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-bold text-blue-600">Question {currentIndex + 1}</h3>
                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-600">
                                    <Info className="w-3 h-3" /> Mark: +4 | -1
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 border border-gray-100 p-8 rounded-3xl mb-10 text-xl font-medium text-gray-800 leading-relaxed">
                                {currentQuestion?.question}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(currentQuestion?.options || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                    <button 
                                        key={key}
                                        onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: key }))}
                                        className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${answers[currentQuestion?.id] === key ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${answers[currentQuestion?.id] === key ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-400 group-hover:border-gray-400'}`}>
                                            {key}
                                        </div>
                                        <span className={`text-base font-medium ${answers[currentQuestion?.id] === key ? 'text-gray-900' : 'text-gray-600'}`}>{value}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <footer className="bg-white border-t border-gray-200 p-6 flex justify-between shrink-0">
                        <div className="flex gap-3">
                            <button onClick={handleMarkForReview} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95">
                                Mark for Review & Next
                            </button>
                            <button onClick={handleClearResponse} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">
                                Clear Response
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)} className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 active:scale-95">
                                Previous
                            </button>
                            <button onClick={handleSaveAndNext} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-100 transition-all active:scale-95">
                                Save & Next
                            </button>
                        </div>
                    </footer>
                </main>

                {/* Right Sidebar - Palette */}
                <aside className="w-[320px] bg-white border-l border-gray-200 flex flex-col shrink-0">
                    <div className="p-6 border-b border-gray-100">
                        <h4 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-6">Question Palette</h4>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-500 rounded-sm" />
                                <span className="text-[10px] font-bold text-gray-500">Answered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-500 rounded-sm" />
                                <span className="text-[10px] font-bold text-gray-500">Not Answered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded-sm" />
                                <span className="text-[10px] font-bold text-gray-500">Not Visited</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-purple-600 rounded-sm" />
                                <span className="text-[10px] font-bold text-gray-500">Marked</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="grid grid-cols-5 gap-3">
                            {questions.map((q, idx) => {
                                const s = status[q.id];
                                let colorClass = 'bg-gray-100 text-gray-400 border-gray-200';
                                if (idx === currentIndex) colorClass = 'ring-2 ring-blue-600 ring-offset-2 bg-gray-100 text-gray-900 border-blue-600';
                                else if (s === 'ANSWERED') colorClass = 'bg-green-500 text-white border-green-500';
                                else if (s === 'NOT_ANSWERED') colorClass = 'bg-red-500 text-white border-red-500';
                                else if (s === 'MARKED') colorClass = 'bg-purple-600 text-white border-purple-600';
                                else if (s === 'MARKED_ANSWERED') colorClass = 'bg-purple-600 text-white border-purple-600 relative after:content-[\"\"] after:absolute after:bottom-1 after:right-1 after:w-1.5 after:h-1.5 after:bg-green-400 after:rounded-full';

                                return (
                                    <button 
                                        key={q.id}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border transition-all ${colorClass}`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-200 bg-gray-50">
                        <button onClick={() => setShowSubmitModal(true)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-50">
                            Submit Test
                        </button>
                    </div>
                </aside>
            </div>

            {/* Submit Confirmation Modal */}
            <AnimatePresence>
                {showSubmitModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                            <h3 className="text-2xl font-bold text-gray-900 mb-4">Finish Test?</h3>
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Answered</p>
                                    <p className="text-2xl font-bold text-green-600">{Object.values(status).filter(s => s === 'ANSWERED' || s === 'MARKED_ANSWERED').length}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Unattempted</p>
                                    <p className="text-2xl font-bold text-gray-600">{questions.length - Object.values(status).filter(s => s === 'ANSWERED' || s === 'MARKED_ANSWERED').length}</p>
                                </div>
                            </div>
                            <p className="text-gray-500 mb-8 text-sm">Are you sure you want to submit? You won't be able to change your answers after submission.</p>
                            <div className="flex gap-4">
                                <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-4 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                                <button onClick={handleSubmit} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700">Yes, Submit</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
