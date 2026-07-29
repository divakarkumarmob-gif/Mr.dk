import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    MessageSquare as MessageSquareIcon,
    Upload as UploadIcon,
    FileUp,
    Trash2,
    Edit2,
    Users,
    ClipboardList,
    Smartphone,
    Send,
    Search,
    AlertTriangle,
    CheckCircle2,
    MessageCircle
} from 'lucide-react';
import S3Uploader from './S3Uploader';
import NotificationUploader from './NotificationUploader';
import NotificationDeliveryDetail from './NotificationDeliveryDetail';
import { motion, AnimatePresence } from 'motion/react';
import { getApiUrl } from '../utils/api';
import { showToast } from '../utils/toast';
import { getDeviceInfo } from '../utils/deviceInfo';

// Import CHAPTER_DATA
const CHAPTER_DATA = {
    Physics: {
        'Class 11': ['Physical World', 'Units and Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy and Power', 'Systems of Particles and Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'],
        'Class 12': ['Electric Charges and Fields', 'Electrostatic Potential and Capacitance', 'Current Electricity', 'Moving Charges and Magnetism', 'Magnetism and Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics and Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics']
    },
    Chemistry: {
        'Class 11': ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity in Properties', 'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Organic Chemistry: Some Basic Principles and Techniques', 'Hydrocarbons'],
        'Class 12': ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'd-and f-Block Elements', 'Coordination Compounds', 'Haloalkanes and Haloarenes', 'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines', 'Biomolecules']
    },
    Biology: {
        'Class 11': ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development', 'Breathing and Exchange of Gases', 'Body Fluids and Circulation', 'Excretory Products and their Elimination', 'Locomotion and Movement', 'Neural Control and Coordination', 'Chemical Coordination and Integration'],
        'Class 12': ['Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health and Disease', 'Microbes in Human Welfare', 'Biotechnology: Principles and Processes', 'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation']
    }
};

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

type TabKey = 'message' | 'upload' | 'import' | 'users' | 'schedule' | 'device';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'message', label: 'Message', icon: MessageSquareIcon },
    { key: 'import', label: 'Import', icon: FileUp },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'upload', label: 'Upload', icon: UploadIcon },
    { key: 'schedule', label: 'Schedule', icon: ClipboardList },
    { key: 'device', label: 'Device', icon: Smartphone },
];

const MESSAGE_MAX_LEN = 250;

export default function AdminPanel({ onNavigate }: { onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'adminChat' | 'technicalSupport') => void }) {
    const [activeTab, setActiveTab] = useState<TabKey>('message');
    const [message, setMessage] = useState('');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [userStats, setUserStats] = useState({ total: 0, online: 0 });
    const [deviceInfo, setDeviceInfo] = useState<any>(null);
    const [sending, setSending] = useState(false);
    const [viewingDeliveryFor, setViewingDeliveryFor] = useState<string | null>(null);

    // Schedule state
    const [testName, setTestName] = useState('');
    const [testDate, setTestDate] = useState('');
    const [selectedChapters, setSelectedChapters] = useState<{ name: string, subject: string }[]>([]);
    const [showChapterPopup, setShowChapterPopup] = useState(false);
    const [chapterSearch, setChapterSearch] = useState('');
    const [scheduling, setScheduling] = useState(false);

    // Delete-all-users danger zone confirmation
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingUsers, setDeletingUsers] = useState(false);

    useEffect(() => {
        const handlePop = () => {
            const state = window.history.state;
            if (showChapterPopup && !state?.isChapterPopupOpen) {
                setShowChapterPopup(false);
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [showChapterPopup]);

    const handleOpenChapters = () => {
        setShowChapterPopup(true);
        window.history.pushState({ ...window.history.state, isChapterPopupOpen: true }, '', window.location.href);
    };
    const [subjectConfig, setSubjectConfig] = useState<{ [key: string]: { questions: number, time: number } }>({
        Physics: { questions: 10, time: 10 },
        Chemistry: { questions: 10, time: 10 },
        Biology: { questions: 10, time: 10 }
    });

    useEffect(() => {
        const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
            setNotifLoading(false);
        }, (error) => {
            setNotifLoading(false);
            handleFirestoreError(error, OperationType.LIST, 'notifications');
        });

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

    useEffect(() => {
        if (activeTab === 'device' && !deviceInfo) {
            getDeviceInfo().then(setDeviceInfo);
        }
    }, [activeTab]);

    const sendMessage = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        try {
            const notifRef = await addDoc(collection(db, 'notifications'), {
                message,
                timestamp: serverTimestamp(),
                readBy: []
            });

            const notifRes = await fetch(getApiUrl('/api/send-notification'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Notification', message, notificationId: notifRef.id })
            });
            const notifData = await notifRes.json();
            if (!notifRes.ok) {
                showToast(`Notification send failed: ${notifData.error || notifRes.status}`);
            } else {
                showToast('Notification sent!');
            }

            setMessage('');
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'notifications');
        } finally {
            setSending(false);
        }
    };

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editMessage, setEditMessage] = useState('');

    const deleteNotification = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'notifications', id));
            showToast('Message deleted');
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
            showToast('Message updated');
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'notifications/' + editingId);
        }
    };

    const scheduleTest = async () => {
        if (!testName || !testDate || selectedChapters.length === 0) {
            showToast('Fill all fields and select chapters');
            return;
        }
        setScheduling(true);
        const date = new Date(testDate);
        try {
            await addDoc(collection(db, 'tests'), {
                name: testName,
                chapters: selectedChapters,
                subjectConfig,
                targetDate: date,
                status: 'upcoming'
            });
            await addDoc(collection(db, 'notifications'), {
                message: `You have an upcoming test by admin: ${testName} on ${date.toDateString()}`,
                timestamp: serverTimestamp(),
                readBy: []
            });
            showToast("Test scheduled!");
            setTestName('');
            setTestDate('');
            setSelectedChapters([]);
        } catch (e) {
            console.error(e);
            showToast("Failed to schedule test");
        } finally {
            setScheduling(false);
        }
    };

    const handleDeleteAllUsers = async () => {
        if (deleteConfirmText !== 'DELETE') return;
        setDeletingUsers(true);
        try {
            const res = await fetch(getApiUrl('/api/admin/delete-all-users'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminUid: auth.currentUser?.uid })
            });
            const data = await res.json();
            showToast(data.message || 'Done');
            setDeleteConfirmText('');
        } catch (e) {
            showToast('Error deleting users');
        } finally {
            setDeletingUsers(false);
        }
    };

    const filteredNotifications = notifications.filter(n =>
        n.message.toLowerCase().includes(historySearch.toLowerCase())
    );

    const allChaptersFlat = Object.entries(CHAPTER_DATA).flatMap(([subject, classes]) =>
        Object.entries(classes).flatMap(([className, chapters]) =>
            chapters.map(c => ({ name: c, subject, className }))
        )
    );
    const filteredChapterGroups = chapterSearch
        ? allChaptersFlat.filter(c => c.name.toLowerCase().includes(chapterSearch.toLowerCase()))
        : null;

    if (viewingDeliveryFor) {
        return (
            <NotificationDeliveryDetail
                notificationId={viewingDeliveryFor}
                onBack={() => setViewingDeliveryFor(null)}
            />
        );
    }

    return (
        <div className="bg-[#0f172a] min-h-dvh text-white overflow-hidden -mx-1.5 sm:-mx-3">
            {/* Header */}
            <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl sm:text-2xl font-bold">Admin Panel</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                        <span className="text-gray-400">Total Users:</span>
                        <span className="font-bold">{userStats.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs sm:text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        <span className="text-gray-400">Online:</span>
                        <span className="font-bold text-green-400">{userStats.online}</span>
                    </div>
                </div>
            </div>

            {/* Horizontal capsule tabs */}
            <div className="px-4 sm:px-6 py-3 border-b border-white/10 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 w-max">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                        : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <Icon className="h-4 w-4 flex-shrink-0" />
                                {tab.label}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => onNavigate('adminChat')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <Users className="h-4 w-4 flex-shrink-0" />
                        Chats
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {activeTab === 'message' && (
                    <div className="space-y-5 w-full max-w-4xl mx-auto">
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                            <h3 className="font-bold text-base">Compose Notification</h3>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_LEN))}
                                className="w-full bg-white/5 p-3 rounded-xl border border-white/10 focus:border-orange-500/50 focus:outline-none resize-none placeholder:text-gray-500 text-sm"
                                placeholder="Type your message here..."
                                rows={4}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{message.length} / {MESSAGE_MAX_LEN}</span>
                                <button
                                    onClick={sendMessage}
                                    disabled={!message.trim() || sending}
                                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl font-bold text-sm transition-colors"
                                >
                                    <Send className="h-4 w-4" />
                                    {sending ? 'Sending...' : 'Send Notification'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-base">Recent Messages</h4>
                                <div className="relative w-40 sm:w-56">
                                    <Search className="h-3.5 w-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full bg-white/5 border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-orange-500/50"
                                    />
                                </div>
                            </div>

                            {notifLoading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-500 bg-white/[0.02] border border-white/5 rounded-xl">
                                    <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                                    <p className="text-sm">No messages found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {filteredNotifications.map(n => (
                                        <div key={n.id} className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 p-3.5 rounded-xl transition-colors">
                                            {editingId === n.id ? (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        value={editMessage}
                                                        onChange={(e) => setEditMessage(e.target.value)}
                                                        className="bg-white/10 p-2 rounded-lg flex-grow text-sm focus:outline-none focus:border-orange-500/50 border border-transparent"
                                                    />
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={saveEdit} className="text-green-400 text-sm font-semibold px-2">Save</button>
                                                        <button onClick={() => setEditingId(null)} className="text-gray-400 text-sm font-semibold px-2">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-start gap-3">
                                                    <button
                                                        onClick={() => setViewingDeliveryFor(n.id)}
                                                        className="min-w-0 text-left flex-1"
                                                    >
                                                        <p className="text-sm break-words">{n.message}</p>
                                                        <p className="text-gray-500 text-xs mt-1">
                                                            {n.timestamp?.toDate ? n.timestamp.toDate().toLocaleString() : 'Just now'} · {n.readBy?.length || 0} seen · tap for delivery status
                                                        </p>
                                                    </button>
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <button onClick={() => startEdit(n)} className="p-1.5 hover:bg-white/10 rounded-lg"><Edit2 className="h-3.5 w-3.5" /></button>
                                                        <button onClick={() => deleteNotification(n.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-5 w-full max-w-4xl mx-auto">
                        <h3 className="font-bold text-base">User Statistics</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div className="bg-white/[0.03] border border-white/10 p-5 rounded-2xl">
                                <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Total Users</p>
                                <p className="text-2xl sm:text-3xl font-bold">{userStats.total}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/10 p-5 rounded-2xl">
                                <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Online Now</p>
                                <p className="text-2xl sm:text-3xl font-bold text-green-400">{userStats.online}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/10 p-5 rounded-2xl col-span-2 sm:col-span-1">
                                <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Offline</p>
                                <p className="text-2xl sm:text-3xl font-bold text-gray-400">{Math.max(userStats.total - userStats.online, 0)}</p>
                            </div>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 sm:p-5 space-y-3">
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertTriangle className="h-4 w-4" />
                                <h4 className="font-bold text-sm">Danger Zone</h4>
                            </div>
                            <p className="text-xs text-gray-400">
                                This permanently deletes ALL users. This action is irreversible. Type <span className="font-mono font-bold text-red-300">DELETE</span> to confirm.
                            </p>
                            <input
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE to confirm"
                                className="w-full bg-white/5 border border-red-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/50"
                            />
                            <button
                                onClick={handleDeleteAllUsers}
                                disabled={deleteConfirmText !== 'DELETE' || deletingUsers}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                            >
                                {deletingUsers ? 'Deleting...' : 'Delete All Users'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'import' && (
                    <S3Uploader />
                )}

                {activeTab === 'upload' && (
                    <div className="w-full max-w-4xl mx-auto">
                        <NotificationUploader />
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="space-y-4 w-full max-w-4xl mx-auto">
                        <h3 className="font-bold text-base">Schedule New Test</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Test Name"
                                value={testName}
                                onChange={e => setTestName(e.target.value)}
                                className="w-full bg-white/5 p-3 rounded-xl border border-white/10 focus:outline-none focus:border-orange-500/50 text-sm"
                            />
                            <button
                                onClick={handleOpenChapters}
                                className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between"
                            >
                                <span>{selectedChapters.length > 0 ? `${selectedChapters.length} chapters selected` : 'Select Chapters'}</span>
                                {selectedChapters.length > 0 && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {Object.keys(subjectConfig).map(sub => (
                                <div key={sub} className="bg-white/[0.03] p-3.5 rounded-xl border border-white/10">
                                    <p className="font-bold mb-2 text-sm">{sub}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400 whitespace-nowrap">Q: {subjectConfig[sub].questions}</span>
                                        <input
                                            type="range"
                                            min="5"
                                            max={sub === 'Biology' ? 100 : 50}
                                            step="5"
                                            value={subjectConfig[sub].questions}
                                            onChange={e => {
                                                const q = parseInt(e.target.value);
                                                setSubjectConfig({ ...subjectConfig, [sub]: { ...subjectConfig[sub], questions: q, time: q } });
                                            }}
                                            className="flex-1 accent-orange-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                                type="date"
                                value={testDate}
                                onChange={e => setTestDate(e.target.value)}
                                className="w-full bg-white/5 p-3 rounded-xl border border-white/10 focus:outline-none focus:border-orange-500/50 text-sm"
                            />
                            <input
                                type="time"
                                onChange={e => {
                                    const [hours, minutes] = e.target.value.split(':');
                                    const date = new Date(testDate);
                                    date.setHours(parseInt(hours), parseInt(minutes));
                                    setTestDate(date.toString());
                                }}
                                className="w-full bg-white/5 p-3 rounded-xl border border-white/10 focus:outline-none focus:border-orange-500/50 text-sm"
                            />
                        </div>
                        <button
                            onClick={scheduleTest}
                            disabled={scheduling}
                            className="w-full sm:w-auto sm:px-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 p-3 rounded-xl font-bold text-sm transition-colors"
                        >
                            {scheduling ? 'Scheduling...' : 'Schedule Test'}
                        </button>
                    </div>
                )}

                {activeTab === 'device' && (
                    <div className="space-y-4 w-full max-w-4xl mx-auto">
                        <h3 className="font-bold text-base">Device Information</h3>
                        {deviceInfo ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                                    <span className="text-gray-500 text-sm">Manufacturer</span>
                                    <span className="font-medium text-sm">{deviceInfo.manufacturer}</span>
                                </div>
                                <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                                    <span className="text-gray-500 text-sm">Model</span>
                                    <span className="font-medium text-sm">{deviceInfo.model}</span>
                                </div>
                                <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                                    <span className="text-gray-500 text-sm">OS</span>
                                    <span className="font-medium text-sm">{deviceInfo.operatingSystem} {deviceInfo.osVersion}</span>
                                </div>
                                <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                                    <span className="text-gray-500 text-sm">Platform</span>
                                    <span className="font-medium text-sm">{deviceInfo.platform}</span>
                                </div>
                                <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl flex items-center justify-between sm:col-span-2">
                                    <span className="text-gray-500 text-sm">Is Virtual</span>
                                    <span className="font-medium text-sm">{deviceInfo.isVirtual ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-sm text-gray-400 animate-pulse">
                                Fetching device info...
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showChapterPopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex p-6"
                        onClick={() => setShowChapterPopup(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-[#1e293b] p-5 rounded-2xl w-full max-w-sm m-auto max-h-[80vh] overflow-y-auto border border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-bold mb-3">Select Chapters</h2>
                            <div className="relative mb-4">
                                <Search className="h-3.5 w-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={chapterSearch}
                                    onChange={e => setChapterSearch(e.target.value)}
                                    placeholder="Search chapters..."
                                    className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                                />
                            </div>

                            {filteredChapterGroups ? (
                                <div className="space-y-1">
                                    {filteredChapterGroups.length === 0 && (
                                        <p className="text-sm text-gray-500 text-center py-4">No chapters match "{chapterSearch}"</p>
                                    )}
                                    {filteredChapterGroups.map(c => (
                                        <div
                                            key={`${c.subject}-${c.name}`}
                                            className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                                            onClick={() => {
                                                const exists = selectedChapters.some(s => s.name === c.name);
                                                if (exists) setSelectedChapters(prev => prev.filter(s => s.name !== c.name));
                                                else setSelectedChapters(prev => [...prev, { name: c.name, subject: c.subject }]);
                                            }}
                                        >
                                            <input type="checkbox" checked={selectedChapters.some(s => s.name === c.name)} readOnly className="accent-orange-500" />
                                            <span className="text-sm">{c.name}</span>
                                            <span className="text-[10px] text-gray-500 ml-auto">{c.subject}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                Object.entries(CHAPTER_DATA).map(([subject, classes]) => (
                                    <div key={subject} className="mb-4">
                                        <h3 className="font-bold text-blue-400 flex justify-between items-center mb-1">
                                            {subject}
                                            <button
                                                className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-full transition-colors"
                                                onClick={() => {
                                                    const all = Object.values(classes).flat();
                                                    const missing = all.filter(c => !selectedChapters.some(s => s.name === c));
                                                    if (missing.length > 0) setSelectedChapters(prev => [...prev, ...missing.map(name => ({ name, subject }))]);
                                                    else setSelectedChapters(prev => prev.filter(s => s.subject !== subject));
                                                }}
                                            >
                                                Toggle All
                                            </button>
                                        </h3>
                                        {Object.entries(classes).map(([className, chapters]) => (
                                            <div key={className}>
                                                <p className="text-xs text-gray-500 mt-1">{className}</p>
                                                {chapters.map(c => (
                                                    <div
                                                        key={c}
                                                        className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                                                        onClick={() => {
                                                            const exists = selectedChapters.some(s => s.name === c);
                                                            if (exists) setSelectedChapters(prev => prev.filter(s => s.name !== c));
                                                            else setSelectedChapters(prev => [...prev, { name: c, subject }]);
                                                        }}
                                                    >
                                                        <input type="checkbox" checked={selectedChapters.some(s => s.name === c)} readOnly className="accent-orange-500" />
                                                        <span className="text-sm">{c}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                            <button
                                onClick={() => setShowChapterPopup(false)}
                                className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-xl font-bold mt-4 transition-colors"
                            >
                                OK
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
