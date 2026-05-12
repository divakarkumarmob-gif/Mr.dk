import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import TestResultDetail from './TestResultDetail';

export default function AnalysisHistory({ onNavigate }: { onNavigate: (view: any) => void }) {
    const [results, setResults] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any | null>(null);

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

    if (selectedResult) {
        return <TestResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-white">Test History</h1>
            <div className="space-y-4">
                {results.map(result => (
                    <div key={result.id} className="bg-[#161e38] p-4 rounded-xl flex justify-between items-center">
                        <div className="flex flex-col text-left">
                            <span className="font-semibold text-white">{result.testName}</span>
                            {result.timestamp && (
                                <span className="text-gray-400 text-xs">
                                    {result.timestamp.toLocaleDateString()}
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={() => setSelectedResult(result)}
                            className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold"
                        >See Result</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
