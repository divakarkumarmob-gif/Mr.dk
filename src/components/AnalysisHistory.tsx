import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import BottomNav from './BottomNav';
import TestResultDetail from './TestResultDetail';

export default function AnalysisHistory({ onNavigate }: { onNavigate: (view: any) => void }) {
    const [results, setResults] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');

    useEffect(() => {
        const fetchResults = async () => {
            if (!auth.currentUser) return;
            const q = query(collection(db, 'users', auth.currentUser.uid, 'results'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    timestamp: d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp),
                };
            });
            setResults(data);
        };
        fetchResults();
    }, []);

    const currentResults = results.slice(0, 3);
    const pastResults = results.slice(3);

    const displayedResults = activeTab === 'current' ? currentResults : pastResults;

    if (selectedResult) {
        return <TestResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />;
    }

    return (
        <div className="flex flex-col min-h-screen pb-20 bg-background text-foreground">
            <div className="p-6 flex-grow">
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
                                <button 
                                    onClick={() => setSelectedResult(result)}
                                    className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold"
                                >See Result</button>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <BottomNav currentView="analytics" onNavigate={onNavigate} />
        </div>
    );
}
