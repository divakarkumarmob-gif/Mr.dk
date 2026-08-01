import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Trophy, Target, Zap, AlertTriangle, CheckCircle2, TrendingUp, 
    BarChart3, Award, Sparkles, X, ChevronRight, HelpCircle, BookOpen, Layers
} from 'lucide-react';

interface RankPredictorMatrixProps {
    onClose: () => void;
    userTestResults?: any[];
}

export default function RankPredictorMatrix({ onClose, userTestResults = [] }: RankPredictorMatrixProps) {
    // Score Slider States
    const [physicsScore, setPhysicsScore] = useState<number>(150);
    const [chemistryScore, setChemistryScore] = useState<number>(155);
    const [biologyScore, setBiologyScore] = useState<number>(340);

    const totalScore = physicsScore + chemistryScore + biologyScore;

    // Rank Prediction Algorithm (Calibrated to recent NTA NEET trends)
    const predictAIR = (score: number) => {
        if (score >= 715) return { min: 1, max: 10, gmcProbability: '100% Guaranteed AIIMS New Delhi' };
        if (score >= 700) return { min: 11, max: 150, gmcProbability: 'Top 5 National GMCs' };
        if (score >= 680) return { min: 151, max: 1200, gmcProbability: 'Top State Medical Colleges' };
        if (score >= 650) return { min: 1201, max: 5500, gmcProbability: 'Assured Government MBBS Seat' };
        if (score >= 620) return { min: 5501, max: 14000, gmcProbability: 'High Chance for State Quota GMC' };
        if (score >= 580) return { min: 14001, max: 32000, gmcProbability: 'Borderline State GMC / BDS / BAMS' };
        if (score >= 500) return { min: 32001, max: 95000, gmcProbability: 'Private Medical / BDS / BHMS' };
        return { min: 95001, max: 300000, gmcProbability: 'Qualifying Cutoff Zone - Heavy Push Needed' };
    };

    const airData = predictAIR(totalScore);

    // Speed vs Accuracy Matrix Position
    const [accuracyLevel, setAccuracyLevel] = useState<'high' | 'low'>('high');
    const [speedLevel, setSpeedLevel] = useState<'high' | 'low'>('high');

    // Lost Marks Breakdown State
    const [sillyMistakeMarks, setSillyMistakeMarks] = useState<number>(20);
    const [conceptGapMarks, setConceptGapMarks] = useState<number>(35);
    const [timePressureMarks, setTimePressureMarks] = useState<number>(15);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[3000] bg-[#070b14] text-white flex flex-col overflow-y-auto"
        >
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/10 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white flex items-center gap-2">
                            AIR Rank Predictor & Matrix <Sparkles className="w-4 h-4 text-amber-400" />
                        </h1>
                        <p className="text-xs text-white/50">NTA Trend-Based Performance & Rank Engine</p>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Main Scrollable Content */}
            <div className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">

                {/* AIR Rank Hero Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 text-indigo-500/10 pointer-events-none">
                        <Trophy className="w-48 h-48 -mr-10 -mt-10" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
                                Estimated NEET 2026 Prediction
                            </span>
                            <div className="mt-3 flex items-baseline gap-3">
                                <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                                    AIR {airData.min.toLocaleString()} - {airData.max.toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-2 text-sm text-indigo-200 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>{airData.gmcProbability}</span>
                            </p>
                        </div>

                        {/* Total Score Badge */}
                        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/10 border border-white/15 min-w-[140px]">
                            <span className="text-xs text-white/60 font-semibold uppercase">Total Score</span>
                            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                                {totalScore}
                            </span>
                            <span className="text-xs text-white/40 font-medium">out of 720</span>
                        </div>
                    </div>
                </div>

                {/* Score Sliders Section */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        <span>Interactive Subject Score Breakdown</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Physics Slider */}
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                            <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-blue-300">Physics</span>
                                <span className="text-white font-bold">{physicsScore} / 180</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="180" 
                                step="5"
                                value={physicsScore}
                                onChange={(e) => setPhysicsScore(parseInt(e.target.value))}
                                className="w-full accent-blue-500 cursor-pointer h-2 rounded-lg bg-blue-950"
                            />
                        </div>

                        {/* Chemistry Slider */}
                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                            <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-orange-300">Chemistry</span>
                                <span className="text-white font-bold">{chemistryScore} / 180</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="180" 
                                step="5"
                                value={chemistryScore}
                                onChange={(e) => setChemistryScore(parseInt(e.target.value))}
                                className="w-full accent-orange-500 cursor-pointer h-2 rounded-lg bg-orange-950"
                            />
                        </div>

                        {/* Biology Slider */}
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                            <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-emerald-300">Biology</span>
                                <span className="text-white font-bold">{biologyScore} / 360</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="360" 
                                step="5"
                                value={biologyScore}
                                onChange={(e) => setBiologyScore(parseInt(e.target.value))}
                                className="w-full accent-emerald-500 cursor-pointer h-2 rounded-lg bg-emerald-950"
                            />
                        </div>
                    </div>
                </div>

                {/* Speed vs Accuracy Matrix (4-Quadrant Grid) */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-400" />
                            <span>Speed vs Accuracy Quadrant Matrix</span>
                        </h2>
                        <span className="text-xs text-white/50">Select your typical test pattern</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Q1: High Speed + High Accuracy */}
                        <div 
                            onClick={() => { setSpeedLevel('high'); setAccuracyLevel('high'); }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                speedLevel === 'high' && accuracyLevel === 'high'
                                    ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                    : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                                <Target className="w-4 h-4" />
                                <span>🎯 Sniper Zone (AIR 1 - 500)</span>
                            </div>
                            <p className="text-xs text-white/70">
                                High Speed + High Accuracy. Ideal state! Focus on maintaining exam composure and mock tests.
                            </p>
                        </div>

                        {/* Q2: High Speed + Low Accuracy */}
                        <div 
                            onClick={() => { setSpeedLevel('high'); setAccuracyLevel('low'); }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                speedLevel === 'high' && accuracyLevel === 'low'
                                    ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10'
                                    : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                <span>⚠️ Silly Mistake Trap</span>
                            </div>
                            <p className="text-xs text-white/70">
                                High Speed + Low Accuracy. You are rushing through questions. Slow down by 10% to eliminate negative marks.
                            </p>
                        </div>

                        {/* Q3: Low Speed + High Accuracy */}
                        <div 
                            onClick={() => { setSpeedLevel('low'); setAccuracyLevel('high'); }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                speedLevel === 'low' && accuracyLevel === 'high'
                                    ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/10'
                                    : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span>⏳ Perfectionist Zone</span>
                            </div>
                            <p className="text-xs text-white/70">
                                Low Speed + High Accuracy. Great accuracy but left paper unattempted. Practice timed 30-sec Rapid Fire rounds.
                            </p>
                        </div>

                        {/* Q4: Low Speed + Low Accuracy */}
                        <div 
                            onClick={() => { setSpeedLevel('low'); setAccuracyLevel('low'); }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                speedLevel === 'low' && accuracyLevel === 'low'
                                    ? 'bg-red-500/20 border-red-500 shadow-lg shadow-red-500/10'
                                    : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-1">
                                <BookOpen className="w-4 h-4" />
                                <span>📚 Concept Deficit Zone</span>
                            </div>
                            <p className="text-xs text-white/70">
                                Low Speed + Low Accuracy. Concepts need revision. Re-read NCERT Biology & basic Physics formula derivations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Lost Marks Breakdown Analyzer */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <span>Negative Marks & Lost Potential Calculator</span>
                    </h2>

                    <div className="space-y-3">
                        {/* Silly Mistakes */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                                <span>Calculation / Misread Error (Silly Mistakes)</span>
                                <span className="text-amber-400">-{sillyMistakeMarks} Marks</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(sillyMistakeMarks / 100) * 100}%` }} />
                            </div>
                        </div>

                        {/* Concept Gap */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                                <span>Unstudied / Weak Topics (Concept Gap)</span>
                                <span className="text-red-400">-{conceptGapMarks} Marks</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div className="bg-red-400 h-full rounded-full" style={{ width: `${(conceptGapMarks / 100) * 100}%` }} />
                            </div>
                        </div>

                        {/* Time Pressure */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                                <span>Unattempted due to Time Running Out</span>
                                <span className="text-blue-400">-{timePressureMarks} Marks</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-400 h-full rounded-full" style={{ width: `${(timePressureMarks / 100) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between">
                        <span>Potential Maximum Score with Zero Silly Mistakes:</span>
                        <span className="font-bold text-sm text-white">
                            {Math.min(720, totalScore + sillyMistakeMarks + timePressureMarks)} / 720
                        </span>
                    </div>
                </div>

            </div>
        </motion.div>
    );
}
