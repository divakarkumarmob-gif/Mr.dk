import React from 'react';
import { Home, BarChart2, FileText, User as UserIcon, Book, Sparkles, Search, Bot, Flame } from 'lucide-react';
import { motion } from 'motion/react';

export default function BottomNav({ 
    currentView, 
    onNavigate 
}: { 
    currentView: string, 
    onNavigate: (view: any) => void 
}) {
    const navItems = [
        { id: 'home', label: 'Home', icon: Home, shortcut: '1' },
        { id: 'tests', label: 'Tests', icon: FileText, shortcut: '2' },
        { id: 'analytics', label: 'Analytics', icon: BarChart2, shortcut: '3' },
        { id: 'notes', label: 'NCERT Notes', icon: Book, shortcut: '4' },
        { id: 'profile', label: 'Profile', icon: UserIcon, shortcut: '5' },
    ];

    return (
        <>
            {/* Mobile Bottom Floating Navigation Bar (Visible on phones < 768px) */}
            <div className="md:hidden fixed bottom-3 left-3 right-3 z-[999] pointer-events-none">
                <div className="pointer-events-auto max-w-md mx-auto bg-[#0a0f24]/85 backdrop-blur-xl border border-purple-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-2xl p-1.5 flex items-center justify-around relative overflow-hidden">
                    {/* Top ambient glowing line inside nav */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
                    
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
                                    isActive 
                                        ? 'text-purple-300 font-semibold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavActivePill"
                                        className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-pink-500/20 rounded-xl border border-purple-500/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                                    />
                                )}
                                <div className="relative z-10 flex flex-col items-center gap-0.5">
                                    <Icon className={`h-5 w-5 ${isActive ? 'scale-110 text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-slate-400'} transition-transform duration-200`} />
                                    <span className="text-[10px] tracking-tight font-medium">{item.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Desktop Left Navigation Sidebar (Visible on Laptop & Desktop >= 768px) */}
            <aside className="hidden md:flex flex-col fixed top-0 left-0 h-dvh w-64 bg-[#0a0f24]/90 backdrop-blur-2xl border-r border-purple-500/20 z-[999] p-4 text-white shadow-[10px_0_30px_rgba(0,0,0,0.5)] overflow-y-auto">
                {/* Ambient background glow inside sidebar */}
                <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-purple-600/15 via-blue-600/10 to-transparent pointer-events-none" />

                {/* Desktop Brand Logo */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative z-10 flex items-center gap-3 px-3 py-4 mb-6 border-b border-purple-500/20"
                >
                    <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 p-[1px] shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                        <div className="h-full w-full rounded-[15px] bg-[#0a0f24] flex items-center justify-center">
                            <Bot className="h-6 w-6 text-purple-400 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h1 className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-blue-300 to-pink-400">
                            NeetMaster
                        </h1>
                        <p className="text-[11px] text-purple-300/90 font-medium flex items-center gap-1">
                            <span>AI NEET Mentor</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                        </p>
                    </div>
                </motion.div>

                {/* Main Desktop Navigation Items */}
                <div className="relative z-10 space-y-1.5 flex-1">
                    <div className="flex items-center justify-between px-3 mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Navigation
                        </p>
                        <span className="text-[10px] text-purple-300 font-mono flex items-center gap-1 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/40">
                            <Flame className="h-3 w-3 text-amber-400 fill-amber-400" /> NEET 2026
                        </span>
                    </div>

                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <motion.button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className={`relative w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group cursor-pointer ${
                                    isActive
                                        ? 'text-purple-200 font-bold'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="desktopActiveTabNav"
                                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-transparent border-l-4 border-purple-400 shadow-[inset_0_0_15px_rgba(139,92,246,0.2)] z-0"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-3.5">
                                    <Icon className={`h-5 w-5 transition-all duration-200 group-hover:scale-110 ${isActive ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                    <span>{item.label}</span>
                                </div>
                                <kbd className="relative z-10 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900/90 text-slate-400 border border-slate-800 group-hover:border-slate-700 transition-colors">
                                    {item.shortcut}
                                </kbd>
                            </motion.button>
                        );
                    })}

                    {/* Quick Live AI Button */}
                    <div className="pt-5 mt-4 border-t border-purple-500/20">
                        <motion.button
                            onClick={() => onNavigate('liveAI')}
                            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)' }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="relative overflow-hidden w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 cursor-pointer border border-purple-300/30 group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                            <div className="relative z-10 flex items-center gap-3">
                                <Sparkles className="h-4 w-4 animate-spin text-purple-200" style={{ animationDuration: '4s' }} />
                                <span className="tracking-wide">Live Voice AI</span>
                            </div>
                            <span className="relative z-10 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-md text-purple-200 font-extrabold border border-purple-400/30">
                                TALK
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* Keyboard Shortcuts Hint Footer */}
                <div className="relative z-10 mt-auto pt-4 border-t border-purple-500/20 text-xs text-slate-400 space-y-2">
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-purple-500/20 shadow-inner">
                        <span className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                            <Search className="h-3.5 w-3.5 text-purple-400" /> AI Doubts Search
                        </span>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-purple-300">
                            Ctrl + K
                        </kbd>
                    </div>
                </div>
            </aside>
        </>
    );
}


