import React, { useState } from 'react';
import { toPng } from 'html-to-image';
import { Camera, Send, X, ShieldAlert, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useModalBackButton } from '../utils/hardwareBackButton';

export default function SupportModal({ isOpen, onClose, onConfirm, onSendReport }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, onSendReport: (screenshot: string, text: string) => void }) {
    useModalBackButton(isOpen, onClose);
    const [isSharing, setIsSharing] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [text, setText] = useState('');

    if (!isOpen) return null;

    const handleTakeScreenshot = async () => {
        try {
            const dataUrl = await toPng(document.body, {
                filter: (node) => node.id !== 'support-modal-container'
            });
            setScreenshot(dataUrl);
            setIsSharing(true);
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Failed to take screenshot.');
        }
    };

    const handleSendReport = async () => {
        if (!screenshot) return;
        
        try {
            onSendReport(screenshot, text);
            alert('Message & Screenshot sent to App Support!');
            setIsSharing(false);
            onClose();
        } catch (error) {
            console.error('Error sending report:', error);
            alert('Failed to send report.');
        }
    };

    return (
        <AnimatePresence>
            <div id="support-modal-container" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 selection:bg-blue-500/30">
                {/* Backdrop Blur Overlay */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {isSharing ? (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-[#0d152a] to-slate-950 p-6 rounded-3xl border border-white/15 shadow-2xl z-10 text-center space-y-4"
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                                    <Camera className="h-5 w-5 text-blue-400" />
                                </div>
                                <h2 className="text-base font-extrabold text-white">Visual Issue Report</h2>
                            </div>
                            <button onClick={() => setIsSharing(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {screenshot && (
                            <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-inner max-h-48 flex items-center justify-center">
                                <img
                                    src={screenshot}
                                    alt="Screenshot"
                                    className="max-h-48 object-contain w-full"
                                />
                                <span className="absolute bottom-2 right-2 text-[9px] bg-emerald-500/90 text-black px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Captured
                                </span>
                            </div>
                        )}

                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Describe the issue you faced in detail..."
                            className="w-full bg-white/5 text-white placeholder-gray-500 p-3.5 rounded-2xl border border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none h-24"
                        />

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button 
                                onClick={() => setIsSharing(false)} 
                                className="py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-extrabold text-xs text-gray-300 transition"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleSendReport} 
                                className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-extrabold text-xs text-white shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 transition active:scale-95"
                            >
                                <Send className="h-4 w-4" /> Send Report
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-[#0d152a] to-slate-950 p-6 rounded-3xl border border-white/15 shadow-2xl z-10 text-center space-y-4"
                    >
                        <div className="flex flex-col items-center">
                            <div className="p-3.5 bg-blue-500/20 rounded-2xl border border-blue-500/30 mb-2 shadow-lg">
                                <ShieldAlert className="h-7 w-7 text-blue-400" />
                            </div>
                            <h2 className="text-lg font-black text-white">Need Support or Report Problem?</h2>
                            <p className="text-xs text-gray-400 mt-1 max-w-xs">Our technical team & NEET mentors are here to help you 24/7.</p>
                        </div>

                        <div className="space-y-2.5 pt-2">
                            <button 
                                onClick={onConfirm} 
                                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-black text-xs text-white shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                <MessageSquare className="h-4 w-4" /> Open 1v1 Support Chat
                            </button>

                            <button 
                                onClick={handleTakeScreenshot} 
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-black text-xs text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                <Camera className="h-4 w-4" /> Capture Screen & Report Bug
                            </button>

                            <button 
                                onClick={onClose} 
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-extrabold text-xs text-gray-300 transition"
                            >
                                Dismiss / Close
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </AnimatePresence>
    );
}
