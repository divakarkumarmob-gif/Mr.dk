import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X } from 'lucide-react';

export default function HomeScreenShortcutPrompt({ onClose }: { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-[#0F172A] border border-white/10 rounded-3xl p-6 shadow-2xl"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-500/20 rounded-2xl">
                    <Smartphone className="h-8 w-8 text-blue-400" />
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Add to Home Screen</h3>
            <p className="text-gray-400 text-sm mb-6">
                Want quick access? Tap the browser menu and select "Add to Home Screen" to use NeetMaster like a native app.
            </p>
            <button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl text-white font-bold"
            >
                Got it
            </button>
        </motion.div>
    );
}
