import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getApiUrl } from '@/utils/api';

interface NotificationPageProps {
    onBack: () => void;
}

export default function NotificationPage({ onBack }: NotificationPageProps) {
    const [activeTab, setActiveTab] = useState<'General' | 'NTA'>('General');
    const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
    const [neetNotices, setNeetNotices] = useState<{publicNotices: {text: string, url: string}[], candidateActivity: {text: string, url: string}[]}>({ publicNotices: [], candidateActivity: [] });
    const [loading, setLoading] = useState(false);
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

    const handleNtaPressStart = () => {
        longPressTimer.current = setTimeout(() => {
            window.open('https://neet.nta.nic.in/', '_blank');
        }, 2000);
    };

    const handleNtaPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const [ntaStatus, setNtaStatus] = useState<'Idle' | 'Connected' | 'Error'>('Idle');
    const [isCheckingNta, setIsCheckingNta] = useState(false);
    const [ntaError, setNtaError] = useState<string | null>(null);

    const fetchNeetNotices = useCallback(async () => {
        setLoading(true);
        setNtaError(null);
        try {
            const response = await fetch(getApiUrl('/api/neet-notices'));
            const data = await response.json();
            if (data.error) {
                setNtaError(data.error);
            } else {
                setNeetNotices(data);
            }
        } catch (error: any) {
            console.error("Error fetching NTA notices:", error);
            setNtaError(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkNtaStatus = useCallback(async () => {
        setIsCheckingNta(true);
        try {
            const response = await fetch(getApiUrl('/api/nta/health'));
            const data = await response.json();
            setNtaStatus(data.success ? 'Connected' : 'Error');
        } catch (err) {
            setNtaStatus('Error');
        } finally {
            setIsCheckingNta(false);
        }
    }, []);

    useEffect(() => {
        // Fetch Admin Notifications (limit 5)
        const notifRef = collection(db, 'notifications');
        const q = query(notifRef, orderBy('timestamp', 'desc'), limit(5));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            setAdminNotifications(data);
            
            // Mark as read
            data.forEach(async (notif) => {
                if (auth.currentUser && !notif.readBy?.includes(auth.currentUser.uid)) {
                    await updateDoc(doc(db, 'notifications', notif.id), {
                        readBy: arrayUnion(auth.currentUser.uid)
                    });
                }
            });
        });

        fetchNeetNotices();
        checkNtaStatus();

        return () => { unsubscribe(); };
    }, [fetchNeetNotices, checkNtaStatus]);

    return (
        <div className="min-h-screen bg-background text-foreground p-4">
            <button className="flex items-center gap-2 mb-6 text-sm text-gray-400" onClick={onBack}>
                <ChevronLeft className="w-5 h-5" /> Back
            </button>
            <h2 className="text-xl font-bold mb-6">Notifications</h2>
            
            <div className="flex bg-card rounded-lg p-1 mb-6 border border-border">
                <button 
                    className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'General' ? 'bg-blue-600' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('General')}
                >
                    General
                </button>
                <button 
                    className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'NTA' ? 'bg-blue-600' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('NTA')}
                    onMouseDown={handleNtaPressStart}
                    onMouseUp={handleNtaPressEnd}
                    onMouseLeave={handleNtaPressEnd}
                    onTouchStart={handleNtaPressStart}
                    onTouchEnd={handleNtaPressEnd}
                >
                    NTA
                </button>
            </div>

            <div className="space-y-4">
                {activeTab === 'General' && adminNotifications.map((notif: any) => (
                    <div key={notif.id} className="p-4 bg-card rounded-xl border border-border">
                        <p className="text-sm">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-2">{notif.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                ))}
                
                {activeTab === 'NTA' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">NTA Status</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${ntaStatus === 'Connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ntaStatus === 'Error' ? 'bg-red-500' : 'bg-gray-500 animate-pulse'}`} />
                                <span className={`text-[10px] font-bold uppercase ${ntaStatus === 'Connected' ? 'text-green-500' : ntaStatus === 'Error' ? 'text-red-500' : 'text-gray-500'}`}>
                                    {isCheckingNta ? 'Checking...' : ntaStatus}
                                </span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-24 bg-card rounded-xl border border-border" />
                                <div className="h-24 bg-card rounded-xl border border-border" />
                            </div>
                        ) : ntaError ? (
                            <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/10 text-center">
                                <AlertCircle className="w-8 h-8 text-red-500/50 mx-auto mb-3" />
                                <p className="text-sm text-red-400 font-medium mb-1">Failed to Load NTA Notices</p>
                                <p className="text-[10px] text-red-500/40 mb-4">{ntaError}</p>
                                <button 
                                    onClick={() => { fetchNeetNotices(); checkNtaStatus(); }}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg transition"
                                >
                                    Retry Connection
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 bg-card rounded-xl border border-border">
                                    <h3 className="font-bold mb-3">Public Notices</h3>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                                        {neetNotices.publicNotices.length > 0 ? (
                                            neetNotices.publicNotices.map((notice, i) => <li key={i}><a href={notice.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{notice.text}</a></li>)
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">No recent notices found</p>
                                        )}
                                    </ul>
                                </div>
                                <div className="p-4 bg-card rounded-xl border border-border">
                                    <h3 className="font-bold mb-3">Candidate Activity</h3>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                                        {neetNotices.candidateActivity.length > 0 ? (
                                            neetNotices.candidateActivity.map((activity, i) => <li key={i}><a href={activity.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{activity.text}</a></li>)
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">No recent activity found</p>
                                        )}
                                    </ul>
                                </div>
                                <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-widest">long press on NTA tab to visit website</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
