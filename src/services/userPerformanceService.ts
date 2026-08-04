/**
 * User Performance Aggregator Service
 * Summarizes test results, weak topics, and silly mistake analytics
 * for AI Live Memory and Revision Tracking.
 */

import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export interface UserPerformanceSummary {
    totalTestsTaken: number;
    latestScore: number;
    totalPossible: number;
    latestSubjectScores: {
        physics?: number;
        chemistry?: number;
        biology?: number;
    };
    weakTopics: string[];
    sillyMistakesCount: number;
    formattedMemorySummary: string;
}

export async function getUserPerformanceSummary(uid: string): Promise<UserPerformanceSummary | null> {
    try {
        if (!uid) return null;

        const resultsRef = collection(db, 'users', uid, 'results');
        const q = query(resultsRef, orderBy('timestamp', 'desc'), limit(5));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const results = snapshot.docs.map(doc => doc.data());
        const latest = results[0];

        const totalTestsTaken = results.length;
        const latestScore = latest.score || 0;
        const totalPossible = latest.totalPossibleMarks || 720;
        const weakTopics: string[] = [];
        let sillyMistakesCount = 0;

        results.forEach(res => {
            if (res.sillyMistakesLoss && res.sillyMistakesLoss > 0) {
                sillyMistakesCount += Math.ceil(res.sillyMistakesLoss / 4);
            }
            if (res.topicAnalysis && Array.isArray(res.topicAnalysis)) {
                res.topicAnalysis.forEach((t: any) => {
                    if (t.correct / (t.total || 1) < 0.5 && t.topicName) {
                        if (!weakTopics.includes(t.topicName)) {
                            weakTopics.push(t.topicName);
                        }
                    }
                });
            }
        });

        const latestSubjectScores = latest.subjectScores || {
            physics: latest.physicsScore || 0,
            chemistry: latest.chemScore || 0,
            biology: latest.bioScore || 0
        };

        const formattedMemorySummary = `[Student Performance Memory Context]
- Total Tests Taken: ${totalTestsTaken}
- Latest Test Score: ${latestScore} / ${totalPossible}
- Subject Scores: Physics ${latestSubjectScores.physics || 0}, Chemistry ${latestSubjectScores.chemistry || 0}, Biology ${latestSubjectScores.biology || 0}
- Silly Mistakes Count: ${sillyMistakesCount}
- Identified Weak Topics: ${weakTopics.length > 0 ? weakTopics.slice(0, 5).join(', ') : 'None recorded yet'}`;

        return {
            totalTestsTaken,
            latestScore,
            totalPossible,
            latestSubjectScores,
            weakTopics,
            sillyMistakesCount,
            formattedMemorySummary
        };
    } catch (e) {
        console.error('[UserPerformanceService] Error fetching user performance:', e);
        return null;
    }
}
