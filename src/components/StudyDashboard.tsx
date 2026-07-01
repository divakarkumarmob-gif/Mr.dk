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
        <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onClose} className="text-white"><ArrowLeft /></button>
                <h2 className="text-xl font-bold text-white">Study Progress</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4">
                        <div className={`p-3 bg-white/10 rounded-lg ${stat.color}`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">{stat.label}</p>
                            <p className="text-xl font-bold text-white">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 w-full mb-8">
                <h3 className="text-sm font-bold text-gray-300 mb-6">Focus Trend</h3>
                <FocusAnalytics data={focusData} />
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 w-full mb-8">
                <h3 className="text-sm font-bold text-gray-300 mb-6">Recent Notes</h3>
                <div className="space-y-2">
                    {recentlyViewed.slice(0, 3).map((chapter: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-xs text-white">
                            <BookOpen className="h-4 w-4 text-blue-400" />
                            {chapter}
                        </div>
                    ))}
                    {recentlyViewed.length === 0 && <p className="text-gray-500 text-xs">No recent notes.</p>}
                </div>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 w-full">
                <h3 className="text-sm font-bold text-gray-300 mb-6">Subject Mastery</h3>
                <div className="space-y-6">
                    {subjectProgress.map(sub => (
                        <div key={sub.name}>
                            <div className="flex justify-between text-xs mb-2">
                                <span className="font-bold text-white">{sub.name}</span>
                                <span className="text-gray-400">{sub.progress}%</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <motion.div 
                                    className="bg-orange-600 h-full"
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
