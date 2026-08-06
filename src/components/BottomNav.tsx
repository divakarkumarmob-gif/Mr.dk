import React from 'react';
import { Home, BarChart2, FileText, User as UserIcon, Book, Sparkles, Command, Search, Bot } from 'lucide-react';

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
                <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800/60">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300">
                            NeetMaster
                        </h1>
                        <p className="text-[11px] text-blue-400/80 font-medium">AI NEET Mentor</p>
                    </div>
                </div>

                {/* Main Desktop Navigation Items */}
                <div className="space-y-1.5 flex-1">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Navigation
                    </p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all group ${
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/10 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/5'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                                    <span>{item.label}</span>
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 group-hover:border-slate-600">
                                    {item.shortcut}
                                </span>
                            </button>
                        );
                    })}

                    {/* Quick Live AI Button */}
                    <div className="pt-4 mt-4 border-t border-slate-800/60">
                        <button
                            onClick={() => onNavigate('liveAI')}
                            className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-2.5">
                                <Sparkles className="h-4 w-4 animate-pulse text-cyan-200" />
                                <span>Live Voice AI</span>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white">
                                Talk
                            </span>
                        </button>
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
