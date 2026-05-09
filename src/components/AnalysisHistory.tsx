import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc } from 'firebase/firestore';
import TestResultDetail from './TestResultDetail';

export default function AnalysisHistory({ onNavigate }: { onNavigate: (view: any) => void }) {
    const [results, setResults] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any | null>(null);

    useEffect(() => {
        const fetchResults = async () => {
            if (!auth.currentUser) return;
            const q = query(collection(db, 'users', auth.currentUser.uid, 'results'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(data);
        };
        fetchResults();
    }, []);

    const addDummyResult = async () => {
        if (!auth.currentUser) return;
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'results'), {
            testName: 'Sample Test',
            difficulty: 'Moderate',
            correct: 14,
            incorrect: 6,
            unattempted: 0,
            total: 20,
            score: 70,
            marks: 10.5,
            timeTakenSeconds: 1350,
            accuracy: 70,
            speed: 65,
            attemptedRate: 100,
            topicAnalysis: [
                { topicName: 'Diversity in Living World', correct: 4, total: 6 },
                { topicName: 'Structural Organisation in Plants', correct: 5, total: 7 },
                { topicName: 'Animal Kingdom', correct: 5, total: 7 }
            ],
            userId: auth.currentUser.uid,
            timestamp: new Date().toISOString()
        });
        window.location.reload();
    };

    if (selectedResult) {
        return <TestResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-white">Test History</h1>
            <button onClick={addDummyResult} className="bg-yellow-600 px-4 py-2 rounded-lg text-sm font-bold mb-4">Add Dummy Test</button>
            <div className="space-y-4">
                {results.map(result => (
                    <div key={result.id} className="bg-[#161e38] p-4 rounded-xl flex justify-between items-center">
                        <span className="font-semibold text-white">{result.testName}</span>
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
