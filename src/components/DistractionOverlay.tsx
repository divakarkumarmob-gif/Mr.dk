import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export default function DistractionOverlay({ isLooking }: { isLooking: boolean }) {
    return (
        <AnimatePresence>
            {!isLooking && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[2500] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-4 pointer-events-none"
                >
                    <AlertTriangle className="h-16 w-16 text-amber-500 mb-4 animate-bounce" />
                    <h1 className="text-3xl font-bold text-white mb-2">Focus Please!</h1>
                    <p className="text-white/70">Returning gaze to the screen will clear this overlay.</p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
