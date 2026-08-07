import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Mic, Brain, ExternalLink, Smartphone, CheckCircle, Copy, Search, Zap } from 'lucide-react';
import { APP_WIDGETS, WidgetTarget, setPendingWidgetTarget } from '../utils/appWidgets';
import { showToast } from '../utils/toast';
import GoogleAiSearchWidget from './GoogleAiSearchWidget';

interface AppWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunchTarget: (target: 'neural_solver' | 'liveAI' | 'ai_search' | 'study') => void;
    isLoggedIn: boolean;
}

export default function AppWidgetModal({ isOpen, onClose, onLaunchTarget, isLoggedIn }: AppWidgetModalProps) {
    const [activeTab, setActiveTab] = useState<'widgets' | 'googleSearch'>('widgets');

    if (!isOpen) return null;

    const handleCopyLink = (url: string, name: string) => {
        navigator.clipboard.writeText(url).then(() => {
            showToast(`Copied ${name} Widget URL to clipboard!`);
        }).catch(() => {
            showToast('Failed to copy link.');
        });
    };

    const handleWidgetClick = (widget: WidgetTarget) => {
        if (isLoggedIn) {
            onClose();
            onLaunchTarget(widget.id);
        } else {
            setPendingWidgetTarget(widget.id);
            showToast(`Please Login first — You will be automatically redirected to ${widget.title}!`);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-lg bg-[#0F172A] border border-blue-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white leading-snug">Android Home Screen Widgets</h2>
                                <p className="text-xs text-blue-300">Instant 0ms AI Launchers & Google Search Bar</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition active:scale-95 text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 p-1 bg-slate-900/90 rounded-2xl border border-white/10 mb-4">
                        <button
                            onClick={() => setActiveTab('widgets')}
                            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
                                activeTab === 'widgets'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            📱 Widget Presets (4)
                        </button>
                        <button
                            onClick={() => setActiveTab('googleSearch')}
                            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition ${
                                activeTab === 'googleSearch'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            🔍 Google AI Search Widget
                        </button>
                    </div>

                    {/* Content View */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1">
                        {activeTab === 'googleSearch' ? (
                            <GoogleAiSearchWidget
                                onOpenNeuralSolver={() => {
                                    onClose();
                                    onLaunchTarget('neural_solver');
                                }}
                                onOpenLiveAI={() => {
                                    onClose();
                                    onLaunchTarget('liveAI');
                                }}
                            />
                        ) : (
                            APP_WIDGETS.map((widget) => (
                                <div
                                    key={widget.id}
                                    className="group relative bg-slate-900/90 border border-white/10 hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10"
                                >
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-900/50 via-indigo-900/50 to-purple-900/50 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                                                {widget.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                                                    {widget.title}
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                                                        0ms Instant
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{widget.description}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
                                        <button
                                            onClick={() => handleWidgetClick(widget)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-semibold text-xs text-white shadow-lg shadow-blue-600/20 transition active:scale-95"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Launch Widget
                                        </button>
                                        <button
                                            onClick={() => handleCopyLink(widget.webUrl, widget.title)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-xs text-gray-300 hover:text-white transition active:scale-95"
                                        >
                                            <Copy className="w-4 h-4 text-gray-400" />
                                            Copy Link
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Guide Card */}
                        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-200 leading-relaxed space-y-2">
                            <div className="font-bold text-white flex items-center gap-2 text-sm">
                                <Smartphone className="w-4 h-4 text-blue-400" />
                                How to Add Widgets to Android Home Screen
                            </div>
                            <ol className="list-decimal list-inside space-y-1.5 text-gray-300 pl-1">
                                <li>Long-press the <b>NEET Master AI</b> app icon on your phone's Home Screen.</li>
                                <li>Tap <b>Widgets</b> or <b>Shortcuts</b> in the popup menu.</li>
                                <li>Drag <b>🧠 Neural 2.0</b>, <b>🎙️ Live AI Voice</b>, or <b>🔍 Google AI Search</b> onto your Home Screen for 0ms direct access!</li>
                            </ol>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            Auto-Login Redirect Enabled
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition active:scale-95"
                        >
                            Done
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
