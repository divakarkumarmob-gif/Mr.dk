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
                    <div className="p-4 bg-card rounded-xl border border-border">
                        <h3 className="text-gray-400 text-sm font-semibold mb-2">Latest Update</h3>
                        <a href="https://neet.nta.nic.in/" target="_blank" rel="noopener noreferrer"
                           className="block text-blue-300 hover:text-white transition-colors">
                           Visit Official NTA NEET Portal
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
