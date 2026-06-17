import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface NotificationPageProps {
    onBack: () => void;
}

export default function NotificationPage({ onBack }: NotificationPageProps) {
    const [activeTab, setActiveTab] = useState<'General' | 'NTA'>('General');
    const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
    const [neetNotices, setNeetNotices] = useState<{publicNotices: {text: string, url: string}[], candidateActivity: {text: string, url: string}[]}>({ publicNotices: [], candidateActivity: [] });
    const [loading, setLoading] = useState(false);

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

        // Fetch NTA Notices
        const fetchNeetNotices = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/neet-notices');
                const data = await response.json();
                setNeetNotices(data);
            } catch (error) {
                console.error("Error fetching NTA notices:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNeetNotices();

        return () => { unsubscribe(); };
    }, []);

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
                        {loading ? <p className="text-gray-400">Loading notices...</p> : (
                            <>
                                <div className="p-4 bg-card rounded-xl border border-border">
                                    <h3 className="font-bold mb-3">Public Notices</h3>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                                        {neetNotices.publicNotices.map((notice, i) => <li key={i}><a href={notice.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{notice.text}</a></li>)}
                                    </ul>
                                </div>
                                <div className="p-4 bg-card rounded-xl border border-border">
                                    <h3 className="font-bold mb-3">Candidate Activity</h3>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                                        {neetNotices.candidateActivity.map((activity, i) => <li key={i}><a href={activity.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{activity.text}</a></li>)}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
