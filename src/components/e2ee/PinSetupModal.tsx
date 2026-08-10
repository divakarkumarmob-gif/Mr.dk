import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, AlertTriangle, Key, ArrowRight, RefreshCw, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';
import { validatePinStrength, createPinBackupBlob, restorePrivateKeyFromBlob, resetUserKeysAndBackup, setLocalPrivateKey, setLocalPublicKey, getLocalPrivateKey, getLocalPublicKey, generateIdentityKeyBundle, EncryptedPrivateKeyBackupBlob } from '../../utils/e2ee';
import { setLocalIdentitySignKeyPair, publishKeyBundle, getLocalIdentitySignPrivateKey } from '../../utils/e2ee/x3dh';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { showToast } from '../../utils/toast';

// 'setup' is kept only for any old callers still passing it - it now
// behaves identically to 'backup' (identity always exists by the time this
// modal can open, since it's created silently at login). New code should
// use 'backup' explicitly.
export type PinModalMode = 'setup' | 'backup' | 'restore' | 'reset';

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
    const [currentMode, setCurrentMode] = useState<PinModalMode>(mode === 'setup' ? 'backup' : mode);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [showPin, setShowPin] = useState(false);
    const [showConfirmPin, setShowConfirmPin] = useState(false);

    /**
     * 'backup' mode: identity keys already exist (generated silently at
     * login - see ensureSilentIdentity). This does NOT generate new keys;
     * it just encrypts the EXISTING local identity with the chosen PIN and
     * uploads the backup blob, so a future new-device login can restore
     * this same identity via 'restore' mode. This is the WhatsApp/Signal
     * "enable backup" flow, decoupled from being able to send/receive
     * messages at all (which never required a PIN in the first place).
     */
    const handleEnableBackup = async (e: React.FormEvent) => {
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
            const dhPrivateKey = await getLocalPrivateKey(uid);
            const dhPublicKey = await getLocalPublicKey(uid);
            const signPrivateKey = await getLocalIdentitySignPrivateKey(uid);

            if (!dhPrivateKey || !dhPublicKey) {
                throw new Error('Koi identity nahi mili is device par. Pehle app dobara kholiye taaki identity generate ho.');
            }
            if (!signPrivateKey) {
                throw new Error('Signing key nahi mili. Kripya app restart karke dobara try karein.');
            }

            const blob = await createPinBackupBlob(
                JSON.stringify({ dh: dhPrivateKey, sign: signPrivateKey }),
                safePin
            );

            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                encryptedPrivateKeyBackup: blob,
                e2eeBackupEnabled: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            showToast('Backup PIN set ho gaya! Ab naye device par chats restore kar sakte hain. 🔐');
            onSuccess({ publicKey: dhPublicKey, privateKey: dhPrivateKey });
        } catch (e: any) {
            console.error("Backup PIN setup error:", e);
            setErrorMsg(e.message || 'Backup setup me error aayi.');
        } finally {
            setLoading(false);
        }
    };

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
            // 1. Generate full identity bundle (X25519 for DH + Ed25519 for signing prekeys)
            const identity = await generateIdentityKeyBundle();

            // 2. Save locally (DH keypair uses the existing priv/pub key storage helpers)
            await setLocalPrivateKey(uid, identity.privateKey);
            await setLocalPublicKey(uid, identity.publicKey);
            await setLocalIdentitySignKeyPair(uid, identity.signPublicKey, identity.signPrivateKey);

            // 3. Create Backup Blob - includes BOTH private key halves so a
            //    PIN restore on a new device can re-derive full identity.
            //    Session/ratchet state is intentionally NOT included (device-local only,
            //    matches WhatsApp/Signal - a restored device starts fresh sessions).
            const blob = await createPinBackupBlob(
                JSON.stringify({ dh: identity.privateKey, sign: identity.signPrivateKey }),
                safePin
            );

            // 4. Update Firestore User Profile
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                publicKey: identity.publicKey,
                identityKeySign: identity.signPublicKey,
                encryptedPrivateKeyBackup: blob,
                e2eeEnabled: true,
                e2eeBackupEnabled: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // 5. Publish X3DH key bundle (Signed PreKey + One-Time PreKeys) so
            //    other users can start sessions with us.
            await publishKeyBundle(uid, identity.signPublicKey);

            showToast('E2EE Security PIN setup safaltapoorvak ho gaya! 🔐');
            onSuccess({ publicKey: identity.publicKey, privateKey: identity.privateKey });
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
            const restoredRaw = await restorePrivateKeyFromBlob(backupBlob, pin);

            // Backup blob stores JSON with both DH + signing private keys (new format).
            // Fall back to treating it as a bare DH private key if it's not JSON
            // (handles a blob created by an older build, though those sessions
            // won't have forward secrecy until a fresh key bundle is published).
            let dhPrivateKey = restoredRaw;
            let signPrivateKey: string | null = null;
            try {
                const parsed = JSON.parse(restoredRaw);
                if (parsed && parsed.dh) {
                    dhPrivateKey = parsed.dh;
                    signPrivateKey = parsed.sign || null;
                }
            } catch {
                // Legacy plain-string format, use as-is
            }

            // Get public key(s) from user profile
            const userDocRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userDocRef);
            let pubKey = '';
            let signPubKey = '';
            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data?.publicKey) {
                    pubKey = data.publicKey;
                    await setLocalPublicKey(uid, pubKey);
                }
                if (data?.identityKeySign) {
                    signPubKey = data.identityKeySign;
                }
            }
            // Save private key(s) locally
            await setLocalPrivateKey(uid, dhPrivateKey);
            if (signPrivateKey && signPubKey) {
                await setLocalIdentitySignKeyPair(uid, signPubKey, signPrivateKey);
                // Refresh our published key bundle (new signed prekey + one-time prekeys)
                // since this is effectively a new device with no prior published bundle state.
                try {
                    await publishKeyBundle(uid, signPubKey);
                } catch (bundleErr) {
                    console.warn('Could not publish key bundle after restore (will retry later):', bundleErr);
                }
            }

            // Restore complete
            showToast('Naye device par identity restore ho gayi! 🔓 Nayi chats E2EE ke saath shuru hongi.');
            onSuccess({ publicKey: pubKey, privateKey: dhPrivateKey });
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
                            {(currentMode === 'setup' || currentMode === 'backup') && 'Enable Chat Backup'}
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
                {(currentMode === 'setup' || currentMode === 'backup') && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                            <strong>Kaam kaise karta hai:</strong> Aapki chats pehle se hi end-to-end encrypted hain - iske liye PIN ki zaroorat nahi. Ye PIN sirf ek backup password hai: agar aap naye phone/browser par login karein, isi PIN se apni purani identity restore kar payenge. <strong>PIN bhool gaye toh</strong> naye device par purani chats unreadable ho jayengi (server par PIN kabhi save nahi hota, isliye hum bhi recover nahi kar sakte).
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
                <form onSubmit={
                    currentMode === 'setup' || currentMode === 'backup' ? handleEnableBackup
                    : currentMode === 'restore' ? handleRestorePin
                    : (e) => { e.preventDefault(); handleResetKeys(); }
                }>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                {currentMode === 'restore' ? 'Apna 6+ Character Backup PIN darj karein:' : 'Backup PIN banayein (Min 6 chars, Alphanumeric):'}
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

                        {(currentMode === 'setup' || currentMode === 'backup' || currentMode === 'reset') && (
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
                                    {(currentMode === 'setup' || currentMode === 'backup') && 'Enable Backup'}
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
