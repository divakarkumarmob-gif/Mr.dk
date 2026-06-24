import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';                
import { MessageSquare as MessageSquareIcon, Upload as UploadIcon, FileUp, Trash2, Edit2, Menu, X, Users, ClipboardList } from 'lucide-react';
import QuestionImporter from './QuestionImporter';
import { motion, AnimatePresence } from 'motion/react';
import ChatWindow from './ChatWindow';

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

interface Notification {
    id: string;
    message: string;
    timestamp: any;
    readBy?: string[];
}

export default function AdminPanel({ onNavigate }: { onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'adminChat' | 'technicalSupport') => void }) {
    const [activeTab, setActiveTab] = useState<'message' | 'upload' | 'import' | 'users' | 'schedule'>('message');
    const [message, setMessage] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [userStats, setUserStats] = useState({ total: 0, online: 0 });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editMessage, setEditMessage] = useState('');
    
    // New Schedule state
    const [testName, setTestName] = useState('');
    const [testDate, setTestDate] = useState('');
    const [selectedChapters, setSelectedChapters] = useState<{name: string, subject: string}[]>([]);
    const [showChapterPopup, setShowChapterPopup] = useState(false);
    const [subjectConfig, setSubjectConfig] = useState<{[key: string]: {questions: number, time: number}}>({                
        Physics: {questions: 10, time: 10},
        Chemistry: {questions: 10, time: 10},
        Biology: {questions: 10, time: 10}
    });

    useEffect(() => {
        const handlePop = () => {
            if (showChapterPopup && !window.history.state?.isChapterPopupOpen) {
                setShowChapterPopup(false);
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [showChapterPopup]);

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

    const scheduleTest = async () => {
        if (!testName || !testDate || selectedChapters.length === 0) return alert("Fill all fields and select chapters");
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
            alert("Test scheduled!");
            setTestName('');
            setTestDate('');
            setSelectedChapters([]);
        } catch(e) {
            console.error(e);
            alert("Failed to schedule test");
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
                <button onClick={() => setActiveTab('schedule')} className={`w-full p-2 rounded-lg flex items-center justify-start gap-2 ${activeTab === 'schedule' ? 'bg-white/10' : ''}`}>
                    <ClipboardList className="h-4 w-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">Schedule</span>}
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
                {activeTab === 'schedule' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-white">Schedule New Test</h3>
                        <input type="text" placeholder="Test Name" value={testName} onChange={e => setTestName(e.target.value)} className="w-full bg-white/5 p-2 rounded-lg border border-white/10" />
                        <button onClick={() => { setShowChapterPopup(true); window.history.pushState({ ...window.history.state, isChapterPopupOpen: true }, '', window.location.href); }} className="w-full bg-white/5 p-2 rounded-lg border border-white/10 text-left">
                            {selectedChapters.length > 0 ? `${selectedChapters.length} chapters selected` : 'Select Chapters'}
                        </button>
                        
                        {Object.keys(subjectConfig).map(sub => (
                            <div key={sub} className="bg-white/5 p-3 rounded-lg border border-white/10">
                                <p className="font-bold mb-2">{sub}</p>
                                <div className="flex gap-4">
                                    <label className="text-xs">Questions: {subjectConfig[sub].questions}</label>
                                    <input type="range" min="5" max={sub === 'Biology' ? 100 : 50} step="5" value={subjectConfig[sub].questions} onChange={e => {
                                        const q = parseInt(e.target.value);
                                        setSubjectConfig({...subjectConfig, [sub]: {...subjectConfig[sub], questions: q, time: q}});
                                    }}/>
                                </div>
                            </div>
                        ))}
                        <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} className="w-full bg-white/5 p-2 rounded-lg border border-white/10" />
                        <input type="time" onChange={e => {
                            const [hours, minutes] = e.target.value.split(':');
                            const date = new Date(testDate);
                            date.setHours(parseInt(hours), parseInt(minutes));
                            setTestDate(date.toString());
                        }} className="w-full bg-white/5 p-2 rounded-lg border border-white/10" />
                        <button onClick={scheduleTest} className="w-full bg-blue-600 p-2 rounded-lg font-bold">Schedule Test</button>
                    </div>
                )}
            </div>
            
            <AnimatePresence>
                {showChapterPopup && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-50 flex p-6" onClick={() => setShowChapterPopup(false)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-sm m-auto max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <h2 className="text-xl font-bold mb-4">Select Chapters</h2>
                            {Object.entries(CHAPTER_DATA).map(([subject, classes]) => (
                                <div key={subject} className="mb-4">
                                    <h3 className="font-bold text-blue-400 flex justify-between">
                                      {subject}
                                      <button className="text-xs text-white bg-blue-600 px-2 rounded-full" onClick={() => {
                                        const all = Object.values(classes).flat();
                                        const missing = all.filter(c => !selectedChapters.some(s => s.name === c));
                                        if (missing.length > 0) setSelectedChapters(prev => [...prev, ...missing.map(name => ({name, subject}))]);
                                        else setSelectedChapters(prev => prev.filter(s => s.subject !== subject));
                                      }}>Toggle All</button>
                                    </h3>
                                    {Object.entries(classes).map(([className, chapters]) => (
                                        <div key={className}>
                                            <p className="text-sm text-gray-400">{className}</p>
                                            {chapters.map(c => (
                                                <div key={c} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded" onClick={() => {
                                                    const exists = selectedChapters.some(s => s.name === c);
                                                    if (exists) setSelectedChapters(prev => prev.filter(s => s.name !== c));
                                                    else setSelectedChapters(prev => [...prev, { name: c, subject }]);
                                                }}>
                                                    <input type="checkbox" checked={selectedChapters.some(s => s.name === c)} readOnly />
                                                    <span className="text-sm">{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <button onClick={() => setShowChapterPopup(false)} className="w-full bg-blue-600 p-3 rounded-xl font-bold mt-4">OK</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
