/**
 * NCERT Revision Planner & Daily Target Widget
 * Calculates 3 daily NCERT targets based on student's weak topics and silly mistakes.
 * Provides 1-click 5-minute revision drills with instant AI grading.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Zap, CheckCircle2, RefreshCw, Sparkles, BookOpen, ChevronRight, Award } from 'lucide-react';
import { getUserPerformanceSummary, UserPerformanceSummary } from '../services/userPerformanceService';
import { auth } from '../lib/firebase';
import { chatWithAI } from '../services/geminiService';
import { showToast } from '../utils/toast';

export interface RevisionTarget {
    id: string;
    subject: 'Physics' | 'Chemistry' | 'Biology';
    topicName: string;
    targetDescription: string;
    completed: boolean;
}

export default function NCERTRevisionPlanner() {
    const [performance, setPerformance] = useState<UserPerformanceSummary | null>(null);
    const [targets, setTargets] = useState<RevisionTarget[]>([]);
    const [activeDrill, setActiveDrill] = useState<RevisionTarget | null>(null);
    const [drillQuestion, setDrillQuestion] = useState<string>('');
    const [userAnswer, setUserAnswer] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isGrading, setIsGrading] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    useEffect(() => {
        loadPerformanceAndTargets();
    }, []);

    const loadPerformanceAndTargets = async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const perf = await getUserPerformanceSummary(currentUser.uid);
            setPerformance(perf);
            generateDailyTargets(perf);
        } else {
            generateDailyTargets(null);
        }
    };

    const generateDailyTargets = (perf: UserPerformanceSummary | null) => {
        const weak = perf?.weakTopics || [];
        
        const defaultPhysics = weak.find(t => t.toLowerCase().includes('optic') || t.toLowerCase().includes('motion')) || 'Optics Sign Convention';
        const defaultChem = weak.find(t => t.toLowerCase().includes('organic') || t.toLowerCase().includes('bond')) || 'Organic Reaction Mechanisms';
        const defaultBio = weak.find(t => t.toLowerCase().includes('photo') || t.toLowerCase().includes('genetic')) || 'Photosynthesis C3 vs C4 Pathways';

        const savedDate = localStorage.getItem('ncert_revision_date');
        const todayStr = new Date().toDateString();
        const savedTargets = localStorage.getItem('ncert_revision_targets');

        if (savedDate === todayStr && savedTargets) {
            try {
                setTargets(JSON.parse(savedTargets));
                return;
            } catch (e) {}
        }

        const newTargets: RevisionTarget[] = [
            {
                id: 'target_phy_' + Date.now(),
                subject: 'Physics',
                topicName: defaultPhysics,
                targetDescription: 'Review sign conventions and key formula derivations',
                completed: false
            },
            {
                id: 'target_chem_' + Date.now(),
                subject: 'Chemistry',
                topicName: defaultChem,
                targetDescription: 'Practice SN1 vs SN2 reaction mechanism rules',
                completed: false
            },
            {
                id: 'target_bio_' + Date.now(),
                subject: 'Biology',
                topicName: defaultBio,
                targetDescription: 'Master Kranz anatomy & PEP carboxylase locations',
                completed: false
            }
        ];

        setTargets(newTargets);
        localStorage.setItem('ncert_revision_date', todayStr);
        localStorage.setItem('ncert_revision_targets', JSON.stringify(newTargets));
    };

    const startRevisionDrill = async (target: RevisionTarget) => {
        setActiveDrill(target);
        setDrillQuestion('');
        setUserAnswer('');
        setFeedback(null);
        setIsGenerating(true);

        try {
            const prompt = `Act as an expert NEET mentor. Generate 1 high-yield NCERT practice question for ${target.subject}: "${target.topicName}". Keep it concise and focused on high-yield NCERT points. Do not give the answer yet.`;
            const q = await chatWithAI([], prompt);
            setDrillQuestion(q);
        } catch (e) {
            setDrillQuestion(`Quick NCERT Question (${target.topicName}): Explain the key concept and formula rule in 2-3 lines.`);
        } finally {
            setIsGenerating(false);
        }
    };

    const submitDrillAnswer = async () => {
        if (!userAnswer.trim()) {
            showToast('Please type your answer first!');
            return;
        }
        setIsGrading(true);
        try {
            const prompt = `Grade this NEET student's answer strictly based on NCERT rules.\nQuestion: ${drillQuestion}\nStudent Answer: ${userAnswer}\nGive constructive feedback in 2 short sentences in Hinglish. State if it is correct or needs revision.`;
            const fb = await chatWithAI([], prompt);
            setFeedback(fb);

            // Mark target as completed
            const updated = targets.map(t => t.id === activeDrill?.id ? { ...t, completed: true } : t);
            setTargets(updated);
            localStorage.setItem('ncert_revision_targets', JSON.stringify(updated));
        } catch (e) {
            setFeedback('Shabash! Apka response submitted ho gaya hai. NCERT formula ko zaroor revise kar lijiye.');
        } finally {
            setIsGrading(false);
        }
    };

    const completedCount = targets.filter(t => t.completed).length;

    return (
        <div className="bg-[#0b1226] border border-blue-500/20 rounded-3xl p-5 shadow-xl text-white mb-6">
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-base tracking-wide flex items-center gap-2">
                            Daily NCERT Revision Targets
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">AI Powered</span>
                        </h3>
                        <p className="text-xs text-gray-400">Personalized based on your weak topics & silly mistakes</p>
                    </div>
                </div>
                
                <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                        {completedCount} / {targets.length} Done
                    </span>
                </div>
            </div>

            {/* Target Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {targets.map(target => (
                    <motion.div
                        key={target.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startRevisionDrill(target)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                            target.completed
                                ? 'bg-emerald-950/30 border-emerald-500/40'
                                : 'bg-[#121b35] border-white/10 hover:border-blue-500/40'
                        }`}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                                    target.subject === 'Physics' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                    target.subject === 'Chemistry' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}>
                                    {target.subject}
                                </span>
                                {target.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                            <h4 className="font-bold text-sm text-white mb-1 line-clamp-1">{target.topicName}</h4>
                            <p className="text-xs text-gray-400 line-clamp-2">{target.targetDescription}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-blue-400 font-semibold flex items-center gap-1">
                                <Zap className="w-3 h-3" /> 5-Min Drill
                            </span>
                            <span className="text-gray-400 font-medium">Tap to start →</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Revision Drill Modal */}
            <AnimatePresence>
                {activeDrill && (
                    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setActiveDrill(null)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0f172a] border border-blue-500/30 rounded-3xl p-6 max-w-lg w-full text-white shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div>
                                    <span className="text-xs text-blue-400 font-bold uppercase">{activeDrill.subject} NCERT Drill</span>
                                    <h3 className="font-bold text-lg text-white">{activeDrill.topicName}</h3>
                                </div>
                                <button onClick={() => setActiveDrill(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-gray-300">✕</button>
                            </div>

                            {isGenerating ? (
                                <div className="py-8 text-center space-y-2">
                                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                                    <p className="text-sm text-gray-300 font-medium">Generating high-yield NCERT drill question...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-[#1e293b] border border-white/10 text-sm text-gray-200 leading-relaxed font-medium">
                                        {drillQuestion}
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 font-semibold">Your Answer / NCERT Explanation:</label>
                                        <textarea
                                            value={userAnswer}
                                            onChange={e => setUserAnswer(e.target.value)}
                                            rows={3}
                                            placeholder="Write your explanation or answer steps here..."
                                            className="w-full bg-[#0b1226] border border-white/20 rounded-2xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    {feedback && (
                                        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs leading-relaxed font-medium">
                                            <p className="font-bold mb-1 flex items-center gap-1 text-emerald-400">
                                                <Sparkles className="w-4 h-4" /> AI Mentor Feedback:
                                            </p>
                                            {feedback}
                                        </div>
                                    )}

                                    <div className="flex gap-2 justify-end pt-2">
                                        <button
                                            onClick={submitDrillAnswer}
                                            disabled={isGrading}
                                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {isGrading ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" /> Grading with NCERT Rules...
                                                </>
                                            ) : (
                                                <>
                                                    Submit & Grade Answer
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
