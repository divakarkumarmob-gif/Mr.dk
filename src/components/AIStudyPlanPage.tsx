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
        <div className="min-h-dvh bg-[#0f172a] text-white font-sans relative pt-[env(safe-area-inset-top,0px)] px-4">
            <button 
                onClick={onBack} 
                className="absolute top-[env(safe-area-inset-top,0px)] left-4 flex items-center gap-2 text-sm font-bold bg-white/10 text-white p-2 px-3.5 rounded-full shadow-sm z-10 hover:bg-white/20 border border-white/10"
            >
                <ArrowLeft className="h-5 w-5" /> Back
            </button>

            <div className="max-w-2xl mx-auto mt-12">
                <h1 className="text-3xl font-extrabold text-center mb-2 text-white">AI Study Plan</h1>
                <p className="text-center text-indigo-300 mb-8">Your Personalized Roadmap To Success</p>
                
                <div className="bg-[#1e293b] p-6 rounded-2xl shadow-xl border border-indigo-900/50 text-white">
                    <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-4 text-center text-white">Ready to transform your productivity?</h2>
                    <p className="text-gray-300 leading-relaxed text-center mb-6">
                        Stop guessing how to study—let AI design your perfect day! Tell our AI about your routine, and get a schedule tailored just for you.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => setShowChat(true)}
                            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition"
                        >
                            Start AI Chat
                        </button>
                        <button 
                            onClick={() => setShowPopup(true)}
                            className="w-full bg-white/10 text-indigo-200 font-bold py-3 rounded-xl shadow-sm hover:bg-white/20 transition border border-white/10"
                        >
                            Learn How It Works
                        </button>
                        <button 
                            onClick={() => setShowCustomPlan(true)}
                            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                        >
                            <PlusCircle className="h-5 w-5 stroke-[2.5]" /> Create Custom Plan
                        </button>
                    </div>
                </div>
            </div>

            {showChat && <AIStudyPlanChat onClose={() => setShowChat(false)} />}

            <AnimatePresence>
                {showPopup && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl max-w-sm w-full border-2 border-indigo-500/50 text-white relative"
                        >
                            <BookOpen className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-4 text-center text-white">How it Works</h2>
                            <ol className="text-sm leading-relaxed text-gray-300 space-y-4 list-decimal pl-5">
                                <li><strong className="text-white">Bolo kya karna hai:</strong> Bas "Study Plan Banao" ya "Timetable Banao" bol do — AI samajh jayega.</li>
                                <li><strong className="text-white">Routine batao:</strong> AI ek-ek karke tumhari daily routine (wake up time, school/coaching, sleep, etc.) puchega. Bas naturally jawab dete jana.</li>
                                <li><strong className="text-white">Extra info share karo:</strong> Weak subjects, exam date, backlog, ya koi bhi cheez jo AI ko pata honi chahiye, bata sakte ho.</li>
                                <li><strong className="text-white">Plan mangwao:</strong> Jab ready ho, "Study Plan Banao" bol do — AI tumhari poori routine ke hisaab se ek detailed, personalized schedule bana dega.</li>
                                <li><strong className="text-white">Modify karo:</strong> Plan pasand nahi aaya? Bata do, AI usko turant adjust kar dega.</li>
                            </ol>
                            <button 
                                onClick={() => setShowPopup(false)}
                                className="mt-8 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-indigo-700 transition"
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
