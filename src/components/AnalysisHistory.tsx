import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import BottomNav from './BottomNav';
import TestResultDetail from './TestResultDetail';
import ErrorBoundary from './ErrorBoundary';

export default function AnalysisHistory({ onNavigate, user, onResultSelect }: { onNavigate: (view: any) => void, user: any, onResultSelect: (result: any) => void }) {
    const [results, setResults] = useState<any[]>([]);
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
        return elapsed >= 120000;
    };

    const getRemainingTime = (timestamp: Date) => {
        const elapsed = now - timestamp.getTime();
        const remaining = Math.max(0, 120000 - elapsed);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.resultDetailOpen) {
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleSeeResult = (result: any) => {
        onResultSelect(result);
        onNavigate('analysisResultDetail');
    };

    const handleBackFromResult = () => {
        window.history.back();
    };

    return (
        <div className="flex flex-col h-full flex-1 min-h-0 bg-[#0a0f24] text-white px-3 overflow-y-auto pb-44">
            <div className="flex-grow pt-[env(safe-area-inset-top,0px)]">
                <h1 className="text-xl font-black mb-4 text-white">Test History & Analysis 📊</h1>

                <div className="flex gap-1.5 mb-6 bg-slate-900/80 border border-purple-500/25 p-1.5 rounded-2xl backdrop-blur-xl shadow-lg">
                    <button
                        onClick={() => setActiveTab('current')}
                        className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${activeTab === 'current' ? 'gradient-btn-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Current (Latest 3)
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${activeTab === 'past' ? 'gradient-btn-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Past History
                    </button>
                </div>

                <div className="space-y-3">
                    {displayedResults.length === 0 ? (
                        <div className="glass-card border border-purple-500/20 p-8 rounded-3xl text-center">
                            <p className="text-slate-400 text-sm font-bold">No test records found in this category.</p>
                        </div>
                    ) : (
                        displayedResults.map(result => (
                            <div key={result.id} className="glass-card glass-card-hover border border-purple-500/20 p-4 rounded-2xl flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                                <div className="flex flex-col text-left">
                                    <span className="font-extrabold text-sm text-white">{result.testName}</span>
                                    {result.timestamp && !isNaN(result.timestamp.getTime()) && (
                                        <span className="text-purple-300/80 text-[11px] font-semibold mt-0.5">
                                            {result.timestamp.toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAnalysisReady(result.timestamp) ? (
                                        <button 
                                            onClick={() => handleSeeResult(result)}
                                            className="gradient-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold active:scale-95 transition-all shadow-md shadow-purple-500/20 cursor-pointer"
                                        >
                                            See Result
                                        </button>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-extrabold text-purple-300 uppercase tracking-widest mb-1">Analyzing...</span>
                                            <div className="bg-purple-500/10 text-purple-300 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border border-purple-500/30">
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
