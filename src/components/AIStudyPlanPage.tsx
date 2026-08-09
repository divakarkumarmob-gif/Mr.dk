import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Sparkles, PlusCircle } from 'lucide-react';
import { enableScreenshot, disableScreenshot } from '../utils/screenSecurity';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';
import AIStudyPlanChat from './AIStudyPlanChat';
import CreateCustomPlanPage from './CreateCustomPlanPage';

export default function AIStudyPlanPage({ onBack, onNavigate }: { onBack: () => void, onNavigate: (view: any) => void }) {
    const [showPopup, setShowPopup] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [showCustomPlan, setShowCustomPlan] = useState(false);

    useEffect(() => {
        enableScreenshot();
        return () => {
            disableScreenshot();
        };
    }, []);

    // Android Hardware Physical Back Button Handler
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (showCustomPlan) {
                setShowCustomPlan(false);
                return true;
            }
            if (showChat) {
                setShowChat(false);
                return true;
            }
            onBack();
            return true;
        });
        return unregister;
    }, [showCustomPlan, showChat, onBack]);

    if (showCustomPlan) {
        return <CreateCustomPlanPage onBack={() => setShowCustomPlan(false)} />;
    }

    return (
        <div className="min-h-dvh bg-[#0a0f24] text-white font-sans relative pt-[env(safe-area-inset-top,0px)] px-4">
            <button 
                onClick={onBack} 
                className="absolute top-[env(safe-area-inset-top,0px)] left-4 flex items-center gap-2 text-sm font-bold bg-white/10 text-white p-2 px-3.5 rounded-full shadow-sm z-10 hover:bg-white/20 border border-white/15 backdrop-blur-md cursor-pointer"
            >
                <ArrowLeft className="h-5 w-5 text-purple-300" /> Back
            </button>

            <div className="max-w-2xl mx-auto mt-12">
                <h1 className="text-3xl font-extrabold text-center mb-2 text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-blue-300 to-pink-300">AI Study Plan</h1>
                <p className="text-center text-purple-300/90 mb-8 font-medium">Your Personalized Roadmap To Success</p>
                
                <div className="bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-purple-500/25 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                    <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-xl font-bold mb-4 text-center text-white">Ready to transform your productivity?</h2>
                    <p className="text-slate-300 leading-relaxed text-center mb-6 text-sm sm:text-base">
                        Stop guessing how to study—let AI design your perfect day! Tell our AI about your routine, and get a schedule tailored just for you.
                    </p>
                    <div className="flex flex-col gap-3.5">
                        <button 
                            onClick={() => setShowChat(true)}
                            className="w-full gradient-btn-primary text-white font-bold py-3.5 rounded-2xl shadow-lg cursor-pointer"
                        >
                            Start AI Chat
                        </button>
                        <button 
                            onClick={() => setShowPopup(true)}
                            className="w-full gradient-btn-secondary text-purple-200 font-bold py-3.5 rounded-2xl cursor-pointer border border-purple-500/30"
                        >
                            Learn How It Works
                        </button>
                        <button 
                            onClick={() => setShowCustomPlan(true)}
                            className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-extrabold py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer hover:shadow-amber-500/30"
                        >
                            <PlusCircle className="h-5 w-5 stroke-[2.5]" /> Create Custom Plan
                        </button>
                    </div>
                </div>
            </div>

            {showChat && <AIStudyPlanChat onClose={() => setShowChat(false)} />}

            <AnimatePresence>
                {showPopup && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0a0f24] p-6 sm:p-8 rounded-3xl shadow-[0_0_50px_rgba(139,92,246,0.3)] max-w-sm w-full border border-purple-500/30 text-white relative"
                        >
                            <BookOpen className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-4 text-center text-white">How it Works</h2>
                            <ol className="text-sm leading-relaxed text-slate-300 space-y-4 list-decimal pl-5">
                                <li><strong className="text-purple-300">Bolo kya karna hai:</strong> Bas "Study Plan Banao" ya "Timetable Banao" bol do — AI samajh jayega.</li>
                                <li><strong className="text-purple-300">Routine batao:</strong> AI ek-ek karke tumhari daily routine (wake up time, school/coaching, sleep, etc.) puchega. Bas naturally jawab dete jana.</li>
                                <li><strong className="text-purple-300">Extra info share karo:</strong> Weak subjects, exam date, backlog, ya koi bhi cheez jo AI ko pata honi chahiye, bata sakte ho.</li>
                            </ol>
                            <button 
                                onClick={() => setShowPopup(false)}
                                className="w-full mt-6 gradient-btn-primary py-3 rounded-xl font-bold cursor-pointer"
                            >
                                Got it!
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
