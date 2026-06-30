import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react';
import AIStudyPlanChat from './AIStudyPlanChat';

export default function AIStudyPlanPage({ onBack, onNavigate }: { onBack: () => void, onNavigate: (view: any) => void }) {
    const [showPopup, setShowPopup] = useState(true);
    const [showChat, setShowChat] = useState(false);

    return (
        <div className="min-h-screen bg-[#f0f4f8] text-[#1e293b] font-sans relative">
            <button 
                onClick={onBack} 
                className="absolute top-4 left-4 flex items-center gap-2 text-sm font-bold bg-white/50 p-2 rounded-full shadow-sm"
            >
                <ArrowLeft className="h-5 w-5" /> Back
            </button>

            <div className="max-w-2xl mx-auto mt-10">
                <h1 className="text-3xl font-extrabold text-center mb-2">AI Study Plan</h1>
                <p className="text-center text-gray-600 mb-8">Your Personalized Roadmap To Success</p>
                
                <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-indigo-100">
                    <Sparkles className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-4 text-center">Ready to transform your productivity?</h2>
                    <p className="text-gray-700 leading-relaxed text-center mb-6">
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
                            className="w-full bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl shadow-sm hover:bg-indigo-200 transition"
                        >
                            Learn How It Works
                        </button>
                    </div>
                </div>
            </div>

            {showChat && <AIStudyPlanChat onClose={() => setShowChat(false)} />}

            <AnimatePresence>
                {showPopup && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#fffcf5] p-8 rounded-3xl shadow-2xl max-w-sm w-full border-4 border-[#d4b97f] relative"
                        >
                            <BookOpen className="h-12 w-12 text-[#d4b97f] mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-4 text-center text-[#2c1d0d]">How it Works</h2>
                            <ol className="text-sm leading-relaxed text-[#2c1d0d] space-y-4 list-decimal pl-5">
                                <li><strong>Share your day:</strong> Tell our AI about your daily routine, study hours, and commitments via live chat.</li>
                                <li><strong>Get personalized:</strong> Answer a few quick questions about your subjects and learning style.</li>
                                <li><strong>Get your plan:</strong> Receive a customized, optimized daily study schedule tailored specifically for you!</li>
                            </ol>
                            <button 
                                onClick={() => setShowPopup(false)}
                                className="mt-8 w-full bg-[#d4b97f] text-white font-bold py-3 rounded-xl shadow-md hover:bg-[#c4a96f] transition"
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
