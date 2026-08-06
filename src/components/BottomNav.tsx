import React from 'react';
import { Home, BarChart2, FileText, User as UserIcon, Book, Sparkles, Search, Bot } from 'lucide-react';
import { motion } from 'motion/react';

export default function BottomNav({ 
    currentView, 
    onNavigate 
}: { 
    currentView: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'technicalSupport' | 'analytics' | 'liveAI', 
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
            {/* Mobile Bottom Navigation Bar (Visible on phones < 768px) */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#0a0e1a]/95 backdrop-blur-lg border-t border-[#1E293B] p-2 z-[999]">
                <div className="max-w-md mx-auto flex justify-around">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                                    isActive 
                                        ? 'text-blue-400 font-semibold' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                                <span className="text-[10px] tracking-tight">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Desktop Left Navigation Sidebar (Visible on Laptop & Desktop >= 768px) */}
            <aside className="hidden md:flex flex-col fixed top-0 left-0 h-dvh w-64 bg-[#080d1a] border-r border-slate-800/80 z-[999] p-4 text-white shadow-2xl overflow-y-auto">
                {/* Desktop Brand Logo */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800/60"
                >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300">
                            NeetMaster
                        </h1>
                        <p className="text-[11px] text-blue-400/80 font-medium">AI NEET Mentor</p>
                    </div>
                </motion.div>

                {/* Main Desktop Navigation Items */}
                <div className="space-y-1.5 flex-1">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Navigation
                    </p>
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
                                className={`relative w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 group cursor-pointer ${
                                    isActive
                                        ? 'text-blue-400 border border-blue-500/40'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="desktopActiveTabNav"
                                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/25 via-indigo-600/15 to-cyan-600/5 shadow-md shadow-blue-500/10 z-0"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-3.5">
                                    <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                    <span className="font-semibold">{item.label}</span>
                                </div>
                                <kbd className="relative z-10 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900/80 text-slate-400 border border-slate-700/80 group-hover:border-slate-500 transition-colors">
                                    {item.shortcut}
                                </kbd>
                            </motion.button>
                        );
                    })}

                    {/* Quick Live AI Button */}
                    <div className="pt-4 mt-4 border-t border-slate-800/60">
                        <motion.button
                            onClick={() => onNavigate('liveAI')}
                            whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(59, 130, 246, 0.4)' }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-4 w-4 animate-pulse text-cyan-200" />
                                <span>Live Voice AI</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-bold">
                                TALK
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* Keyboard Shortcuts Hint Footer */}
                <div className="mt-auto pt-4 border-t border-slate-800/60 text-xs text-slate-400 space-y-2">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="flex items-center gap-1.5 text-[11px]">
                            <Search className="h-3.5 w-3.5 text-blue-400" /> AI Search
                        </span>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-300">
                            Ctrl + K
                        </kbd>
                    </div>
                </div>
            </aside>
        </>
    );
}
