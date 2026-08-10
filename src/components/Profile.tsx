import React, { useState, useEffect } from 'react';
import { User, Settings, Shield, LogOut, ChevronRight, Download, HelpCircle, Mail, Edit, Crown, Check, X as CloseIcon, Zap, Sparkles, Search, Bot, Brain, Calendar, Database, Star, Lock } from 'lucide-react';
import { logOut } from '../lib/auth';
import { clearGuestData } from '../lib/clearGuestData';
import { User as FirebaseUser } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Pressable from './Pressable';
import PinSetupModal from './e2ee/PinSetupModal';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getUserDevices, revokeDevice, DeviceInfo } from '../utils/e2ee';
import { removeSession } from '../utils/e2ee/sessionManager';
import { Smartphone, Laptop, Trash2 } from 'lucide-react';

export default function Profile({ user, onNavigate, onSolverClick, onLogout }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'technicalSupport' | 'notesLibrary' | 'mindHack' | 'aiStudyPlan' | 'ncertHub' | 'schoolSearch' | 'about') => void, onSolverClick: () => void, onLogout: () => void }) {
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        if (!user) {
            setIsAdmin(false);
            return;
        }
        const authUser = typeof (user as any)?.getIdTokenResult === 'function'
            ? user
            : (auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function' ? auth.currentUser : null);

        if (authUser) {
            authUser.getIdTokenResult().then(result => {
                setIsAdmin(result.claims.admin === true);
            }).catch(() => {
                setIsAdmin(false);
            });
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    const [showPremium, setShowPremium] = useState(false);
    const [sessions, setSessions] = useState<DeviceInfo[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
    const navigate = useNavigate();

    // Load linked devices/sessions in realtime
    useEffect(() => {
        if (!user?.uid) return;
        setSessionsLoading(true);
        const unsub = onSnapshot(
            collection(db, 'users', user.uid, 'sessions'),
            async (snap) => {
                const currentDeviceId = sessionStorage.getItem('neet_session_token');
                const list: DeviceInfo[] = snap.docs.map(d => ({
                    deviceId: d.id,
                    deviceName: (d.data().userAgent || '').includes('Android') || (d.data().userAgent || '').includes('iPhone')
                        ? 'Mobile Device' : 'Desktop/Browser',
                    userAgent: d.data().userAgent || '',
                    platform: d.data().deviceType || 'unknown',
                    registeredAt: d.data().createdAt,
                    lastActive: d.data().lastActive,
                    isCurrent: d.id === currentDeviceId
                }));
                list.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
                setSessions(list);
                setSessionsLoading(false);
            },
            () => setSessionsLoading(false)
        );
        return () => unsub();
    }, [user?.uid]);

    const handleRevokeSession = async (deviceId: string, isCurrent: boolean) => {
        if (!user?.uid) return;
        setRevokingSessionId(deviceId);
        // Instantly remove device/session from UI list ("name bhi hat jaye")
        setSessions(prev => prev.filter(s => s.deviceId !== deviceId));
        try {
            await revokeDevice(user.uid, deviceId);
            if (isCurrent) {
                await removeSession(user.uid).catch(console.error);
                if (user.uid.startsWith('local_guest_')) {
                    await clearGuestData(user.uid).catch(console.error);
                }
                await logOut().catch(console.error);
                onLogout();
            }
        } catch (e) {
            console.error('Session revoke error:', e);
        } finally {
            setRevokingSessionId(null);
        }
    };

    // E2EE Chat Backup status - identity is already created silently at
    // login; this only tracks whether the user has opted in to an
    // encrypted PIN backup of it yet.
    const [backupEnabled, setBackupEnabled] = useState<boolean | null>(null);
    const [showBackupPinModal, setShowBackupPinModal] = useState(false);

    useEffect(() => {
        if (!user) {
            setBackupEnabled(null);
            return;
        }
        let isMounted = true;
        getDoc(doc(db, 'users', user.uid)).then(snap => {
            if (!isMounted) return;
            setBackupEnabled(!!snap.data()?.e2eeBackupEnabled);
        }).catch(() => {
            if (isMounted) setBackupEnabled(false);
        });
        return () => { isMounted = false; };
    }, [user]);

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

    const handleLogOut = async () => {
        if (user?.uid) {
            await removeSession(user.uid).catch(console.error);
            if (user.uid.startsWith('local_guest_')) {
                await clearGuestData(user.uid).catch(console.error);
            }
        }
        await logOut().catch(console.error);
        onLogout();
    };

    return (
        <div className="min-h-dvh bg-gradient-to-b from-[#070B19] via-[#0A0F24] to-[#05070E] text-white font-sans pb-24 pt-2 px-3 sm:px-4 selection:bg-blue-500/30">
            <div className="max-w-md mx-auto w-full space-y-4">
                
                {/* Modern Glassmorphic Profile Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-blue-950/40 to-slate-900/90 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl text-center"
                >
                    {/* Ambient Background Glow */}
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="relative mb-3 group">
                            <div className="w-20 h-20 bg-slate-800/80 rounded-full p-1 ring-2 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <User className="h-10 w-10 text-blue-400" />
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-amber-400 text-black p-1 rounded-full shadow-lg border border-slate-950" title="NEET Aspirant PRO">
                                <Crown className="h-3.5 w-3.5 fill-black" />
                            </div>
                        </div>

                        <h2 className="text-lg font-black text-white tracking-tight">{user?.displayName || 'NEET Aspirant'}</h2>
                        <p className="text-gray-400 text-xs font-medium mb-3">{user?.email || 'aspirant@neetmaster.ai'}</p>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/edit-profile')}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-xs shadow-lg shadow-blue-500/25 transition-all"
                        >
                            <Edit className="h-3.5 w-3.5" /> EDIT PROFILE
                        </motion.button>
                    </div>
                </motion.div>

                {/* VIP Membership Banner (Glowing Gold Card) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                >
                    <Pressable 
                        onClick={() => setShowPremium(true)}
                        className="w-full relative overflow-hidden bg-gradient-to-r from-amber-950/50 via-yellow-900/30 to-slate-950 p-4 rounded-3xl border border-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.35)] transition-all flex items-center justify-between group backdrop-blur-xl"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center gap-3.5 relative z-10">
                            <div className="bg-amber-400/20 p-3 rounded-2xl border border-amber-400/30 shadow-inner">
                                <Crown className="h-6 w-6 text-amber-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider italic">Vip Membership</h3>
                                    <span className="text-[9px] bg-gradient-to-r from-amber-400 to-yellow-300 text-black px-1.5 py-0.5 rounded-md font-black shadow-sm">PRO 2026</span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium tracking-tight mt-0.5">Unlocked: 2026 Elite NEET Edition</p>
                            </div>
                        </div>

                        <ChevronRight className="h-5 w-5 text-amber-400 group-hover:translate-x-1 transition-transform relative z-10" />
                    </Pressable>
                </motion.div>

                {/* Premium Modal Popup */}
                <AnimatePresence>
                    {showPremium && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowPremium(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            />
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="relative w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl z-10"
                            >
                                <div className="bg-gradient-to-b from-amber-500/20 via-slate-900/60 to-slate-900 p-6 pt-8 text-center relative">
                                    <button 
                                        onClick={() => setShowPremium(false)}
                                        className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 transition"
                                    >
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                    <div className="inline-flex bg-amber-400/20 p-3 rounded-2xl mb-3 border border-amber-400/30">
                                        <Sparkles className="h-8 w-8 text-amber-400" />
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
                                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest pl-1">Pro Features</p>
                                            {ProFeatures.map((f, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <div className="h-3.5 w-3.5 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/30">
                                                        <Check className="h-2 w-2 text-amber-400" />
                                                    </div>
                                                    <span className="text-[10px] text-white font-bold">{f}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <Pressable className="w-full bg-gradient-to-r from-amber-400 to-yellow-300 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 active:scale-95 transition">
                                            <Zap className="h-5 w-5 text-black fill-black" />
                                            <span className="text-sm font-black text-black uppercase tracking-tight">Get Premium Now</span>
                                        </Pressable>
                                        <p className="text-[9px] text-gray-500 text-center uppercase font-bold tracking-widest">100% Encrypted & Secure Access</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* AI Intelligence Section */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="space-y-2.5"
                >
                    <h3 className="text-blue-400 text-[11px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-400" /> AI Intelligence Suite
                    </h3>

                    {/* Neural Doubt Solver Card */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Pressable onClick={onSolverClick} className="w-full text-left bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white p-3.5 rounded-2xl flex justify-between items-center shadow-[0_4px_20px_rgba(37,99,235,0.3)] border border-blue-400/30">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm leading-tight">Neural Doubt Solver</p>
                                    <p className="text-[10px] text-blue-100/80 font-medium mt-0.5">CORE ACCESS V3.1 • Instant Solutions</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-white/80" />
                        </Pressable>
                    </motion.div>
                    
                    {/* Mind Hack Card */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Pressable onClick={() => onNavigate('mindHack')} className="w-full text-left bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white p-3.5 rounded-2xl flex justify-between items-center shadow-[0_4px_20px_rgba(147,51,234,0.3)] border border-purple-400/30">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                    <Brain className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm leading-tight">Mind Hack</p>
                                    <p className="text-[10px] text-purple-100/80 font-medium mt-0.5">Memory Booster & Tricks</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-white/80" />
                        </Pressable>
                    </motion.div>
                    
                    {/* AI Study Plan Card */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Pressable onClick={() => onNavigate('aiStudyPlan')} className="w-full text-left bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-3.5 rounded-2xl flex justify-between items-center shadow-[0_4px_20px_rgba(16,185,129,0.3)] border border-emerald-400/30">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm leading-tight">AI Study Plan</p>
                                    <p className="text-[10px] text-emerald-100/80 font-medium mt-0.5">Custom NEET Routine</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-white/80" />
                        </Pressable>
                    </motion.div>

                    {/* Memory & Backup Card */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <div className="bg-gradient-to-r from-blue-950/60 to-indigo-950/60 text-blue-300 p-3.5 rounded-2xl flex justify-between items-center border border-blue-500/30 backdrop-blur-xl shadow-lg cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30">
                                    <Database className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm text-white leading-tight">Memory & System Backup</p>
                                    <p className="text-[10px] text-blue-300/80 font-medium mt-0.5">Access Encrypted Cloud Sync</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-blue-400" />
                        </div>
                    </motion.div>

                    {/* Chat Backup PIN Card - E2EE identity is already active
                        for every user automatically; this only sets up the
                        OPTIONAL encrypted backup that lets a new device
                        restore it later. */}
                    {user && (
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Pressable
                                onClick={() => setShowBackupPinModal(true)}
                                className="w-full text-left bg-gradient-to-r from-emerald-950/60 to-teal-950/60 text-emerald-300 p-3.5 rounded-2xl flex justify-between items-center border border-emerald-500/30 backdrop-blur-xl shadow-lg cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                                        <Lock className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-sm text-white leading-tight">Chat Backup PIN</p>
                                        <p className="text-[10px] text-emerald-300/80 font-medium mt-0.5">
                                            {backupEnabled === null ? 'Checking status...' : backupEnabled ? 'Enabled - chats restorable on new device' : 'Not set up - enable to protect against device loss'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-emerald-400" />
                            </Pressable>
                        </motion.div>
                    )}
                </motion.div>

                {/* Support Network & Utilities */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="space-y-2.5 pt-2"
                >
                    <h3 className="text-orange-400 text-[11px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-orange-400" /> Support Network & Hubs
                    </h3>

                    {/* Download Notes Card */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Pressable onClick={() => navigate('/notes-library')} className="w-full text-left bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white p-3.5 rounded-2xl flex justify-between items-center shadow-[0_4px_20px_rgba(249,115,22,0.3)] border border-orange-400/30">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                    <Download className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm leading-tight">Download Notes Library</p>
                                    <p className="text-[10px] text-orange-100/80 font-medium mt-0.5">Offline Revision PDFs</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-white/80" />
                        </Pressable>
                    </motion.div>
                    
                    {/* Glassmorphic Navigation Links */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl divide-y divide-white/5 space-y-1">
                        {isAdmin && (
                            <Pressable onClick={() => onNavigate('admin')} className="w-full text-left flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-colors">
                                <div className="flex items-center gap-2.5 text-xs font-bold text-orange-400">
                                    <Shield className="h-4 w-4" />
                                    <span>Admin Master Panel</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            </Pressable>
                        )}

                        <div className="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-colors">
                            <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-xs font-medium text-gray-200">
                                <Mail className="h-4 w-4 text-blue-400" />
                                <span>Official Instagram: @mr.divakar00</span>
                            </a>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>

                        <Pressable onClick={() => navigate('/school-search')} className="w-full text-left flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-colors">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-gray-200">
                                <Search className="h-4 w-4 text-cyan-400" />
                                <span>Search Schools & Institutes</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                        </Pressable>

                        <Pressable onClick={() => navigate('/about')} className="w-full text-left flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-colors">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-gray-200">
                                <HelpCircle className="h-4 w-4 text-purple-400" />
                                <span>About NeetMaster & FAQ</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                        </Pressable>

                        <Pressable onClick={() => onNavigate('technicalSupport')} className="w-full text-left flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-colors">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-gray-200">
                                <HelpCircle className="h-4 w-4 text-emerald-400" />
                                <span>Technical Support & Helpdesk</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                        </Pressable>
                    </div>
                </motion.div>

                {/* Modern Red Logout Button */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="pt-2"
                >
                    <Pressable 
                        onClick={handleLogOut} 
                        className="w-full bg-gradient-to-r from-red-600/20 via-red-500/10 to-red-600/20 hover:from-red-600 hover:to-red-700 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 text-xs tracking-wider transition-all shadow-lg active:scale-95"
                    >
                        <LogOut className="h-4 w-4" /> END SESSION (LOG OUT)
                    </Pressable>
                </motion.div>

                {/* Active Sessions - Glassy Transparent Panel */}
                {user && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.25 }}
                        className="mt-2"
                    >
                        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
                            style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                                backdropFilter: 'blur(24px)',
                                WebkitBackdropFilter: 'blur(24px)'
                            }}
                        >
                            {/* Header */}
                            <div className="px-4 pt-4 pb-3 border-b border-white/8">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20">
                                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-white/90 tracking-wide">Active Sessions</h3>
                                        <p className="text-[10px] text-white/40">Sabhi logged-in devices ({sessions.length}/2)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sessions List */}
                            <div className="divide-y divide-white/5">
                                {sessionsLoading && (
                                    <div className="px-4 py-4 text-center text-xs text-white/40 animate-pulse">Loading sessions...</div>
                                )}
                                {!sessionsLoading && sessions.length === 0 && (
                                    <div className="px-4 py-4 text-center text-xs text-white/40">Koi active session nahi mili</div>
                                )}
                                {sessions.map((sess) => {
                                    const isMobile = /android|iphone|ipad|mobile/i.test(sess.userAgent || '');
                                    const isCurrentSess = sess.isCurrent;
                                    const isRevoking = revokingSessionId === sess.deviceId;
                                    return (
                                        <div key={sess.deviceId} className={`flex items-center justify-between px-4 py-3 gap-3 transition-colors ${ isCurrentSess ? 'bg-indigo-500/5' : 'hover:bg-white/3' }`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`shrink-0 p-2 rounded-xl border ${ isCurrentSess ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-white/50' }`}>
                                                    {isMobile
                                                        ? <Smartphone className="w-3.5 h-3.5" />
                                                        : <Laptop className="w-3.5 h-3.5" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-semibold text-white/90 truncate">
                                                            {isMobile ? '📱 Mobile Device' : '💻 Desktop/Browser'}
                                                        </span>
                                                        {isCurrentSess && (
                                                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] text-indigo-300 font-bold uppercase tracking-wider">This Device</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-white/35 mt-0.5 truncate" title={sess.userAgent || ''}>
                                                        {sess.userAgent ? sess.userAgent.substring(0, 55) + '...' : 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRevokeSession(sess.deviceId, !!isCurrentSess)}
                                                disabled={isRevoking}
                                                title={isCurrentSess ? 'Is device se logout ho' : 'Is device ka session revoke karo'}
                                                className={`shrink-0 p-2 rounded-xl border transition-all active:scale-90 ${ isCurrentSess
                                                    ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                                                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400'
                                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                                            >
                                                {isRevoking
                                                    ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                                    : <LogOut className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer note */}
                            <div className="px-4 py-2.5 border-t border-white/5">
                                <p className="text-[10px] text-white/25 text-center">Maximum 2 devices pe login allowed hai</p>
                            </div>
                        </div>
                    </motion.div>
                )}

            </div>

            {showBackupPinModal && user && (
                <PinSetupModal
                    uid={user.uid}
                    mode="backup"
                    onSuccess={() => {
                        setShowBackupPinModal(false);
                        setBackupEnabled(true);
                    }}
                    onCancel={() => setShowBackupPinModal(false)}
                />
            )}
        </div>
    );
}