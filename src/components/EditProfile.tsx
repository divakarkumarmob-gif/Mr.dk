import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, User, Mail, Phone, Book, GraduationCap, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { User as FirebaseUser, updateProfile, updateEmail, deleteUser } from 'firebase/auth';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useModalBackButton } from '../utils/hardwareBackButton';

export default function EditProfile({ user, onNavigate }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile') => void }) {
    const [name, setName] = useState(user?.displayName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useModalBackButton(showPhotoModal, () => setShowPhotoModal(false));
    useModalBackButton(true, () => onNavigate('profile'));

    const showError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 3500);
    };

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3500);
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        
        let downloadURL = '';
        try {
            // Attempt standard upload with a 2.5s timeout
            downloadURL = await new Promise<string>(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Firebase Storage timeout.'));
                }, 2500);

                try {
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    clearTimeout(timeoutId);
                    resolve(url);
                } catch (err) {
                    clearTimeout(timeoutId);
                    reject(err);
                }
            });
        } catch (error) {
            console.warn('Storage avatar upload bypassed or timed out, falling back to local secure Base64:', error);
            try {
                // Read as base64
                downloadURL = await convertToBase64(file);
            } catch (convErr) {
                console.error('Base64 conversion failed:', convErr);
                showError('Failed to process image');
                return;
            }
        }

        try {
            await updateProfile(user, { photoURL: downloadURL });
            await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });
            setShowPhotoModal(false);
            showSuccess('Photo updated! 📸');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showError('Failed to upload photo');
        }
    };

    const handleRemovePhoto = async () => {
        if (!user) return;
        const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        try {
            await deleteObject(storageRef);
        } catch (error: any) {
            // Ignore if object doesn't exist; it means there's no storage file to delete.
            if (error?.code !== 'storage/object-not-found') {
                console.error('Error removing profile picture from storage:', error);
                showError('Failed to remove photo from storage');
            }
        }
        
        try {
            await updateProfile(user, { photoURL: null });
            await updateDoc(doc(db, 'users', user.uid), { photoURL: null });
            setShowPhotoModal(false);
            showSuccess('Photo removed!');
        } catch (error) {
            console.error('Error updating profile:', error);
            showError('Failed to update profile');
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (name !== user.displayName) await updateProfile(user, { displayName: name });
            if (email !== user.email) await updateEmail(user, email);
            showSuccess('Profile updated! ✨');
            setTimeout(() => onNavigate('profile'), 1200);
        } catch (error) {
            console.error(error);
            showError('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                await deleteUser(user);
                onNavigate('home');
            } catch (error) {
                console.error(error);
                showError('Failed to delete account. Please re-login and try again.');
            }
        }
    };

    const initials = name ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    return (
        <div
            className="min-h-dvh text-white font-sans pb-28 selection:bg-indigo-500/30"
            style={{ background: 'linear-gradient(135deg, #060a15 0%, #0a0f24 50%, #07091a 100%)' }}
        >
            {/* Ambient glow orbs */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-1/4 right-0 w-72 h-72 bg-purple-600/8 rounded-full blur-[100px] pointer-events-none" />

            {/* Toast Notifications */}
            <AnimatePresence>
                {errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -30, scale: 0.95 }}
                        className="fixed top-4 left-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border border-red-500/30"
                        style={{ background: 'rgba(220,38,38,0.15)', backdropFilter: 'blur(20px)' }}
                    >
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-sm font-semibold text-red-300">{errorMessage}</span>
                    </motion.div>
                )}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -30, scale: 0.95 }}
                        className="fixed top-4 left-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/30"
                        style={{ background: 'rgba(16,185,129,0.12)', backdropFilter: 'blur(20px)' }}
                    >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-sm font-semibold text-emerald-300">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Photo Bottom Sheet Modal */}
            <AnimatePresence>
                {showPhotoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center p-4"
                        style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.65)' }}
                        onClick={() => setShowPhotoModal(false)}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-2"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)', backdropFilter: 'blur(28px)' }}
                        >
                            <div className="px-5 pt-5 pb-3 border-b border-white/8">
                                <h3 className="font-bold text-white text-sm tracking-wide">Profile Photo</h3>
                                <p className="text-white/40 text-xs mt-0.5">Apni photo change karo</p>
                            </div>
                            <div className="p-3 space-y-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold text-white hover:bg-white/8 transition-colors active:scale-95"
                                >
                                    <Camera className="w-4 h-4 text-indigo-400" />
                                    Import from Gallery
                                </button>
                                {user?.photoURL && (
                                    <button
                                        onClick={handleRemovePhoto}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remove Photo
                                    </button>
                                )}
                            </div>
                            <div className="p-3 pt-0">
                                <button
                                    onClick={() => setShowPhotoModal(false)}
                                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white/50 hover:text-white/70 transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.05)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

            <div className="max-w-md mx-auto px-4">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-8"
                    style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
                >
                    <button
                        onClick={() => onNavigate('profile')}
                        className="p-2 rounded-xl transition active:scale-90"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                        <ArrowLeft className="w-5 h-5 text-white/80" />
                    </button>
                    <div>
                        <h1 className="text-base font-extrabold text-white tracking-tight">Edit Profile</h1>
                        <p className="text-[11px] text-white/35">Apni info update karo</p>
                    </div>
                </motion.div>

                {/* Avatar */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 }}
                    className="flex flex-col items-center mb-8"
                >
                    <div className="relative">
                        <div
                            className="absolute -inset-1.5 rounded-full animate-pulse"
                            style={{ background: 'conic-gradient(from 0deg, #6366f1, #8b5cf6, #06b6d4, #6366f1)', opacity: 0.45, filter: 'blur(6px)' }}
                        />
                        <button
                            onClick={() => setShowPhotoModal(true)}
                            className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl flex items-center justify-center active:scale-95 transition"
                            style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}
                        >
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl font-black text-white/90">{initials}</span>
                            )}
                            <div
                                className="absolute inset-0 flex items-end justify-center pb-1.5"
                                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }}
                            >
                                <Camera className="w-4 h-4 text-white/90" />
                            </div>
                        </button>
                    </div>
                    <button
                        onClick={() => setShowPhotoModal(true)}
                        className="mt-3 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition tracking-widest uppercase"
                    >
                        Change Photo
                    </button>
                </motion.div>

                {/* Form Fields */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                >
                    {/* Name */}
                    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center gap-3 px-4 py-4">
                            <div className="shrink-0 p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/20">
                                <User className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest mb-1">Full Name</p>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="Apna naam daalo" className="bg-transparent text-white text-sm font-semibold w-full outline-none placeholder:text-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center gap-3 px-4 py-4">
                            <div className="shrink-0 p-2 rounded-xl bg-blue-500/15 border border-blue-500/20">
                                <Mail className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest mb-1">Email Address</p>
                                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email daalo" type="email" className="bg-transparent text-white text-sm font-semibold w-full outline-none placeholder:text-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center gap-3 px-4 py-4">
                            <div className="shrink-0 p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest mb-1">Phone Number</p>
                                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." type="tel" className="bg-transparent text-white text-sm font-semibold w-full outline-none placeholder:text-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Class — static */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center gap-3 px-4 py-4">
                            <div className="shrink-0 p-2 rounded-xl bg-amber-500/12 border border-amber-500/15">
                                <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest mb-1">Class</p>
                                <p className="text-sm font-semibold text-white/50">12th (NEET)</p>
                            </div>
                        </div>
                    </div>

                    {/* Interests — static */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)' }}>
                        <div className="flex items-center gap-3 px-4 py-4">
                            <div className="shrink-0 p-2 rounded-xl bg-pink-500/12 border border-pink-500/15">
                                <Book className="w-3.5 h-3.5 text-pink-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest mb-1">Interests</p>
                                <p className="text-sm font-semibold text-white/50">Physics, Chemistry, Biology</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-6 space-y-3">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-xl shadow-indigo-500/20"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
                    >
                        {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                        onClick={handleDelete}
                        className="w-full py-3 rounded-2xl font-bold text-xs text-red-400/70 border border-red-500/15 hover:border-red-500/35 hover:text-red-400 transition-all active:scale-95"
                        style={{ background: 'rgba(239,68,68,0.04)' }}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> Delete Account
                        </span>
                    </button>
                </motion.div>
            </div>
        </div>
    );
}

