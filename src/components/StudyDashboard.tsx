import { motion } from 'motion/react';
import { ArrowLeft, Clock, CheckCircle, Target, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';                
import FocusAnalytics from './FocusAnalytics';
import { getRecentlyViewed } from '../lib/offlineStorage';

export default function StudyDashboard({ onClose }: { onClose: () => void }) {
    const [stats, setStats] = useState([
        { label: 'Total Study Time', value: '42.5 hrs', icon: Clock, color: 'text-blue-400' },
        { label: 'Tests Completed', value: '18', icon: CheckCircle, color: 'text-green-400' },
        { label: 'Mastered Flashcards', value: '0', icon: Target, color: 'text-orange-400' },
    ]);
    const [focusData, setFocusData] = useState<{ day: string; focus: number }[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const history = await getRecentlyViewed();
            setRecentlyViewed(history);
        })();
    }, []);

    useEffect(() => {
        if (auth.currentUser) {
            const fetchStats = async () => {
                try {
                    const flashcardsRef = collection(db, 'users', auth.currentUser!.uid, 'flashcards');
                    const querySnapshot = await getDocs(flashcardsRef);
                    let totalMastered = 0;
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data.masteredQuestionIds) {
                            totalMastered += data.masteredQuestionIds.length;
                        }
                    });
                    
                    setStats(prev => prev.map(s => s.label === 'Mastered Flashcards' ? 
                                              {...s, value: totalMastered.toString()} : s));
                    
                    // Fetch focus sessions (placeholder for real collection)
                    const sessionsQuery = query(collection(db, 'users', auth.currentUser!.uid, 'focus_sessions'), orderBy('timestamp', 'desc'), limit(7));
                    const sessionsSnapshot = await getDocs(sessionsQuery);
                    const data: { day: string; focus: number }[] = [];
                    sessionsSnapshot.forEach(doc => {
                        const d = doc.data();
                        data.push({ day: new Date(d.timestamp).toLocaleDateString('en-US', {weekday: 'short'}), focus: d.efficiency || 50 });
                    });
                    setFocusData(data.reverse());

                } catch (error) {
                    handleFirestoreError(error, OperationType.LIST, 'users/userId/flashcards');
                }
            };
            fetchStats();
        }
    }, []);

    const subjectProgress = [
        { name: 'Physics', progress: 58 },
        { name: 'Chemistry', progress: 61 },
        { name: 'Biology', progress: 72 },
    ];

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-4 sm:p-6 flex flex-col overflow-y-auto text-white">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 text-purple-300 transition cursor-pointer">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">Study Analytics Dashboard</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-purple-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center gap-4">
                        <div className={`p-3 bg-purple-500/15 rounded-xl border border-purple-500/30 ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs text-purple-300 font-bold uppercase tracking-wide">{stat.label}</p>
                            <p className="text-2xl font-extrabold text-white mt-0.5">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl border border-purple-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)] w-full mb-6">
                <h3 className="text-sm font-extrabold text-purple-200 mb-4 tracking-wide">Focus Trend</h3>
                <FocusAnalytics data={focusData} />
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl border border-purple-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)] w-full mb-6">
                <h3 className="text-sm font-extrabold text-purple-200 mb-4 tracking-wide">Recently Viewed Notes</h3>
                <div className="space-y-2">
                    {recentlyViewed.slice(0, 3).map((chapter: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-purple-950/40 border border-purple-800/30 text-xs font-semibold text-white">
                            <BookOpen className="h-4 w-4 text-purple-300" />
                            {chapter}
                        </div>
                    ))}
                    {recentlyViewed.length === 0 && <p className="text-slate-400 text-xs">No recent notes.</p>}
                </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl border border-purple-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)] w-full">
                <h3 className="text-sm font-extrabold text-purple-200 mb-6 tracking-wide">Subject Mastery</h3>
                <div className="space-y-6">
                    {subjectProgress.map(sub => (
                        <div key={sub.name}>
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-white">{sub.name}</span>
                                <span className="text-purple-300">{sub.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-purple-500/20">
                                <motion.div 
                                    className="bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 h-full rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${sub.progress}%` }}
                                    transition={{ duration: 1 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

