import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { mindHackPages } from '../data/mindHackData';

export default function MindHackPage({ onBack }: { onBack: () => void }) {
    const [currentPage, setCurrentPage] = useState(0);

    const handlePop = () => {
        const state = window.history.state;
        if (state && typeof state.mindHackPage === 'number') {
            setCurrentPage(state.mindHackPage);
        } else if (currentPage > 0) {
            setCurrentPage(0);
        }
    };

    useEffect(() => {
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [currentPage]);

    const handleNext = () => {
        const next = currentPage + 1;
        setCurrentPage(next);
        window.history.pushState({ ...window.history.state, mindHackPage: next }, '', window.location.href);
    };

    const handlePrev = () => {
        window.history.back();
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-[#f4e4bc] text-[#2c1d0d] font-serif relative"
        >
            <button 
                onClick={onBack} 
                className="absolute top-4 left-4 flex items-center gap-2 text-sm font-bold bg-[#d4b97f]/50 p-2 rounded-full"
            >
                <ArrowLeft className="h-5 w-5" /> Back
            </button>
            
            <div className="absolute top-4 right-4 flex gap-2">
                {currentPage > 0 && (
                    <button 
                        onClick={handlePrev} 
                        className="flex items-center gap-2 text-sm font-bold bg-[#d4b97f]/50 p-2 rounded-full"
                    >
                        <ArrowLeft className="h-5 w-5" /> Prev
                    </button>
                )}
                {currentPage < mindHackPages.length - 1 && (
                    <button 
                        onClick={handleNext} 
                        className="flex items-center gap-2 text-sm font-bold bg-[#d4b97f]/50 p-2 rounded-full"
                    >
                        Next <ArrowRight className="h-5 w-5" />
                    </button>
                )}
            </div>

            <h2 className="text-2xl font-bold mb-6 text-center border-b-2 border-[#d4b97f] pb-4">🧠 दिमागी हैक्स (Mind Hacks) {currentPage + 1} / {mindHackPages.length}</h2>
            
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm leading-relaxed whitespace-pre-line"
                >
                    {mindHackPages[currentPage]}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
