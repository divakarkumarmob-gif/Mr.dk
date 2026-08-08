import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Trophy, RefreshCw, X, Sparkles, Flame, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useModalBackButton } from '../utils/hardwareBackButton';

interface MindRefreshGameProps {
    onClose: () => void;
}

interface Orb {
    id: number;
    text: string;
    type: 'bio' | 'chem' | 'phy' | 'bonus';
    x: number; // percentage
    y: number; // percentage
    speed: number;
    points: number;
}

const ORB_TERMS = [
    { text: 'ATP Synthase', type: 'bio', points: 10 },
    { text: 'Krebs Cycle', type: 'bio', points: 10 },
    { text: 'Neuron', type: 'bio', points: 10 },
    { text: 'E = mc²', type: 'phy', points: 15 },
    { text: 'Ohm’s Law', type: 'phy', points: 15 },
    { text: 'PV = nRT', type: 'chem', points: 15 },
    { text: 'Benzene', type: 'chem', points: 10 },
    { text: 'AIIMS 720', type: 'bonus', points: 30 },
    { text: 'DNA Polymerase', type: 'bio', points: 10 },
    { text: 'Optics Focus', type: 'phy', points: 15 },
];

export default function MindRefreshGame({ onClose }: MindRefreshGameProps) {
    useModalBackButton(true, onClose);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(1);
    const [orbs, setOrbs] = useState<Orb[]>([]);
    const [gameTimeLeft, setGameTimeLeft] = useState(60);
    const [isGameOver, setIsGameOver] = useState(false);
    const [poppedCount, setPoppedCount] = useState(0);

    const orbIdCounter = useRef(0);

    // Spawn Orbs Periodically
    useEffect(() => {
        if (isGameOver) return;

        const spawnInterval = setInterval(() => {
            const randomTerm = ORB_TERMS[Math.floor(Math.random() * ORB_TERMS.length)];
            const newOrb: Orb = {
                id: orbIdCounter.current++,
                text: randomTerm.text,
                type: randomTerm.type as any,
                x: Math.floor(Math.random() * 75) + 10, // 10% to 85%
                y: 100, // start from bottom
                speed: Math.random() * 0.4 + 0.3,
                points: randomTerm.points
            };

            setOrbs(prev => [...prev.slice(-8), newOrb]); // Keep max 9 active orbs
        }, 900);

        return () => clearInterval(spawnInterval);
    }, [isGameOver]);

    // Move Orbs Upwards & Game Countdown
    useEffect(() => {
        if (isGameOver) return;

        const moveInterval = setInterval(() => {
            setOrbs(prev => 
                prev
                    .map(orb => ({ ...orb, y: orb.y - orb.speed * 2 }))
                    .filter(orb => orb.y > -10)
            );
        }, 50);

        const timerInterval = setInterval(() => {
            setGameTimeLeft(prev => {
                if (prev <= 1) {
                    setIsGameOver(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(moveInterval);
            clearInterval(timerInterval);
        };
    }, [isGameOver]);

    const poppedIdsRef = useRef<Set<number>>(new Set());

    const handleOrbPop = (e: React.SyntheticEvent, orbId: number, points: number) => {
        if (e) {
            e.stopPropagation();
        }
        if (poppedIdsRef.current.has(orbId)) return;
        poppedIdsRef.current.add(orbId);

        setScore(prev => prev + points * combo);
        setCombo(prev => Math.min(prev + 1, 5));
        setPoppedCount(prev => prev + 1);
        setOrbs(prev => prev.filter(o => o.id !== orbId));
    };

    const restartGame = () => {
        poppedIdsRef.current.clear();
        setScore(0);
        setCombo(1);
        setPoppedCount(0);
        setOrbs([]);
        setGameTimeLeft(60);
        setIsGameOver(false);
    };

    return (
        <div className="fixed inset-0 bg-[#070b19]/95 backdrop-blur-2xl z-[200] flex flex-col items-center justify-between p-4 sm:p-6 text-white select-none overflow-hidden">
            {/* Header / Score Board */}
            <div className="w-full max-w-md flex items-center justify-between bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md">
                <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-bold block">
                        Mind Refresh Score
                    </span>
                    <span className="text-2xl font-black text-white flex items-center gap-1.5 font-mono">
                        <Trophy className="w-5 h-5 text-yellow-400" /> {score}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold font-mono flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> {combo}x Combo
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold font-mono">
                        ⏳ {gameTimeLeft}s
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition ml-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Game Canvas Area */}
            <div className="relative w-full max-w-md flex-1 my-4 bg-slate-950/60 border border-blue-500/20 rounded-3xl overflow-hidden shadow-inner flex flex-col justify-end">
                {!isGameOver ? (
                    <>
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-cyan-300/60 uppercase tracking-widest pointer-events-none">
                            Tap the floating target orbs to refresh your mind!
                        </div>

                        {/* Floating Target Orbs */}
                        <AnimatePresence>
                            {orbs.map(orb => (
                                <motion.button
                                    key={orb.id}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 1.4, opacity: 0 }}
                                    style={{ left: `${orb.x}%`, top: `${orb.y}%` }}
                                    onPointerDown={(e) => handleOrbPop(e, orb.id, orb.points)}
                                    onTouchStart={(e) => handleOrbPop(e, orb.id, orb.points)}
                                    onClick={(e) => handleOrbPop(e, orb.id, orb.points)}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-2xl font-bold text-xs shadow-2xl backdrop-blur-md transition-all active:scale-90 border flex items-center gap-1.5 whitespace-nowrap cursor-pointer touch-none select-none ${
                                        orb.type === 'bio' ? 'bg-emerald-500/35 border-emerald-400/70 text-emerald-100 shadow-emerald-500/30' :
                                        orb.type === 'phy' ? 'bg-blue-500/35 border-blue-400/70 text-blue-100 shadow-blue-500/30' :
                                        orb.type === 'chem' ? 'bg-purple-500/35 border-purple-400/70 text-purple-100 shadow-purple-500/30' :
                                        'bg-yellow-500/40 border-yellow-400/80 text-yellow-100 shadow-yellow-500/40 animate-pulse'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4 pointer-events-none" />
                                    <span className="pointer-events-none">{orb.text}</span>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </>
                ) : (
                    /* Game Over Screen */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 backdrop-blur-xl">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-1">Mind Refreshed! 🧠✨</h3>
                        <p className="text-xs text-gray-400 mb-6">Great job taking a quick focus break while your test results generate!</p>

                        <div className="grid grid-cols-2 gap-3 w-full mb-6">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <span className="text-[10px] text-gray-400 block uppercase font-mono">Final Score</span>
                                <span className="text-xl font-bold text-yellow-400 font-mono">{score}</span>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                                <span className="text-[10px] text-gray-400 block uppercase font-mono">Orbs Popped</span>
                                <span className="text-xl font-bold text-cyan-400 font-mono">{poppedCount}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={restartGame}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" /> Play Again
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition active:scale-95 shadow-lg shadow-blue-500/30"
                            >
                                Back to Wait Screen
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Control Button */}
            <div className="w-full max-w-md">
                <button
                    onClick={onClose}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-2xl text-xs font-bold text-gray-300 transition active:scale-95"
                >
                    Close Game & Return to Wait Screen
                </button>
            </div>
        </div>
    );
}
