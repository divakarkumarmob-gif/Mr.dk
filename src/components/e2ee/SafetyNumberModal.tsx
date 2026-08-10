import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Copy, Check, X } from 'lucide-react';
import { computeSafetyNumber, acknowledgeKeyChange } from '../../utils/e2ee';
import { showToast } from '../../utils/toast';

interface SafetyNumberModalProps {
    contactUid: string;
    contactName: string;
    myPublicKey: string;
    targetPublicKey: string;
    keyHasChanged?: boolean;
    onClose: () => void;
    onVerified?: () => void;
}

import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useModalBackButton } from '../../utils/hardwareBackButton';

export default function SafetyNumberModal({ contactUid, contactName, myPublicKey, targetPublicKey, keyHasChanged, onClose, onVerified }: SafetyNumberModalProps) {
    useModalBackButton(true, onClose);
    const [fingerprint, setFingerprint] = useState<string>('Computing Safety Number...');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const myUid = auth.currentUser?.uid || '';
                let keyA = myPublicKey;
                let keyB = targetPublicKey;

                if (!keyA && myUid) {
                    const mySnap = await getDoc(doc(db, 'users', myUid));
                    if (mySnap.exists() && mySnap.data().publicKey) {
                        keyA = mySnap.data().publicKey;
                    }
                }

                if (!keyB && contactUid) {
                    const contactSnap = await getDoc(doc(db, 'users', contactUid));
                    if (contactSnap.exists() && contactSnap.data().publicKey) {
                        keyB = contactSnap.data().publicKey;
                    }
                }

                if (keyA && keyB) {
                    const num = await computeSafetyNumber(keyA, keyB);
                    if (isMounted) setFingerprint(num);
                } else if (isMounted) {
                    setFingerprint('Safety Number pending (Keys loading...)');
                }
            } catch (e) {
                console.error('Safety number calculation error:', e);
                if (isMounted && myPublicKey && targetPublicKey) {
                    const num = await computeSafetyNumber(myPublicKey, targetPublicKey);
                    setFingerprint(num);
                }
            }
        })();

        return () => { isMounted = false; };
    }, [contactUid, myPublicKey, targetPublicKey]);

    const handleCopy = () => {
        navigator.clipboard.writeText(fingerprint);
        setCopied(true);
        showToast('Safety Number copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAcknowledge = async () => {
        await acknowledgeKeyChange(contactUid, targetPublicKey);
        if (onVerified) onVerified();
        onClose();
        showToast('Safety Number update acknowledge ho gaya!');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white relative"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-100 text-base">Verify Safety Number</h3>
                            <p className="text-xs text-slate-400">With {contactName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {keyHasChanged && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                        <div>
                            <strong>Safety Number Changed:</strong> {contactName} ne naya device link kiya hai ya key reset ki hai. Apne end par security verify karein.
                        </div>
                    </div>
                )}

                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Aap aur {contactName} is Safety Number ko compare kar sakte hain yeh verify karne ke liye ki aapki direct conversation 100% end-to-end encrypted hai.
                </p>

                {/* Fingerprint Grid Display */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4 text-center font-mono text-emerald-400 text-sm tracking-wider select-all leading-loose">
                    {fingerprint}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <button 
                        onClick={handleCopy}
                        className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Fingerprint'}
                    </button>

                    {keyHasChanged ? (
                        <button 
                            onClick={handleAcknowledge}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Verified
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
                        >
                            Verified OK
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
