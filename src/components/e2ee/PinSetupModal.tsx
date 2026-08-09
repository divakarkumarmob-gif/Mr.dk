import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, AlertTriangle, Key, ArrowRight, RefreshCw, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';
import { validatePinStrength, createPinBackupBlob, restorePrivateKeyFromBlob, resetUserKeysAndBackup, setLocalPrivateKey, setLocalPublicKey, generateKeyPair, EncryptedPrivateKeyBackupBlob } from '../../utils/e2ee';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { showToast } from '../../utils/toast';

export type PinModalMode = 'setup' | 'restore' | 'reset';

interface PinSetupModalProps {
    uid: string;
    mode: PinModalMode;
    backupBlob?: EncryptedPrivateKeyBackupBlob;
    onSuccess: (keys: { publicKey: string; privateKey: string }) => void;
    onCancel?: () => void;
}

import { useModalBackButton } from '../../utils/hardwareBackButton';

export default function PinSetupModal({ uid, mode, backupBlob, onSuccess, onCancel }: PinSetupModalProps) {
    useModalBackButton(true, () => { if (onCancel) onCancel(); });
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [currentMode, setCurrentMode] = useState<PinModalMode>(mode);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [showPin, setShowPin] = useState(false);
    const [showConfirmPin, setShowConfirmPin] = useState(false);

    const handleSetupPin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        const safePin = pin.trim();
        const safeConfirmPin = confirmPin.trim();

        const val = validatePinStrength(safePin);
        if (!val.valid) {
            setErrorMsg(val.message || 'Invalid PIN');
            return;
        }

        if (safePin !== safeConfirmPin) {
            setErrorMsg('PINs match nahi kar rahe hain! Dobara check karein.');
            return;
        }

        setLoading(true);
        try {
            // 1. Generate keypair
            const keyPair = await generateKeyPair();

            // 2. Save locally
            await setLocalPrivateKey(uid, keyPair.privateKey);
            await setLocalPublicKey(uid, keyPair.publicKey);

            // 3. Create Backup Blob
            const blob = await createPinBackupBlob(keyPair.privateKey, safePin);

            // 4. Update Firestore User Profile
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                publicKey: keyPair.publicKey,
                encryptedPrivateKeyBackup: blob,
                e2eeEnabled: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            showToast('E2EE Security PIN setup safaltapoorvak ho gaya! 🔐');
            onSuccess(keyPair);
        } catch (e: any) {
            console.error("PIN setup error:", e);
            setErrorMsg(e.message || 'PIN setup me error aayi.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestorePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!backupBlob) {
            setErrorMsg('Backup data missing hai.');
            return;
        }

        setLoading(true);
        setErrorMsg(null);
        try {
            const privKey = await restorePrivateKeyFromBlob(backupBlob, pin);
            
            // Get public key from user profile
            const userDocRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userDocRef);
            let pubKey = '';
            if (userSnap.exists() && userSnap.data()?.publicKey) {
                pubKey = userSnap.data().publicKey;
                await setLocalPublicKey(uid, pubKey);
            }
            // Save private key locally
            await setLocalPrivateKey(uid, privKey);
            
            // Restore complete
            showToast('Naye device par chats restore ho gaye! 🔓');
            onSuccess({ publicKey: pubKey, privateKey: privKey });
        } catch (e: any) {
            console.error("PIN restore error:", e);
            setFailedAttempts(prev => prev + 1);
            setErrorMsg(e?.message || 'Incorrect PIN! Phir se try karein.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetKeys = async () => {
        const safePin = typeof pin === 'string' ? pin.trim() : (pin ? String(pin) : '');
        const safeConfirmPin = typeof confirmPin === 'string' ? confirmPin.trim() : (confirmPin ? String(confirmPin) : '');

        const validation = validatePinStrength(safePin);
        if (!validation.valid) {
            setErrorMsg(validation.message || 'Naya 6+ character PIN enter karein!');
            return;
        }
        if (safePin !== safeConfirmPin) {
            setErrorMsg('PIN match nahi ho raha.');
            return;
        }

        setLoading(true);
        setErrorMsg(null);
        try {
            const newKeys = await resetUserKeysAndBackup(uid, pin);
            showToast('Encryption keys reset ho gayi. Purani history legacy readable rahegi. 🔄');
            onSuccess(newKeys);
        } catch (e: any) {
            setErrorMsg(e.message || 'Key reset me error aayi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white relative overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-100">
                            {currentMode === 'setup' && 'Set Up E2EE Backup PIN'}
                            {currentMode === 'restore' && 'Restore Encrypted Chats'}
                            {currentMode === 'reset' && 'Reset Encryption Keys'}
                        </h3>
                        <p className="text-xs text-slate-400">NEETMaster End-to-End Encryption Security</p>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-white p-1">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Warning box */}
                {currentMode === 'setup' && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                            <strong>Important Warning:</strong> Agar aap ye PIN bhool gaye, toh aapke encrypted messages permanent unreadable ho jayenge. PIN server par nahi rakha jata.
                        </span>
                    </div>
                )}

                {currentMode === 'restore' && failedAttempts >= 2 && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                            <span>PIN baar baar galat darj kiya gaya hai. Kya aap PIN bhool gaye hain?</span>
                        </div>
                        <button 
                            onClick={() => { setCurrentMode('reset'); setErrorMsg(null); setPin(''); setConfirmPin(''); }}
                            className="self-end text-xs font-semibold text-red-400 hover:underline flex items-center gap-1"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Reset Encryption Keys
                        </button>
                    </div>
                )}

                {currentMode === 'reset' && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                            <strong>Warning:</strong> Keys reset karne se Naye keypair generate honge. Purane keypair se encrypted pichle messages unreadable ho jayenge.
                        </span>
                    </div>
                )}

                {/* Error Banner */}
                {errorMsg && (
                    <div className="mb-4 p-2.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
                        {errorMsg}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={currentMode === 'setup' ? handleSetupPin : currentMode === 'restore' ? handleRestorePin : (e) => { e.preventDefault(); handleResetKeys(); }}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                {currentMode === 'restore' ? 'Apna 6+ Character Backup PIN darj karein:' : 'Security PIN (Min 6 chars, Alphanumeric):'}
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <input 
                                    type={showPin ? 'text' : 'password'}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    placeholder="e.g. Neet2026Pass"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    autoComplete="new-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(prev => !prev)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                                    tabIndex={-1}
                                >
                                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {(currentMode === 'setup' || currentMode === 'reset') && (
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Confirm Security PIN:
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                    <input 
                                        type={showConfirmPin ? 'text' : 'password'}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value)}
                                        placeholder="Repeat PIN"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPin(prev => !prev)}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                                        tabIndex={-1}
                                    >
                                        {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        {currentMode === 'restore' && (
                            <button
                                type="button"
                                onClick={() => { setCurrentMode('reset'); setErrorMsg(null); }}
                                className="text-xs text-slate-400 hover:text-slate-200"
                            >
                                Forgot PIN?
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/40"
                        >
                            {loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {currentMode === 'setup' && 'Create E2EE PIN & Continue'}
                                    {currentMode === 'restore' && 'Restore Device Chats'}
                                    {currentMode === 'reset' && 'Reset Keys & Set New PIN'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
