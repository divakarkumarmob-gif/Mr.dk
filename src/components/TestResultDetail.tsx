import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Share2, Award, Zap, AlertTriangle, CheckCircle2, BookOpen, Clock, Target, Sparkles, ChevronRight, BarChart3, Bot, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { shareResult } from '../utils/share';
import TestReview from './TestReview';
import TestAnalysis from './TestAnalysis';
import TestTutor from './TestTutor';
import { toPng } from 'html-to-image';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { enableScreenshot, disableScreenshot } from '../utils/screenSecurity';
import { useModalBackButton } from '../utils/hardwareBackButton';

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

    useModalBackButton(showReview, () => setShowReview(false));
    useModalBackButton(showAnalysis, () => setShowAnalysis(false));
    useModalBackButton(showTutor, () => setShowTutor(false));
    useModalBackButton(true, onBack);

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
    const sillyMistakesLoss = incorrect * 5;
    const conceptGapLoss = Math.round(unattempted * 2.5);
    const timeOutLoss = Math.max(0, (unattempted * 4) - conceptGapLoss);

    const potentialMaxScore = Math.min(totalPossibleMarks, obtainedMarks + sillyMistakesLoss);

    // Quadrant Matrix matching logic
    let autoZone = 'sniper';
    if (accuracy >= 80 && speed >= 60) autoZone = 'sniper';
    else if (accuracy < 80 && speed >= 60) autoZone = 'silly';
    else if (accuracy >= 80 && speed < 60) autoZone = 'perfectionist';
    else autoZone = 'concept';

    const activeZone = selectedQuadrant || autoZone;

    return (
        <div ref={contentRef} className="min-h-dvh bg-[#0a0f24] text-white p-4 pb-36 overflow-y-auto selection:bg-purple-500/30" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
            
            {/* Superior Header */}
            <motion.header 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center mb-5 px-1 max-w-xl mx-auto"
            >
                <button onClick={onBack} className="p-2.5 bg-slate-900/80 border border-purple-500/30 rounded-full hover:bg-slate-800 transition active:scale-90 text-purple-300 hover:text-white cursor-pointer shadow-md">
                    <ArrowLeft className="w-5 h-5 text-purple-300" />
                </button>
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h1 className="text-base font-black tracking-tight text-white">Scorecard & Rank Analysis</h1>
                </div>
                <button onClick={handleShare} className="p-2.5 bg-slate-900/80 border border-purple-500/30 rounded-full hover:bg-slate-800 transition active:scale-90 text-purple-300 hover:text-white cursor-pointer shadow-md" title="Share Scorecard">
                    <Share2 className="w-5 h-5 text-purple-300" />
                </button>
            </motion.header>

            <div className="max-w-xl mx-auto space-y-5">

                {/* CARD 1: ESTIMATED NEET AIR PREDICTION BANNER */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl glass-card border border-purple-500/30 p-5 sm:p-6 shadow-[0_0_35px_rgba(139,92,246,0.3)] backdrop-blur-2xl"
                >
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            ESTIMATED NEET AIR PREDICTION
                        </span>
                    </div>

                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1.5 drop-shadow-md">
                                {prediction.rankRange}
                            </h2>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                                <span>{prediction.chanceText}</span>
                            </div>
                        </div>

                        {/* TOTAL SCORE BOX */}
                        <div className="bg-slate-900/80 border border-purple-500/30 backdrop-blur-xl rounded-2xl px-5 py-3 text-center min-w-[120px] shadow-2xl shrink-0">
                            <p className="text-[9px] text-purple-300/80 font-bold tracking-widest uppercase mb-0.5">TOTAL SCORE</p>
                            <p className="text-3xl font-black text-emerald-400 leading-none mb-1">
                                {obtainedMarks}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">out of {totalPossibleMarks}</p>
                        </div>
                    </div>
                </motion.div>

                {/* CARD 2: INTERACTIVE SUBJECT SCORE BREAKDOWN */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="rounded-3xl glass-card border border-purple-500/25 p-5 shadow-2xl backdrop-blur-xl"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-purple-400" />
                        <h3 className="text-sm font-black text-white tracking-tight">Interactive Subject Score Breakdown</h3>
                    </div>

                    <div className="space-y-3.5">
                        {/* Physics */}
                        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 backdrop-blur-md">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-blue-400">Physics</span>
                                <span className="text-xs font-black text-white">
                                    {subjects.physics.obtained} <span className="text-slate-400 font-normal">/ {subjects.physics.max}</span>
                                </span>
                            </div>
                            <div className="relative w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
                                    style={{ width: `${subjects.physics.max > 0 ? Math.min(100, Math.max(0, (subjects.physics.obtained / subjects.physics.max) * 100)) : 0}%` }}
                                />
                            </div>
                        </div>

                        {/* Chemistry */}
                        <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl p-4 backdrop-blur-md">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-purple-300">Chemistry</span>
                                <span className="text-xs font-black text-white">
                                    {subjects.chemistry.obtained} <span className="text-slate-400 font-normal">/ {subjects.chemistry.max}</span>
                                </span>
                            </div>
                            <div className="relative w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-600 to-pink-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(236,72,153,0.6)]" 
                                    style={{ width: `${subjects.chemistry.max > 0 ? Math.min(100, Math.max(0, (subjects.chemistry.obtained / subjects.chemistry.max) * 100)) : 0}%` }}
                                />
                            </div>
                        </div>


                        {/* Biology */}
                        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 backdrop-blur-md">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-emerald-400">Biology</span>
                                <span className="text-xs font-black text-white">
                                    {subjects.biology.obtained} <span className="text-gray-400 font-normal">/ {subjects.biology.max}</span>
                                </span>
                            </div>
                            <div className="relative w-full h-2.5 bg-black/40 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(34,197,94,0.6)]" 
                                    style={{ width: `${subjects.biology.max > 0 ? Math.min(100, Math.max(0, (subjects.biology.obtained / subjects.biology.max) * 100)) : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* CARD 3: SPEED VS ACCURACY QUADRANT MATRIX */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-3xl glass-card border border-purple-500/25 p-5 shadow-2xl backdrop-blur-xl"
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-400" />
                            <h3 className="text-sm font-black text-white tracking-tight">Speed vs Accuracy Matrix</h3>
                        </div>
                        <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider">Tap to inspect</span>
                    </div>

                    <div className="space-y-2.5">
                        {/* Quadrant 1: Sniper Zone */}
                        <div 
                            onClick={() => setSelectedQuadrant('sniper')}
                            className={`rounded-2xl p-3.5 border transition-all cursor-pointer ${
                                activeZone === 'sniper' 
                                    ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.01]' 
                                    : 'bg-slate-900/60 border-emerald-500/30 opacity-80 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-extrabold text-emerald-400">
                                    🎯 Sniper Zone (AIR 1 - 500)
                                </span>
                                {activeZone === 'sniper' && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        Your Zone
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                High Speed + High Accuracy. Ideal state! Maintain mock test rhythm.
                            </p>
                        </div>

                        {/* Quadrant 2: Silly Mistake Trap */}
                        <div 
                            onClick={() => setSelectedQuadrant('silly')}
                            className={`rounded-2xl p-3.5 border transition-all cursor-pointer ${
                                activeZone === 'silly' 
                                    ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.01]' 
                                    : 'bg-slate-900/60 border-amber-500/30 opacity-80 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-extrabold text-amber-400">
                                    ⚠️ Silly Mistake Trap
                                </span>
                                {activeZone === 'silly' && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        Your Zone
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                High Speed + Low Accuracy. Slow down by 10% to eliminate negative marks.
                            </p>
                        </div>

                        {/* Quadrant 3: Perfectionist Zone */}
                        <div 
                            onClick={() => setSelectedQuadrant('perfectionist')}
                            className={`rounded-2xl p-3.5 border transition-all cursor-pointer ${
                                activeZone === 'perfectionist' 
                                    ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-[1.01]' 
                                    : 'bg-slate-900/60 border-purple-500/30 opacity-80 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-extrabold text-purple-300">
                                    📈 Perfectionist Zone
                                </span>
                                {activeZone === 'perfectionist' && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                        Your Zone
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Low Speed + High Accuracy. Practice timed 30-sec Rapid Fire rounds.
                            </p>
                        </div>

                        {/* Quadrant 4: Concept Deficit Zone */}
                        <div 
                            onClick={() => setSelectedQuadrant('concept')}
                            className={`rounded-2xl p-3.5 border transition-all cursor-pointer ${
                                activeZone === 'concept' 
                                    ? 'bg-rose-500/20 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] scale-[1.01]' 
                                    : 'bg-slate-900/60 border-rose-500/30 opacity-80 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-extrabold text-rose-400">
                                    📖 Concept Deficit Zone
                                </span>
                                {activeZone === 'concept' && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        Your Zone
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Low Speed + Low Accuracy. Re-read NCERT Biology & Physics derivations.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* CARD 4: NEGATIVE MARKS & LOST POTENTIAL CALCULATOR */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-3xl glass-card border border-purple-500/25 p-5 shadow-2xl backdrop-blur-xl"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <h3 className="text-sm font-black text-white tracking-tight">Negative Marks & Lost Potential Calculator</h3>
                    </div>

                    <div className="space-y-3.5 mb-5">
                        {/* Silly Mistakes */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold mb-1">
                                <span className="text-slate-300">Silly Mistakes (Incorrect Ans)</span>
                                <span className="text-amber-400">-{sillyMistakesLoss} Marks</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (sillyMistakesLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                            </div>
                        </div>

                        {/* Weak Topics */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold mb-1">
                                <span className="text-slate-300">Concept Gap (Unstudied Topics)</span>
                                <span className="text-rose-400">-{conceptGapLoss} Marks</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (conceptGapLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                            </div>
                        </div>

                        {/* Time Running Out */}
                        <div>
                            <div className="flex justify-between items-center text-xs font-bold mb-1">
                                <span className="text-slate-300">Time Running Out</span>
                                <span className="text-blue-400">-{timeOutLoss} Marks</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (timeOutLoss / (totalPossibleMarks || 720)) * 500))}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* POTENTIAL MAXIMUM SCORE BOX */}
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center justify-between backdrop-blur-md">
                        <div>
                            <p className="text-xs font-extrabold text-emerald-400">
                                Potential Score (0 Silly Mistakes):
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-2xl font-black text-white leading-none">
                                {potentialMaxScore} <span className="text-xs font-bold text-emerald-400">/ {totalPossibleMarks}</span>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* STATS QUICK METRICS */}
                <div className="grid grid-cols-4 gap-2.5">
                    <motion.div whileHover={{ scale: 1.05 }} onClick={() => { setFilterType('correct'); setShowReview(true); }} className="glass-card border border-emerald-500/30 p-3 rounded-2xl text-center cursor-pointer backdrop-blur-md transition">
                        <div className="font-black text-lg text-emerald-400">{correct}</div>
                        <div className="text-[9px] text-slate-300 uppercase font-extrabold">Correct</div>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} onClick={() => { setFilterType('incorrect'); setShowReview(true); }} className="glass-card border border-rose-500/30 p-3 rounded-2xl text-center cursor-pointer backdrop-blur-md transition">
                        <div className="font-black text-lg text-rose-400">{incorrect}</div>
                        <div className="text-[9px] text-slate-300 uppercase font-extrabold">Incorrect</div>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} onClick={() => { setFilterType('unattempted'); setShowReview(true); }} className="glass-card border border-blue-500/30 p-3 rounded-2xl text-center cursor-pointer backdrop-blur-md transition">
                        <div className="font-black text-lg text-blue-400">{unattempted}</div>
                        <div className="text-[9px] text-slate-300 uppercase font-extrabold">Left</div>
                    </motion.div>
                    <div className="glass-card border border-amber-500/30 p-3 rounded-2xl text-center backdrop-blur-md">
                        <div className="font-black text-lg text-amber-400">{timeTakenMin}:{timeTakenSec.toString().padStart(2, '0')}</div>
                        <div className="text-[9px] text-slate-300 uppercase font-extrabold">Time</div>
                    </div>
                </div>

                {/* DISCUSS WITH AI LIVE BUTTON */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <button 
                        onClick={() => {
                            const payload = {
                                testName: result?.testName || result?.title || 'NEET Practice Test',
                                obtainedMarks: result?.obtainedMarks ?? result?.score ?? 0,
                                totalPossibleMarks: result?.totalPossibleMarks ?? (result?.totalQuestions ? result.totalQuestions * 4 : 720),
                                accuracy: result?.accuracy ?? 0,
                                correct: result?.correct ?? 0,
                                incorrect: result?.incorrect ?? 0,
                                unattempted: result?.unattempted ?? 0,
                                topicAnalysis: result?.topicAnalysis || [],
                                timestamp: new Date().toISOString(),
                            };
                            try {
                                localStorage.setItem('pendingTestResultContext', JSON.stringify(payload));
                            } catch { /* ignore */ }
                            window.dispatchEvent(new CustomEvent('open-live-ai-with-test', { detail: payload }));
                            window.dispatchEvent(new CustomEvent('open-ai-live-voice', { detail: payload }));
                        }}
                        className="w-full gradient-btn-primary text-white py-4 px-4 rounded-2xl font-black text-xs shadow-[0_0_25px_rgba(139,92,246,0.35)] flex items-center justify-center gap-2.5 transition-all border border-purple-400/40 cursor-pointer"
                    >
                        <span className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                        </span>
                        Discuss this Test with AI Live 🎙️
                    </button>
                </motion.div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="grid grid-cols-3 gap-2.5">
                    <button 
                        onClick={() => { setFilterType('all'); setShowReview(true); }}
                        className="gradient-btn-secondary text-white py-3.5 px-2 rounded-2xl font-extrabold text-xs active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <BookOpen className="w-4 h-4 shrink-0" />
                        Review Qs
                    </button>
                    <button 
                        onClick={() => setShowAnalysis(true)}
                        className="gradient-btn-primary text-white py-3.5 px-2 rounded-2xl font-extrabold text-xs active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <Target className="w-4 h-4 shrink-0" />
                        Deep Analysis
                    </button>
                    <button 
                        onClick={() => setShowTutor(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3.5 px-2 rounded-2xl font-extrabold text-xs active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        Ask AI Tutor
                    </button>
                </div>

            </div>
        </div>
    );
}
