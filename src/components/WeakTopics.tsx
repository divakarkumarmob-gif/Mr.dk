import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { TrendingDown, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TopicStat {
    chapter: string;
    subject?: string;
    correct: number;
    incorrect: number;
    unattempted: number;
    total: number;
}

interface AggregatedTopic {
    chapter: string;
    subject?: string;
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number;
    attempts: number; // number of tests that touched this chapter
}

// Minimum questions attempted across all tests before a chapter is
// confident enough to call "weak" — otherwise a single unlucky guess on
// a 2-question sample would rank a chapter as the worst one.
const MIN_QUESTIONS_FOR_CONFIDENCE = 4;

export default function WeakTopics({ onStartPractice }: { onStartPractice: (chapters: { name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard' }[]) => void }) {
    const [loading, setLoading] = useState(true);
    const [topics, setTopics] = useState<AggregatedTopic[]>([]);
    const [popupState, setPopupState] = useState<{ open: boolean; topic: AggregatedTopic | null; count: number; difficulty: 'Medium' | 'Hard' }>({
        open: false,
        topic: null,
        count: 10,
        difficulty: 'Medium',
    });

    useEffect(() => {
        if (!auth.currentUser) { setLoading(false); return; }
        const q = query(collection(db, 'users', auth.currentUser.uid, 'results'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chapterMap = new Map<string, AggregatedTopic>();

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const topicAnalysis: TopicStat[] = Array.isArray(data.topicAnalysis) ? data.topicAnalysis : [];

                topicAnalysis.forEach(stat => {
                    if (!stat.chapter || !stat.total) return;
                    const existing = chapterMap.get(stat.chapter);
                    if (existing) {
                        existing.totalQuestions += stat.total;
                        existing.totalCorrect += stat.correct;
                        existing.attempts += 1;
                        if (!existing.subject && stat.subject) existing.subject = stat.subject;
                    } else {
                        chapterMap.set(stat.chapter, {
                            chapter: stat.chapter,
                            subject: stat.subject,
                            totalQuestions: stat.total,
                            totalCorrect: stat.correct,
                            accuracy: 0,
                            attempts: 1,
                        });
                    }
                });
            });

            const aggregated = Array.from(chapterMap.values())
                .map(t => ({ ...t, accuracy: t.totalQuestions > 0 ? Math.round((t.totalCorrect / t.totalQuestions) * 100) : 0 }))
                .filter(t => t.totalQuestions >= MIN_QUESTIONS_FOR_CONFIDENCE)
                .sort((a, b) => a.accuracy - b.accuracy)
                .slice(0, 5);

            setTopics(aggregated);
            setLoading(false);
        }, (e) => {
            console.error("Error loading weak topics:", e);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-6 mb-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
        );
    }

    // Not enough test history yet to say anything meaningful — stay quiet
    // rather than showing an empty/confusing card.
    if (topics.length === 0) {
        return null;
    }

    const accuracyColor = (acc: number) => {
        if (acc < 40) return 'text-red-400 bg-red-500/10 border-red-500/30';
        if (acc < 65) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    };

    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Weak Topics</h2>
            </div>

            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl divide-y divide-white/5 overflow-hidden">
                {topics.map(topic => (
                    <button
                        key={topic.chapter}
                        onClick={() => setPopupState({ open: true, topic, count: 10, difficulty: 'Medium' })}
                        className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors text-left"
                    >
                        <div className="flex-1 min-w-0 mr-3">
                            <p className="font-semibold text-sm truncate">{topic.chapter}</p>
                            <p className="text-xs text-gray-500">{topic.subject || 'General'} &middot; {topic.totalQuestions} questions attempted</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${accuracyColor(topic.accuracy)}`}>
                                {topic.accuracy}%
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                        </div>
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {popupState.open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
                        onClick={() => setPopupState(prev => ({ ...prev, open: false }))}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#161e38] p-6 rounded-2xl w-full max-w-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold mb-1">Revise {popupState.topic?.chapter}</h2>
                            <p className="text-xs text-gray-400 mb-4">Currently {popupState.topic?.accuracy}% accuracy across {popupState.topic?.totalQuestions} questions.</p>

                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Number of Questions</label>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={popupState.count}
                                onChange={(e) => setPopupState(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                                className="w-full my-2"
                            />
                            <div className="text-center font-bold text-lg mb-4">{popupState.count} Questions</div>

                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Difficulty</label>
                            <div className="grid grid-cols-2 gap-2 mt-2 mb-6">
                                {(['Medium', 'Hard'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setPopupState(prev => ({ ...prev, difficulty: level }))}
                                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                            popupState.difficulty === level ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    const topic = popupState.topic;
                                    if (topic) {
                                        onStartPractice([{
                                            name: topic.chapter,
                                            subject: topic.subject || 'Physics',
                                            numQuestions: popupState.count,
                                            difficulty: popupState.difficulty,
                                        }]);
                                    }
                                    setPopupState(prev => ({ ...prev, open: false }));
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors p-3 rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                Start Revision
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
