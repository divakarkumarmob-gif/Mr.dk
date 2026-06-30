import { User, Settings, Shield, LogOut, ChevronRight, Download, HelpCircle, Mail, Edit, Crown, Check, X as CloseIcon, Zap, Sparkles } from 'lucide-react';
import { logOut } from '../lib/auth';
import { User as FirebaseUser } from 'firebase/auth';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Pressable from './Pressable';

export default function Profile({ user, onNavigate, onSolverClick }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'technicalSupport' | 'notesLibrary' | 'mindHack' | 'aiStudyPlan' | 'ncertHub') => void, onSolverClick: () => void }) {
    const isAdmin = user?.email === 'divakarkumarmob@gmail.com' || user?.email === 'shashikumarmob@gmail.com';
    const [showPremium, setShowPremium] = useState(false);

    const FreeFeatures = [
        "Basic Study Hub Access",
        "Limited NTA Mock Tests",
        "Standard NCERT PDF View",
        "Limited Notes Storage"
    ];

    const ProFeatures = [
        "Neural AI Solver (Unlimited)",
        "Priority Mock Test Analysis",
        "Unlimited PDF Downloads",
        "Ad-Free Elite Experience",
        "2026 Chapter-wise PYQs",
        "Early Beta Feature Access"
    ];

    return (
        <div className="min-h-screen bg-background text-foreground font-sans pb-16 pt-[max(env(safe-area-inset-top,0px),40px)] px-[max(env(safe-area-inset-left,0px),16px)] pr-[max(env(safe-area-inset-right,0px),16px)]">
            <div className="max-w-full mx-auto w-full">
                {/* Header */}
            <div className="bg-card text-card-foreground rounded-lg p-2 border border-border mb-2 flex flex-col items-center">
                <div className="relative mb-1">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="h-6 w-6 text-muted-foreground" />
                        )}
                    </div>
                </div>
                <h2 className="text-base font-bold">{user?.displayName || 'Aspirant'}</h2>
                <p className="text-muted-foreground text-[10px] mb-2">{user?.email}</p>
                <Pressable onClick={() => onNavigate('editProfile')} className="bg-primary text-primary-foreground flex items-center gap-0.5 px-1.5 py-0 rounded-full font-bold text-[8px]">
                    <Edit className="h-2 w-2" /> EDIT PROFILE
                </Pressable>
            </div>

            {/* Vip Premium Card */}
            <Pressable 
                onClick={() => setShowPremium(true)}
                className="w-full bg-gradient-to-r from-[#D4AF37] via-[#F9D67E] to-[#D4AF37] p-[1.5px] rounded-xl mb-3 shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all"
            >
                <div className="bg-[#0a0f24] rounded-[11px] p-3 flex justify-between items-center h-full">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#D4AF37]/20 p-2 rounded-lg border border-[#D4AF37]/30">
                            <Crown className="h-5 w-5 text-[#D4AF37]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Vip Membership</h3>
                                <span className="text-[8px] bg-[#D4AF37] text-black px-1 py-0 rounded font-black">PRO</span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium tracking-tight">Unlocked: 2026 Elite Edition</p>
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#D4AF37]" />
                </div>
            </Pressable>

            <AnimatePresence>
                {showPremium && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPremium(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-[#0a0f24] rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
                        >
                            <div className="bg-gradient-to-b from-[#D4AF37]/20 to-transparent p-6 pt-8 text-center relative">
                                <button 
                                    onClick={() => setShowPremium(false)}
                                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400"
                                >
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                                <div className="inline-flex bg-[#D4AF37]/20 p-3 rounded-2xl mb-4 border border-[#D4AF37]/30">
                                    <Sparkles className="h-8 w-8 text-[#D4AF37]" />
                                </div>
                                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">Elite Upgrade</h2>
                                <p className="text-gray-400 text-xs">Unlock the complete NEET preparation toolkit</p>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3 opacity-60">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Free Tier</p>
                                        {FreeFeatures.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="h-3.5 w-3.5 rounded-full bg-gray-800 flex items-center justify-center">
                                                    <CloseIcon className="h-2 w-2 text-gray-500" />
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-medium">{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest pl-1">Pro Features</p>
                                        {ProFeatures.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="h-3.5 w-3.5 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/30">
                                                    <Check className="h-2 w-2 text-[#D4AF37]" />
                                                </div>
                                                <span className="text-[10px] text-white font-bold">{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <Pressable className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F9D67E] py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20">
                                        <Zap className="h-5 w-5 text-black fill-black" />
                                        <span className="text-sm font-black text-black uppercase tracking-tight">Get Premium Now</span>
                                    </Pressable>
                                    <p className="text-[9px] text-gray-500 text-center uppercase font-bold tracking-widest">Secure Payments via Razorpay</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* AI Intelligence */}
            <h3 className="text-muted-foreground text-[10px] font-bold mb-1.5 uppercase">AI Intelligence</h3>
            <Pressable onClick={onSolverClick} className="w-full text-left bg-primary text-primary-foreground p-2 rounded-lg mb-3 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><User className="h-4 w-4"/></div>
                    <div>
                        <p className="font-bold text-xs">Neural Doubt Solver</p>
                        <p className="text-[9px] opacity-70">CORE ACCESS V3.1</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
            </Pressable>
            
            {/* Mind Hack */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Pressable onClick={() => onNavigate('mindHack')} className="w-full text-left bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-1.5">
                        <div className="bg-white/20 p-1 rounded-md">🧠</div>
                        <p className="font-bold text-xs">Mind Hack</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                </Pressable>
            </motion.div>
            
            {/* AI Study Plan */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Pressable onClick={() => onNavigate('aiStudyPlan')} className="w-full text-left bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-1.5">
                        <div className="bg-white/20 p-1 rounded-md">📅</div>
                        <p className="font-bold text-xs">AI Study Plan</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                </Pressable>
            </motion.div>

            <div className="bg-blue-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><Shield className="h-4 w-4"/></div>
                    <div>
                        <p className="font-bold text-xs">Memory & Backup</p>
                        <p className="text-[9px] opacity-70">Access secure system data</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
            </div>

            {/* Support Network */}
            <h3 className="text-muted-foreground text-[10px] font-bold mb-1.5 uppercase">Support Network</h3>
            <Pressable onClick={() => onNavigate('notesLibrary')} className="w-full text-left bg-orange-500 text-white p-2 rounded-lg mb-2 flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                    <Download className="h-4 w-4"/>
                    <p className="font-bold text-xs">Download Notes</p>
                </div>
                <ChevronRight className="h-3 w-3" />
            </Pressable>
            
            <div className="space-y-1 mb-3 text-foreground">
                {isAdmin && (
                    <Pressable onClick={() => onNavigate('admin')} className="w-full text-left flex items-center justify-between p-1">
                        <div className="flex items-center gap-1.5 text-xs"><Shield className="h-4 w-4 text-orange-500"/><span>Admin Panel</span></div>
                        <ChevronRight className="h-3 w-3" />
                    </Pressable>
                )}
                <div className="flex items-center justify-between p-1">
                    <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs"><Mail className="h-4 w-4"/><span>@mr.divakar00</span></a>
                    <ChevronRight className="h-3 w-3" />
                </div>
                <Pressable onClick={() => onNavigate('technicalSupport')} className="w-full text-left flex items-center justify-between p-1">
                    <div className="flex items-center gap-1.5 text-xs"><HelpCircle className="h-4 w-4"/><span>Technical Support</span></div>
                    <ChevronRight className="h-3 w-3" />
                </Pressable>
            </div>

            <Pressable onClick={logOut} className="w-full bg-secondary text-secondary-foreground py-1.5 rounded-md font-bold flex items-center justify-center gap-1 text-[10px]">
                <LogOut className="h-3 w-3" /> END SESSION
            </Pressable>
          </div>
        </div>
    );
}