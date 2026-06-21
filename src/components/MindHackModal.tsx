import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { mindHackText } from '../data/mindHackData';

export default function MindHackModal({ onClose }: { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.9, opacity: 0, rotateY: 90 }}
                transition={{ duration: 0.5 }}
                className="bg-[#f4e4bc] text-[#2c1d0d] p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl relative border-4 border-[#d4b97f]"
            >
                <button onClick={onClose} className="absolute top-2 right-2 p-1 bg-[#d4b97f]/50 rounded-full">
                    <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold mb-4 text-center border-b-2 border-[#d4b97f] pb-2">🧠 दिमागी हैक्स (Mind Hacks)</h2>
                <div className="text-xs leading-relaxed whitespace-pre-line font-serif">
                    {mindHackText}
                </div>
            </motion.div>
        </motion.div>
    );
}
