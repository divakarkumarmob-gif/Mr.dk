import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Menu, X, Hourglass, CheckCircle2 } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { generateNEETPdf } from '../lib/pdfUtils';
interface Question {
    id: string;
    question: string;
    options: { A: string; B: string; C: string; D: string; };
    correct_option: string;
    explanation: string;
}

interface PYQTestRunnerProps {
    questions: Question[];
    onBack: () => void;
    title: string;
    paperUrl?: string; // Added to allow viewing original PDF
    initialData?: {
        answers: Record<string, string>;
        marked: Record<string, boolean>;
        currentIndex: number;
        timeLeft: number;
    };
}

export default function PYQTestRunner(props: PYQTestRunnerProps) {
    const { questions = [], onBack, title, paperUrl, initialData } = props;
    const [currentIndex, setCurrentIndex] = useState(initialData?.currentIndex || 0);
    const [answers, setAnswers] = useState<Record<string, string>>(initialData?.answers || {});
    const [marked, setMarked] = useState<Record<string, boolean>>(initialData?.marked || {});
    const [showMenu, setShowMenu] = useState(false);
    const [activePdf, setActivePdf] = useState<{ url: string, title: string } | null>(null);
    const [timeLeft, setTimeLeft] = useState(initialData?.timeLeft || questions.length * 60);
    const [showQuitModal, setShowQuitModal] = useState(false);

    const onBackRef = useRef(onBack);
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onBackRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Initial push to trap back button
        window.history.pushState({ ...window.history.state, inTest: true }, '', window.location.href);
        
        const handlePopState = (event: PopStateEvent) => {
             const state = event.state;
             
             // If we were in a sub-view (PDF or Menu), we just let the pop happen (state changes)
             // and our effects will handle closing them if we push specific states for them.
             // But for now, we just check if we are still active.
             
             if (activePdf) {
                 setActivePdf(null);
                 window.history.pushState({ ...window.history.state, inTest: true }, '', window.location.href);
                 return;
             }
             if (showMenu) {
                 setShowMenu(false);
                 window.history.pushState({ ...window.history.state, inTest: true }, '', window.location.href);
                 return;
             }

             setShowQuitModal(true);
             // Re-push to keep trapping
             window.history.pushState({ ...window.history.state, inTest: true }, '', window.location.href);
        };
        window.addEventListener('popstate', handlePopState);

        return () => {
            clearInterval(timer);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [activePdf, showMenu]);

    const handleOpenPdf = (url: string, title: string) => {
        setActivePdf({ url, title });
        // We don't necessarily need to push here because handlePopState intercepts EVERYTHING
        // and we check if activePdf is open.
    };

    const handleMenuOpen = () => {
        setShowMenu(true);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const question = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

    const [isSubmitted, setIsSubmitted] = useState(false);
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

    const handleTestSubmit = async () => {
        if (!auth.currentUser) return alert("User not logged in");

        const correct = questions.reduce((acc, q) => {
            return acc + (answers[q.id] === q.correct_option ? 1 : 0);
        }, 0);
        
        const incorrect = questions.reduce((acc, q) => {
            if (answers[q.id] && answers[q.id] !== q.correct_option) {
                return acc + 1;
            }
            return acc;
        }, 0);
        
        const totalPossibleMarks = questions.length * 4;
        const obtainedMarks = (correct * 4) - (incorrect * 1);
        
        const attempted = Object.keys(answers).length;
        const total = questions.length;
        const timeTakenSeconds = (total * 60) - timeLeft;

        try {
            console.log("Attempting to submit test, auth.currentUser.uid:", auth.currentUser.uid);
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'results'), {
                testName: title,
                correct: correct,
                incorrect: incorrect,
                unattempted: total - (correct + incorrect),
                totalQuestions: total,
                totalPossibleMarks: totalPossibleMarks,
                obtainedMarks: obtainedMarks,
                percentage: Math.round((obtainedMarks / totalPossibleMarks) * 100) || 0,
                timeTakenSeconds: timeTakenSeconds || 0,
                accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) || 0 : 0,
                speed: timeTakenSeconds > 0 ? Math.round((attempted / (timeTakenSeconds / 60))) || 0 : 0,
                attemptedRate: total > 0 ? Math.round((attempted / total) * 100) || 0 : 0,
                difficulty: 'Moderate',
                topicAnalysis: [], // PYQ data doesn't have topics
                answers: answers,
                questions: questions, // ADDED: Save questions to enable detailed review
                timestamp: new Date().toISOString()
            });
            console.log("Test submitted successfully");
            localStorage.removeItem('resumeTestData');
            setIsSubmitted(true);
        } catch (err) {
            console.error("Critical error in handleTestSubmit:", err);
            // Enhanced error reporting
            const firestoreErrorInfo = {
                error: (err as Error).message,
                operationType: 'create',
                path: `users/${auth.currentUser.uid}/results`,
                authInfo: {
                    userId: auth.currentUser.uid,
                    email: auth.currentUser.email,
                }
            };
            console.error('Firestore Error Detailed:', JSON.stringify(firestoreErrorInfo));
            alert("Error saving test results: " + (err as Error).message);
        }
    };

    // Progress Visualization
    const totalTime = questions.length * 60;
    const progress = (timeLeft / totalTime) * 100;

    const handleExitWithoutSaving = () => {
        const resumeData = {
            questions,
            title,
            answers,
            marked,
            currentIndex,
            timeLeft,
            timestamp: Date.now(),
        };
        localStorage.setItem('resumeTestData', JSON.stringify(resumeData));
        onBack();
    };

    if (isSubmitted) {
        return (
            <div className="fixed inset-0 bg-[#0a0f24] z-[100] flex flex-col items-center justify-center text-white p-6 text-center">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key="submission-screen"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-sm w-full"
                    >
                        <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                            <CheckCircle2 className="w-10 h-10 text-blue-400" />
                        </div>
                        <h2 className="text-3xl font-bold mb-4">Test Submitted!</h2>
                        {submissionTimer > 0 ? (
                            <>
                                <p className="text-xl mb-2 opacity-80">Analyzing results...</p>
                                <div className="text-6xl font-bold text-blue-400 mb-8 font-mono">{formatSubmissionTime(submissionTimer)}</div>
                                <p className="text-gray-400 text-sm mb-10">Please wait while our AI engine processes your behavioral performance and generates detailed insights.</p>
                                
                                <button 
                                    onClick={() => onBack()} 
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold transition-all hover:bg-white/10 active:scale-95"
                                >
                                    Go to Home
                                </button>
                                <p className="mt-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Analysis will be available in History</p>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <button onClick={() => onBack()} className="w-full bg-blue-600 text-white text-xl py-5 rounded-2xl font-bold shadow-xl shadow-blue-600/20 active:scale-95 transition-all">See Results</button>
                                <button 
                                    onClick={() => onBack()} 
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-medium transition-all hover:bg-white/10 opacity-60"
                                >
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
        <div className="fixed inset-0 bg-white text-gray-900 font-sans z-[100] flex flex-col">
            {/* Quit Confirmation Modal */}
            {showQuitModal && (
                <div className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center p-6">
                    <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm">
                        <p className="mb-6 font-semibold">Are you sure you want to quit the test?</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={handleTestSubmit} className="py-3 bg-blue-600 text-white rounded-xl font-bold">Yes, submit test</button>
                            <button onClick={() => setShowQuitModal(false)} className="py-3 border border-gray-200 rounded-xl font-bold">No, back to test</button>
                            <button onClick={handleExitWithoutSaving} className="py-3 text-red-600 font-bold">Exit without saving</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Confirmation Modal */}
            {showConfirmSubmit && (
                <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-6">
                    <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm">
                        <p className="mb-6 font-semibold">Are you sure to submit test?</p>
                        <div className="flex gap-4">
                            <button onClick={() => setShowConfirmSubmit(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold">No</button>
                            <button onClick={handleTestSubmit} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Yes</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top,0px),40px)] border-b border-gray-100 bg-white sticky top-0 z-10">
                <button onClick={() => setShowQuitModal(true)} className="text-gray-900"><ChevronLeft /></button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm text-gray-900">{title}</h1>
                    <div className="text-red-500 font-bold flex items-center gap-1 text-xs">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div className="h-full bg-red-500" animate={{ width: `${progress}%` }} />
                        </div>
                        <Hourglass className="w-3 h-3" /> {formatTime(timeLeft)}
                    </div>
                </div>
                <button onClick={() => setShowMenu(true)} className="flex flex-col gap-0.5"><div className="w-3 h-1 bg-gray-800 rounded-sm"></div><div className="w-3 h-1 bg-gray-800 rounded-sm"></div><div className="w-3 h-1 bg-gray-800 rounded-sm"></div></button>
            </div>

            {/* Question Area */}
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-semibold text-gray-600">Question {currentIndex + 1} / {questions.length}</span>
                    <button 
                        onClick={() => setMarked(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                        className={`text-xs px-4 py-1.5 rounded-full border ${marked[question.id] ? 'border-blue-600 text-blue-600' : 'border-gray-300 text-gray-600'}`}
                    >
                        {marked[question.id] ? 'Marked' : 'Mark for Review'}
                    </button>
                </div>
                <div className="bg-white p-6 rounded-2xl mb-6 border border-gray-100 shadow-sm">
                    {/* Improved Match the Following Layout Detection */}
                    {question?.question.toLowerCase().includes('list i') && question?.question.toLowerCase().includes('list ii') ? (
                        <div className="space-y-4">
                            <p className="text-lg font-bold text-gray-900 mb-4">{question.question.split('List I')[0].trim() || 'Match the following:'}</p>
                            <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">List I</h4>
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {question.question.split('List I')[1]?.split('List II')[0]?.trim()}
                                    </div>
                                </div>
                                <div className="space-y-2 border-l border-gray-200 pl-6">
                                    <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider">List II</h4>
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {question.question.split('List II')[1]?.trim()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-lg font-medium text-gray-900">{question?.question}</p>
                    )}
                </div>
                <div className="space-y-4">
                    {Object.entries(question?.options || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                        <button 
                            key={key}
                            onClick={() => question && setAnswers(prev => ({ ...prev, [question.id]: key }))}
                            className={`w-full p-4 rounded-xl text-left border flex items-center ${answers[question?.id || ''] === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                        >
                            <span className={`font-bold mr-3 w-8 h-8 flex items-center justify-center rounded-full border ${answers[question?.id || ''] === key ? 'border-blue-500 text-blue-500' : 'border-gray-300 text-gray-500'}`}>{key}</span> {value}
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div className="p-4 border-t border-gray-100 flex justify-between bg-white">
                <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="px-6 py-3 bg-gray-100 rounded-xl font-bold disabled:opacity-50 text-gray-600">Previous</button>
                <button onClick={isLastQuestion ? () => setShowConfirmSubmit(true) : () => setCurrentIndex(prev => prev + 1)} className={`px-8 py-3 rounded-xl font-bold ${isLastQuestion ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                    {isLastQuestion ? 'Submit Test' : 'Next'}
                </button>
            </div>

            {/* Menu Drawer */}
            <AnimatePresence>
                {showMenu && (
                    <>
                        <div className="fixed inset-0 bg-black/30 z-[105]" onClick={() => setShowMenu(false)} />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-[80%] bg-white z-[110] p-6 flex flex-col shadow-2xl">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-xl font-bold text-gray-900">Questions</h2>
                                <button onClick={() => setShowMenu(false)}><X /></button>
                            </div>
                            <div className="flex-grow overflow-y-auto pb-24">
                                {questions && questions.length > 0 && (
                                    <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="text-xs text-gray-500 mb-2 font-semibold">NEED THE FULL PAPER?</p>
                                        <button 
                                            onClick={() => {
                                                console.log(`[PDF] Generating paper PDF from runner: ${title}`);
                                                const parts = title.split(' (');
                                                const year = parts[0];
                                                const subject = parts[1]?.replace(')', '') || '';
                                                
                                                try {
                                                    const pdfUrl = generateNEETPdf({
                                                        exam: 'NEET',
                                                        year: year,
                                                        subject: subject,
                                                        questions: questions
                                                    }, true);
                                                    
                                                    console.log(`[PDF] Generated Blob URL: ${pdfUrl}`);
                                                    
                                                    setActivePdf({
                                                        url: pdfUrl,
                                                        title: `Paper: ${title}`
                                                    });
                                                } catch (err) {
                                                    console.error("[PDF] Generation failed in runner:", err);
                                                    alert("Failed to generate PDF. Check console for details.");
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                                        >
                                            Generate Paper PDF 📄
                                        </button>
                                    </div>
                                )}
                                <div className="grid grid-cols-5 gap-4">
                                    {questions.map((q, i) => (
                                        <button key={q.id} onClick={() => { setCurrentIndex(i); setShowMenu(false); }} className={`w-12 h-12 rounded-lg flex items-center justify-center border font-semibold ${answers[q.id] ? 'bg-green-100 border-green-500 text-green-700' : marked[q.id] ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="w-full bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-200" onClick={() => setShowConfirmSubmit(true)}>Submit Test</button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {activePdf && (
                <AdvancedPDFViewer 
                    pdfUrl={activePdf.url} 
                    title={activePdf.title} 
                    onClose={() => setActivePdf(null)} 
                />
            )}
        </div>
    );
}
