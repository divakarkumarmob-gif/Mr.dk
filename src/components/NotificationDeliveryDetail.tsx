import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface DeliveryRecord {
    id: string; // token, used as doc id
    uid: string;
    username: string;
    token: string;
    sendStatus: 'sent' | 'failed';
    sendError: string | null;
    delivered: boolean;
    deliveredAt: any;
    sentAt: any;
}

// Turns FCM's internal error codes into something a non-developer admin
// can actually act on.
function explainSendError(code: string | null): string {
    switch (code) {
        case 'messaging/registration-token-not-registered':
            return 'App was uninstalled, or the user cleared app data — the token no longer exists.';
        case 'messaging/invalid-argument':
            return 'Token was malformed or expired.';
        case 'messaging/mismatched-credential':
            return 'Token belongs to a different Firebase project (stale build?).';
        case 'messaging/quota-exceeded':
            return 'Too many messages sent too fast — try again shortly.';
        default:
            return code ? `FCM rejected it: ${code}` : 'Unknown send error.';
    }
}

function statusFor(rec: DeliveryRecord): { icon: React.ReactNode; label: string; detail: string } {
    if (rec.sendStatus === 'failed') {
        return {
            icon: <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />,
            label: 'Failed to send',
            detail: explainSendError(rec.sendError),
        };
    }
    if (rec.delivered) {
        return {
            icon: <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />,
            label: 'Delivered',
            detail: typeof rec.deliveredAt?.toDate === 'function' ? `Confirmed at ${rec.deliveredAt.toDate().toLocaleString()}` : 'Confirmed on device.',
        };
    }
    return {
        icon: <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0" />,
        label: 'Sent, not confirmed yet',
        detail: 'FCM accepted this for delivery, but the device hasn\'t confirmed receiving it. Usually means the phone\'s battery/autostart restrictions are blocking it while the app is closed, or the phone is offline.',
    };
}

export default function NotificationDeliveryDetail({ notificationId, onBack }: { notificationId: string; onBack: () => void }) {
    const [records, setRecords] = useState<DeliveryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'notifications', notificationId, 'deliveries'), orderBy('username'));
        const unsub = onSnapshot(q, (snap) => {
            setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryRecord)));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, [notificationId]);

    const deliveredCount = records.filter(r => r.sendStatus === 'sent' && r.delivered).length;
    const failedCount = records.filter(r => r.sendStatus === 'failed').length;
    const pendingCount = records.length - deliveredCount - failedCount;

    return (
        <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-h-screen bg-[#0B1120] text-white p-4"
        >
            <div className="flex items-center gap-3 mb-4">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-bold">Delivery status</h2>
            </div>

            <div className="flex gap-3 mb-5">
                <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-2xl p-3 text-center">
                    <div className="text-xl font-bold text-green-400">{deliveredCount}</div>
                    <div className="text-xs text-gray-400">Delivered</div>
                </div>
                <div className="flex-1 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">{pendingCount}</div>
                    <div className="text-xs text-gray-400">Not confirmed</div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 text-center">
                    <div className="text-xl font-bold text-red-400">{failedCount}</div>
                    <div className="text-xs text-gray-400">Failed</div>
                </div>
            </div>

            {loading && <p className="text-gray-400 text-sm">Loading...</p>}
            {!loading && records.length === 0 && (
                <p className="text-gray-400 text-sm">No per-user delivery data for this notification (it may have been sent before delivery tracking was added).</p>
            )}

            <div className="space-y-2">
                {records.map(rec => {
                    const s = statusFor(rec);
                    const isOpen = expandedId === rec.id;
                    return (
                        <div key={rec.id} className="bg-white/5 rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExpandedId(isOpen ? null : rec.id)}
                                className="w-full flex items-center gap-3 p-3 text-left"
                            >
                                {s.icon}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{rec.username}</p>
                                    <p className="text-xs text-gray-400">{s.label}</p>
                                </div>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                            </button>
                            {isOpen && (
                                <div className="px-3 pb-3 pt-0 border-t border-white/10 mt-1">
                                    <p className="text-sm text-gray-300 mt-2">{s.detail}</p>
                                    <p className="text-xs text-gray-500 mt-2 break-all">Token: {rec.token.slice(0, 24)}...</p>
                                    {typeof rec.sentAt?.toDate === 'function' && (
                                        <p className="text-xs text-gray-500 mt-1">Sent at: {rec.sentAt.toDate().toLocaleString()}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
