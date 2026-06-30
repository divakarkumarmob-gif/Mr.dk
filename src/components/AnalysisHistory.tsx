import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import BottomNav from './BottomNav';
import TestResultDetail from './TestResultDetail';

export default function AnalysisHistory({ onNavigate, user }: { onNavigate: (view: any) => void, user: any }) {
    const [results, setResults] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');

    useEffect(() => {
        const fetchResults = async () => {
            if (!user) return;
            
            if (user.uid.startsWith('local_guest_')) {
                const localResults = localStorage.getItem(`results_${user.uid}`);
                if (localResults) {
                    try {
                        const data = JSON.parse(localResults).map((d: any) => ({
                            ...d,
                            timestamp: new Date(d.timestamp)
                        })).sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());
                        setResults(data);
                    } catch (e) {
                        console.error("Failed to parse local results", e);
                    }
                }
                return;
            }

            const q = query(collection(db, 'users', user.uid, 'results'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    timestamp: d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp) : new Date()),
                };
            });
            setResults(data);
        };
        fetchResults();
    }, [user]);

    const currentResults = results.slice(0, 3);
    const pastResults = results.slice(3);

    const displayedResults = activeTab === 'current' ? currentResults : pastResults;

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const isAnalysisReady = (timestamp: Date) => {
        const elapsed = now - timestamp.getTime();
        return elapsed >= 5000;
    };

    const getRemainingTime = (timestamp: Date) => {
        const elapsed = now - timestamp.getTime();
        const remaining = Math.max(0, 5000 - elapsed);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (selectedResult) {
        return <TestResultDetail result={selectedResult} onBack={() => window.history.back()} />;
    }

    useEffect(() => {
        const handlePop = () => {
            if (selectedResult && !window.history.state?.isResultOpen) {
                setSelectedResult(null);
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [selectedResult]);

    const handleSeeResult = (result: any) => {
        setSelectedResult(result);
        window.history.pushState({ view: 'analytics', isResultOpen: true }, '', window.location.href);
    };

    return (
        <div className="flex flex-col min-h-screen pb-20 bg-background text-foreground px-3">
            <div className="flex-grow">
                <h1 className="text-2xl font-bold mb-6">Test History</h1>

                <div className="flex gap-2 mb-6 bg-card p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('current')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm ${activeTab === 'current' ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}
                    >
                        Current (Latest 3)
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm ${activeTab === 'past' ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}
                    >
                        Past
                    </button>
                </div>

                <div className="space-y-4">
                    {displayedResults.length === 0 ? (
                        <p className="text-muted-foreground text-center mt-10">No tests found in this category.</p>
                    ) : (
                        displayedResults.map(result => (
                            <div key={result.id} className="bg-card p-4 rounded-xl flex justify-between items-center">
                                <div className="flex flex-col text-left">
                                    <span className="font-semibold">{result.testName}</span>
                                    {result.timestamp && (
                                        <span className="text-muted-foreground text-xs">
                                            {result.timestamp.toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAnalysisReady(result.timestamp) ? (
                                        <button 
                                            onClick={() => handleSeeResult(result)}
                                            className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold active:scale-95 transition-all"
                                        >
                                            See Result
                                        </button>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Analyzing...</span>
                                            <div className="bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-blue-400/20">
                                                {getRemainingTime(result.timestamp)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <BottomNav currentView="analytics" onNavigate={onNavigate} />
        </div>
    );
}
