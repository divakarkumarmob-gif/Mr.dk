import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Share2, Award, Zap, AlertTriangle, CheckCircle2, BookOpen, Clock, Target, Sparkles, ChevronRight } from 'lucide-react';
import { shareResult } from '../utils/share';
import TestReview from './TestReview';
import TestAnalysis from './TestAnalysis';
import TestTutor from './TestTutor';
import { toPng } from 'html-to-image';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { enableScreenshot, disableScreenshot } from '../utils/screenSecurity';

// Helper to calculate subject scores from student test data
function calculateRealSubjectBreakdown(result: any) {
    const questions = result?.questions || [];
    const answers = result?.answers || {};

    let physicsObtained = 0, physicsMax = 180;
    let chemistryObtained = 0, chemistryMax = 180;
    let biologyObtained = 0, biologyMax = 360;

    let hasSubjectData = false;

    if (Array.isArray(questions) && questions.length > 0) {
        let phyGot = 0, phyTot = 0;
        let chemGot = 0, chemTot = 0;
        let bioGot = 0, bioTot = 0;

        questions.forEach((q: any, idx: number) => {
            const subject = String(q?.subject || q?.subjectId || q?.category || '').toLowerCase();
            const userAns = answers[q.id || idx];
            const isCorrect = userAns !== undefined && String(userAns) === String(q.correctAnswer);
            const isAttempted = userAns !== undefined && userAns !== null && userAns !== '';

            let scoreDelta = 0;
            if (isCorrect) scoreDelta = 4;
            else if (isAttempted) scoreDelta = -1;

            if (subject.includes('physic')) {
                phyGot += scoreDelta;
                phyTot += 4;
                hasSubjectData = true;
            } else if (subject.includes('chem')) {
                chemGot += scoreDelta;
                chemTot += 4;
                hasSubjectData = true;
            } else if (subject.includes('biol') || subject.includes('botan') || subject.includes('zool')) {
                bioGot += scoreDelta;
                bioTot += 4;
                hasSubjectData = true;
            }
        });

        if (hasSubjectData) {
            physicsObtained = Math.max(0, phyGot);
            physicsMax = phyTot || 180;
            chemistryObtained = Math.max(0, chemGot);
            chemistryMax = chemTot || 180;
            biologyObtained = Math.max(0, bioGot);
            biologyMax = bioTot || 360;
        }
    }

    if (!hasSubjectData) {
        // Fallback proportional split based on overall test score
        const obtained = Number(result?.obtainedMarks || result?.score || 0);
        const total = Number(result?.totalPossibleMarks || (result?.totalQuestions ? result.totalQuestions * 4 : 720));
        const ratio = total > 0 ? Math.min(1, Math.max(0, obtained / total)) : 0;

        physicsMax = Math.round(total * 0.25);
        chemistryMax = Math.round(total * 0.25);
        biologyMax = Math.max(0, total - physicsMax - chemistryMax);

        physicsObtained = Math.round(physicsMax * ratio);
        chemistryObtained = Math.round(chemistryMax * ratio);
        biologyObtained = Math.round(biologyMax * ratio);
    }

    return {
        physics: { obtained: physicsObtained, max: physicsMax },
        chemistry: { obtained: chemistryObtained, max: chemistryMax },
        biology: { obtained: biologyObtained, max: biologyMax },
    };
}

// AIR Rank Predictor based on NEET Score
function predictNeetAIR(obtainedMarks: number, totalPossibleMarks: number = 720) {
    const normalizedScore = totalPossibleMarks > 0 ? Math.round((obtainedMarks / totalPossibleMarks) * 720) : 0;

    if (normalizedScore >= 700) {
        return { rankRange: 'AIR 1 - 150', chanceText: 'Top Choice AIIMS New Delhi / Premier GMC', tier: 'top' };
    } else if (normalizedScore >= 660) {
        return { rankRange: 'AIR 151 - 2,500', chanceText: 'Guaranteed Top State GMC Seat', tier: 'top' };
    } else if (normalizedScore >= 620) {
        return { rankRange: 'AIR 2,501 - 14,000', chanceText: 'High Chance for State Quota GMC', tier: 'high' };
    } else if (normalizedScore >= 560) {
        return { rankRange: 'AIR 14,001 - 38,000', chanceText: 'Strong Chance for Government Medical College', tier: 'med' };
    } else if (normalizedScore >= 500) {
        return { rankRange: 'AIR 38,001 - 75,000', chanceText: 'Eligible for Semi-Govt & Top Private Colleges', tier: 'med' };
    } else if (normalizedScore >= 400) {
        return { rankRange: 'AIR 75,001 - 1,50,000', chanceText: 'Eligible for Private Medical Seats', tier: 'low' };
    } else {
        return { rankRange: 'AIR 1,50,000+', chanceText: 'Focus on High-Weightage NCERT Concepts', tier: 'low' };
    }
}

export default function TestResultDetail({ result, onBack }: { result: any, onBack: () => void }) {
    useEffect(() => {
        enableScreenshot();
        return () => {
            disableScreenshot();
        };
    }, []);

    const contentRef = useRef<HTMLDivElement>(null);

    const [showReview, setShowReview] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showTutor, setShowTutor] = useState(false);
    const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

    if (!result) return (
        <div className="min-h-dvh bg-[#070b19] text-white flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xl font-bold mb-4">Result data not found</p>
            <button onClick={onBack} className="px-6 py-2 bg-blue-600 rounded-xl font-bold">Go Back</button>
        </div>
    );

    const handleShare = async () => {
        if (!contentRef.current) return;
        try {
            const dataUrl = await toPng(contentRef.current, { backgroundColor: '#070b19' });
            if (Capacitor.isNativePlatform()) {
                const fileName = 'test_result.png';
                await Filesystem.writeFile({
                    path: fileName,
                    data: dataUrl,
                    directory: Directory.Cache
                });
                const resultUri = await Filesystem.getUri({
                    directory: Directory.Cache,
                    path: fileName
                });
                await shareResult("Test Result", "Check out my NEET test score card!", resultUri.uri);
            } else {
                const link = document.createElement('a');
                link.download = 'neet_score_card.png';
                link.href = dataUrl;
                link.click();
            }
        } catch (e) {
            console.error("Share error:", e);
        }
    };

    if (showReview) {
        return <TestReview questions={result?.questions || []} answers={result?.answers || {}} filterType={filterType} onClose={() => setShowReview(false)} />;
    }

    if (showAnalysis) {
        return <TestAnalysis result={result} onClose={() => setShowAnalysis(false)} />;
    }

    if (showTutor) {
        return <TestTutor result={result} onClose={() => setShowTutor(false)} />;
    }

    // Parse real test metrics
    const correct = Number(result?.correct || 0);
    const incorrect = Number(result?.incorrect || 0);
    const unattempted = Number(result?.unattempted || 0);
    const totalQuestions = Number(result?.totalQuestions || (correct + incorrect + unattempted) || 180);
    const totalPossibleMarks = Number(result?.totalPossibleMarks || (totalQuestions * 4));
    
    // Obtained Marks calculation
    const obtainedMarks = result?.obtainedMarks !== undefined 
        ? Number(result.obtainedMarks)
        : Math.max(0, (correct * 4) - (incorrect * 1));

    const accuracy = Number(result?.accuracy || (correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0));
    const speed = Number(result?.speed || 65);

    const timeTakenSeconds = Number(result?.timeTakenSeconds || 0);
    const timeTakenMin = Math.floor(timeTakenSeconds / 60);
    const timeTakenSec = timeTakenSeconds % 60;

    // Real Subject Breakdown
    const subjects = calculateRealSubjectBreakdown(result);

    // NEET AIR Prediction
    const prediction = predictNeetAIR(obtainedMarks, totalPossibleMarks);

    // Dynamic Negative Marks & Lost Potential Breakdown
    const sillyMistakesLoss = incorrect * 5; // 4 marks missed + 1 negative mark
    const conceptGapLoss = Math.round(unattempted * 2.5); // Concept gap estimate
    const timeOutLoss = Math.max(0, (unattempted * 4) - conceptGapLoss); // Time out estimate
    const totalLostMarks = sillyMistakesLoss + conceptGapLoss + timeOutLoss;

    const potentialMaxScore = Math.min(totalPossibleMarks, obtainedMarks + sillyMistakesLoss);

    // Quadrant Matrix matching logic
    let autoZone = 'sniper';
    if (accuracy >= 80 && speed >= 60) autoZone = 'sniper';
    else if (accuracy < 80 && speed >= 60) autoZone = 'silly';
    else if (accuracy >= 80 && speed < 60) autoZone = 'perfectionist';
    else autoZone = 'concept';

    const activeZone = selectedQuadrant || autoZone;

    return (
        <div ref={contentRef} className="min-h-dvh bg-[#070b19] text-white p-4 pb-36 overflow-y-auto" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
            {/* Header */}
            <header className="flex justify-between items-center mb-5 px-1">
                <button onClick={onBack} className="p-2.5 bg-[#12182e] border border-white/10 rounded-full hover:bg-white/10 transition active:scale-95">
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h1 className="text-lg font-bold tracking-wide text-white">Score Card Analysis</h1>
                <button onClick={handleShare} className="p-2.5 bg-[#12182e] border border-white/10 rounded-full hover:bg-white/10 transition active:scale-95">
                    <Share2 className="w-5 h-5 text-gray-300" />
                </button>
            </header>

            {/* CARD 1: ESTIMATED NEET PREDICTION */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#141432] via-[#0f1329] to-[#0b0e22] border border-indigo-500/30 p-5 mb-5 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 rounded-full bg-[#312216] border border-amber-500/40 text-amber-400 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        ESTIMATED NEET 2026 PREDICTION
                    </span>
                </div>

                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-white mb-1.5 drop-shadow-md">
                            {prediction.rankRange}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>{prediction.chanceText}</span>
                        </div>
                    </div>

                    {/* TOTAL SCORE BOX */}
                    <div className="bg-[#171838]/90 border border-indigo-500/30 rounded-2xl px-5 py-3 text-center min-w-[120px] shadow-inner">
                        <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase mb-0.5">TOTAL SCORE</p>
                        <p className="text-3xl font-black text-[#22c55e] leading-none mb-1">
                            {obtainedMarks}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">out of {totalPossibleMarks}</p>
                    </div>
                </div>
            </div>

            {/* CARD 2: INTERACTIVE SUBJECT SCORE BREAKDOWN */}
            <div className="rounded-3xl bg-[#0d1326] border border-white/10 p-5 mb-5 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white tracking-wide">Interactive Subject Score Breakdown</h3>
                </div>

                <div className="space-y-4">
                    {/* Physics */}
                    <div className="bg-[#121933]/70 border border-blue-500/20 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-2.5">
                            <span className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                Physics
                            </span>
                            <span className="text-sm font-extrabold text-white">
                                {subjects.physics.obtained} <span className="text-gray-400 font-normal">/ {subjects.physics.max}</span>
                            </span>
                        </div>
                        <div className="relative w-full h-3 bg-[#080d1a] rounded-full overflow-hidden p-0.5">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                                style={{ width: `${subjects.physics.max > 0 ? Math.min(100, Math.max(0, (subjects.physics.obtained / subjects.physics.max) * 100)) : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Chemistry */}
                    <div className="bg-[#1d1628]/70 border border-amber-500/20 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-2.5">
                            <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                Chemistry
                            </span>
                            <span className="text-sm font-extrabold text-white">
                                {subjects.chemistry.obtained} <span className="text-gray-400 font-normal">/ {subjects.chemistry.max}</span>
                            </span>
                        </div>
                        <div className="relative w-full h-3 bg-[#080d1a] rounded-full overflow-hidden p-0.5">
                            <div 
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
                                style={{ width: `${subjects.chemistry.max > 0 ? Math.min(100, Math.max(0, (subjects.chemistry.obtained / subjects.chemistry.max) * 100)) : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Biology */}
                    <div className="bg-[#0f2420]/70 border border-emerald-500/20 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-2.5">
                            <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                Biology
                            </span>
                            <span className="text-sm font-extrabold text-white">
                                {subjects.biology.obtained} <span className="text-gray-400 font-normal">/ {subjects.biology.max}</span>
                            </span>
                        </div>
                        <div className="relative w-full h-3 bg-[#080d1a] rounded-full overflow-hidden p-0.5">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(34,197,94,0.6)]" 
                                style={{ width: `${subjects.biology.max > 0 ? Math.min(100, Math.max(0, (subjects.biology.obtained / subjects.biology.max) * 100)) : 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CARD 3: SPEED VS ACCURACY QUADRANT MATRIX */}
            <div className="rounded-3xl bg-[#0d1326] border border-white/10 p-5 mb-5 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-400" />
                            <h3 className="text-base font-bold text-white tracking-wide">Speed vs Accuracy Quadrant Matrix</h3>
                        </div>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">Select your pattern</span>
                </div>

                <div className="space-y-3">
                    {/* Quadrant 1: Sniper Zone */}
                    <div 
                        onClick={() => setSelectedQuadrant('sniper')}
                        className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                            activeZone === 'sniper' 
                                ? 'bg-[#092c20] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] scale-[1.01]' 
                                : 'bg-[#091f18]/60 border-emerald-500/30 opacity-80 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                🎯 ❌ Sniper Zone (AIR 1 - 500)
                            </span>
                            {activeZone === 'sniper' && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Your Zone
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-light">
                            High Speed + High Accuracy. Ideal state! Focus on maintaining exam composure and mock tests.
                        </p>
                    </div>

                    {/* Quadrant 2: Silly Mistake Trap */}
                    <div 
                        onClick={() => setSelectedQuadrant('silly')}
                        className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                            activeZone === 'silly' 
                                ? 'bg-[#332207] border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.01]' 
                                : 'bg-[#241907]/60 border-amber-500/30 opacity-80 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                ⚠️ ⚠️ Silly Mistake Trap
                            </span>
                            {activeZone === 'silly' && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    Your Zone
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-light">
                            High Speed + Low Accuracy. You are rushing through questions. Slow down by 10% to eliminate negative marks.
                        </p>
                    </div>

                    {/* Quadrant 3: Perfectionist Zone */}
                    <div 
                        onClick={() => setSelectedQuadrant('perfectionist')}
                        className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                            activeZone === 'perfectionist' 
                                ? 'bg-[#0f2444] border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-[1.01]' 
                                : 'bg-[#0c1a33]/60 border-blue-500/30 opacity-80 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                📈 ⏳ Perfectionist Zone
                            </span>
                            {activeZone === 'perfectionist' && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                    Your Zone
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-light">
                            Low Speed + High Accuracy. Great accuracy but left paper unattempted. Practice timed 30-sec Rapid Fire rounds.
                        </p>
                    </div>

                    {/* Quadrant 4: Concept Deficit Zone */}
                    <div 
                        onClick={() => setSelectedQuadrant('concept')}
                        className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                            activeZone === 'concept' 
                                ? 'bg-[#331118] border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)] scale-[1.01]' 
                                : 'bg-[#240c12]/60 border-rose-500/30 opacity-80 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-rose-400 flex items-center gap-2">
                                📖 📚 Concept Deficit Zone
                            </span>
                            {activeZone === 'concept' && (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    Your Zone
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-light">
                            Low Speed + Low Accuracy. Concepts need revision. Re-read NCERT Biology & basic Physics formula derivations.
                        </p>
                    </div>
                </div>
            </div>

            {/* CARD 4: NEGATIVE MARKS & LOST POTENTIAL CALCULATOR */}
            <div className="rounded-3xl bg-[#0d1326] border border-white/10 p-5 mb-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <h3 className="text-base font-bold text-white tracking-wide">Negative Marks & Lost Potential Calculator</h3>
                </div>

                <div className="space-y-4 mb-5">
                    {/* Silly Mistakes */}
                    <div>
                        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                            <span className="text-gray-300">Calculation / Misread Error (Silly Mistakes)</span>
                            <span className="text-amber-400 font-bold">-{sillyMistakesLoss} Marks</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#080d1a] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (sillyMistakesLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                        </div>
                    </div>

                    {/* Weak Topics */}
                    <div>
                        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                            <span className="text-gray-300">Unstudied / Weak Topics (Concept Gap)</span>
                            <span className="text-rose-400 font-bold">-{conceptGapLoss} Marks</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#080d1a] rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (conceptGapLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                        </div>
                    </div>

                    {/* Time Running Out */}
                    <div>
                        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                            <span className="text-gray-300">Unattempted due to Time Running Out</span>
                            <span className="text-blue-400 font-bold">-{timeOutLoss} Marks</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#080d1a] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (timeOutLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                        </div>
                    </div>
                </div>

                {/* POTENTIAL MAXIMUM SCORE BOX */}
                <div className="rounded-2xl bg-[#09261c]/90 border border-emerald-500/40 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-emerald-400 mb-0.5">
                            Potential Maximum Score with Zero Silly Mistakes:
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-white leading-none">
                            {potentialMaxScore} <span className="text-sm font-semibold text-emerald-400">/ {totalPossibleMarks}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* STATS QUICK METRICS */}
            <div className="grid grid-cols-4 gap-2 mb-6">
                <div onClick={() => { setFilterType('correct'); setShowReview(true); }} className="bg-[#0d1326] border border-emerald-500/30 p-3 rounded-2xl text-center cursor-pointer hover:bg-emerald-950/30 transition">
                    <div className="font-extrabold text-lg text-emerald-400">{correct}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Correct</div>
                </div>
                <div onClick={() => { setFilterType('incorrect'); setShowReview(true); }} className="bg-[#0d1326] border border-rose-500/30 p-3 rounded-2xl text-center cursor-pointer hover:bg-rose-950/30 transition">
                    <div className="font-extrabold text-lg text-rose-400">{incorrect}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Incorrect</div>
                </div>
                <div onClick={() => { setFilterType('unattempted'); setShowReview(true); }} className="bg-[#0d1326] border border-blue-500/30 p-3 rounded-2xl text-center cursor-pointer hover:bg-blue-950/30 transition">
                    <div className="font-extrabold text-lg text-blue-400">{unattempted}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Unattempted</div>
                </div>
                <div className="bg-[#0d1326] border border-amber-500/30 p-3 rounded-2xl text-center">
                    <div className="font-extrabold text-lg text-amber-400">{timeTakenMin}:{timeTakenSec.toString().padStart(2, '0')}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Time</div>
                </div>
            </div>

            {/* BOTTOM ACTION BUTTONS */}
            <div className="grid grid-cols-3 gap-2.5">
                <button 
                    onClick={() => { setFilterType('all'); setShowReview(true); }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 px-2 rounded-2xl font-bold text-xs active:scale-95 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1"
                >
                    <BookOpen className="w-4 h-4 shrink-0" />
                    Review Qs
                </button>
                <button 
                    onClick={() => setShowAnalysis(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-2 rounded-2xl font-bold text-xs active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1"
                >
                    <Target className="w-4 h-4 shrink-0" />
                    Deep Analysis
                </button>
                <button 
                    onClick={() => setShowTutor(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3.5 px-2 rounded-2xl font-bold text-xs active:scale-95 transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-1"
                >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Ask AI Tutor
                </button>
            </div>
        </div>
    );
}
