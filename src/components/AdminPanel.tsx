import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';                
import { MessageSquare as MessageSquareIcon, Upload as UploadIcon, FileUp, Trash2, Edit2, Menu, X, Users } from 'lucide-react';
import QuestionImporter from './QuestionImporter';
import { motion } from 'motion/react';
import ChatWindow from './ChatWindow';

enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId?: string | null;
        email?: string | null;
        emailVerified?: boolean | null;
        isAnonymous?: boolean | null;
        tenantId?: string | null;
        providerInfo?: {
            providerId?: string | null;
            email?: string | null;
        }[];
    }
}
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData?.map(provider => ({
                providerId: provider.providerId,
                email: provider.email,
            })) || []
        },
        operationType,
        path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

interface Notification {
    id: string;
    message: string;
    timestamp: any;
    readBy?: string[];
}

export default function AdminPanel({ onNavigate }: { onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'adminChat' | 'technicalSupport') => void }) {
    const [activeTab, setActiveTab] = useState<'message' | 'upload' | 'import' | 'users'>('message');
    const [message, setMessage] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [userStats, setUserStats] = useState({ total: 0, online: 0 });

    useEffect(() => {
        const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
        
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            let total = snapshot.size;
            let online = 0;
            const now = Date.now();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.lastSeen && now - data.lastSeen.toMillis() < 5 * 60 * 1000) {
                    online++;
                }
            });
            setUserStats({ total, online });
        });
        
        return () => { unsubscribeNotifs(); unsubscribeUsers(); };
    }, []);

    const sendMessage = async () => {
        if (!message) return;
        try {
            await addDoc(collection(db, 'notifications'), {
                message,
                timestamp: serverTimestamp(),
                readBy: []
            });
            setMessage('');
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'notifications');
        }
    };

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editMessage, setEditMessage] = useState('');

    const deleteNotification = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'notifications', id));
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, 'notifications/' + id);
        }
    };

    const startEdit = (n: Notification) => {
        setEditingId(n.id);
        setEditMessage(n.message);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'notifications', editingId), { message: editMessage });
            setEditingId(null);
            setEditMessage('');
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'notifications/' + editingId);
        }
    };

    return (
        <div className="bg-[#161e38] rounded-xl border border-white/10 p-1 flex gap-0 min-h-[300px] text-white relative">
            <motion.div 
                className="border-r border-white/10 rounded-lg p-1 space-y-1 overflow-hidden bg-[#131e3d] z-10"
                animate={{ width: isSidebarOpen ? '120px' : '40px' }}
                onPanEnd={(event, info) => {
                    if (info.offset.x < -20) setIsSidebarOpen(false);
                    else if (info.offset.x > 20) setIsSidebarOpen(true);
                }}
            >
                <div className="p-2 mb-2 flex items-center justify-center">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
                <button onClick={() => setActiveTab('message')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2 ${activeTab === 'message' ? 'bg-white/10' : ''}`}>
                    <MessageSquareIcon className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Message</span>}
                </button>
                <button onClick={() => onNavigate('adminChat')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2`}>
                    <Users className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Chats</span>}
                </button>
                <button onClick={() => setActiveTab('import')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2 ${activeTab === 'import' ? 'bg-white/10' : ''}`}>
                    <FileUp className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Import</span>}
                </button>
                <button onClick={() => setActiveTab('users')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2 ${activeTab === 'users' ? 'bg-white/10' : ''}`}>
                    <Users className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Users</span>}
                </button>
                <button onClick={() => setActiveTab('upload')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2 ${activeTab === 'upload' ? 'bg-white/10' : ''}`}>
                    <UploadIcon className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Upload</span>}
                </button>
            </motion.div>
            <div className="flex-1 p-4" onClick={() => setIsSidebarOpen(false)}>
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <h3 className="font-bold">User Statistics</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <p className="text-gray-400 text-sm">Total Login Users</p>
                                <p className="text-2xl font-bold">{userStats.total}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg">
                                <p className="text-gray-400 text-sm">Currently Online</p>
                                <p className="text-2xl font-bold text-green-400">{userStats.online}</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'import' && (
                    <QuestionImporter />
                )}
                {activeTab === 'message' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                             <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-white/5 p-2 rounded-lg border border-white/10" placeholder="Type notification..." rows={4} />
                             <button onClick={sendMessage} className="bg-orange-500 px-4 py-2 rounded-lg font-bold">Send</button>
                        </div>
                        <div className="space-y-2 mt-4">
                            <h4 className="font-bold">History:</h4>
                            {notifications.map(n => (
                                <div key={n.id} className="bg-white/5 p-3 rounded-lg flex justify-between items-center text-sm">
                                    {editingId === n.id ? (
                                        <div className="flex-grow flex gap-2">
                                            <input value={editMessage} onChange={(e) => setEditMessage(e.target.value)} className="bg-white/10 p-1 rounded flex-grow" />
                                            <button onClick={saveEdit} className="text-green-400">Save</button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400">Cancel</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <p>{n.message}</p>
                                                <p className="text-gray-400 text-xs">
                                                    {n.timestamp?.toDate().toLocaleString()} | {n.readBy?.length || 0} users have seen this
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => startEdit(n)} className="p-1 hover:bg-white/10 rounded"><Edit2 className="h-4 w-4" /></button>
                                                <button onClick={() => deleteNotification(n.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
