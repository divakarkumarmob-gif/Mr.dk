import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Target, AlertTriangle } from 'lucide-react';
import FocusAnalytics from './FocusAnalytics';

export default function FocusSessionSummary({ 
    focusedTime, 
    distractedTime, 
    onClose 
}: { 
    focusedTime: number, 
    distractedTime: number, 
    onClose: () => void 
}) {
    const totalTime = focusedTime + distractedTime;
    const focusPercentage = totalTime > 0 ? Math.round((focusedTime / totalTime) * 100) : 0;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <div 
                    className="bg-zinc-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">Session Summary</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                            <X className="text-white" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-zinc-800 p-4 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Clock className="text-blue-400" />
                                <span className="text-zinc-300">Total Duration</span>
                            </div>
                            <span className="text-white font-mono">{Math.floor(totalTime / 60000)}m {Math.floor((totalTime % 60000) / 1000)}s</span>
                        </div>

                        <div className="flex items-center justify-between bg-zinc-800 p-4 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Target className="text-emerald-400" />
                                <span className="text-zinc-300">Focused Time</span>
                            </div>
                            <span className="text-emerald-400 font-mono">{Math.floor(focusedTime / 60000)}m {Math.floor((focusedTime % 60000) / 1000)}s</span>
                        </div>

                        <div className="flex items-center justify-between bg-zinc-800 p-4 rounded-xl">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-amber-400" />
                                <span className="text-zinc-300">Distracted Time</span>
                            </div>
                            <span className="text-amber-400 font-mono">{Math.floor(distractedTime / 60000)}m {Math.floor((distractedTime % 60000) / 1000)}s</span>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <div className="text-5xl font-bold text-white mb-2">{focusPercentage}%</div>
                        <div className="text-zinc-400">Focus Efficiency</div>
                    </div>
                    
                    <FocusAnalytics />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
