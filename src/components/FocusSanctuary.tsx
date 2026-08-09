import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Play, Pause, RotateCcw, Volume2, VolumeX, Shield, Users, 
    Flame, Award, Sparkles, X, Music, CloudRain, Disc, Waves, Headphones, CheckCircle2
} from 'lucide-react';
import { scheduleFocusSessionCompleteNotification } from '../utils/studyNotificationEngine';

interface FocusSanctuaryProps {
    onClose: () => void;
    onSessionComplete?: (minutes: number) => void;
}

export default function FocusSanctuary({ onClose, onSessionComplete }: FocusSanctuaryProps) {
    // Timer State
    const [selectedDuration, setSelectedDuration] = useState<number>(25); // minutes
    const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [completedSessions, setCompletedSessions] = useState<number>(0);
    const [totalFocusMinutes, setTotalFocusMinutes] = useState<number>(0);
    const [streakDays, setStreakDays] = useState<number>(3);

    // Live Studying Counter (Simulated real-time WebSocket/Active user counter)
    const [activeUsersCount, setActiveUsersCount] = useState<number>(1420);

    // Audio / Soundscape State
    const [selectedSound, setSelectedSound] = useState<string>('rain'); // 'none' | 'rain' | 'binaural' | 'lofi' | 'waves'
    const [isPlayingSound, setIsPlayingSound] = useState<boolean>(false);
    const [volume, setVolume] = useState<number>(0.5);

    // Audio Web API Synth Refs for seamless offline ambient sound generator
    const audioCtxRef = useRef<AudioContext | null>(null);
    const noiseNodeRef = useRef<AudioNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);

    // Quote Carousel
    const NEET_MOTIVATIONS = [
        "White coat is not just a uniform, it's a responsibility. Stay focused! 🩺",
        "Every 10 minutes of deep study adds 5 marks in NEET! 📚",
        "Future Dr. Saheb, AIIMS New Delhi is waiting for your hard work! 🏛️",
        "Control your focus today, control your AIR tomorrow! 🎯",
        "NCERT ki har ek line ko ratch lo, 720/720 door nahi! ⚡"
    ];
    const [quoteIndex, setQuoteIndex] = useState<number>(0);

    // Dynamic Live Aspirants fluctuation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveUsersCount(prev => prev + Math.floor(Math.random() * 5) - 2);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Motivational quote rotation
    useEffect(() => {
        const quoteInterval = setInterval(() => {
            setQuoteIndex(prev => (prev + 1) % NEET_MOTIVATIONS.length);
        }, 10000);
        return () => clearInterval(quoteInterval);
    }, []);

    // Timer Countdown Logic using Date.now() delta calculation to prevent screen sleep drift
    const endTimeRef = useRef<number | null>(null);

    useEffect(() => {
        let interval: any = null;
        if (isActive) {
            if (!endTimeRef.current) {
                endTimeRef.current = Date.now() + timeLeft * 1000;
            }
            interval = setInterval(() => {
                if (!endTimeRef.current) return;
                const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining === 0) {
                    endTimeRef.current = null;
                    setIsActive(false);
                    stopAmbientSound();
                    setCompletedSessions(prev => prev + 1);
                    const addedMins = selectedDuration;
                    setTotalFocusMinutes(prev => prev + addedMins);
                    scheduleFocusSessionCompleteNotification(addedMins, 'NEET Prep').catch(console.warn);
                    if (onSessionComplete) onSessionComplete(addedMins);
                }
            }, 500);
        } else {
            endTimeRef.current = null;
        }
        return () => clearInterval(interval);
    }, [isActive, selectedDuration, onSessionComplete]);

    // Handle duration selection
    const handleDurationChange = (mins: number) => {
        setSelectedDuration(mins);
        setTimeLeft(mins * 60);
        setIsActive(false);
    };

    // Toggle Timer Start/Pause
    const toggleTimer = () => {
        if (!isActive) {
            setIsActive(true);
            if (selectedSound !== 'none') {
                startAmbientSound(selectedSound);
            }
        } else {
            setIsActive(false);
            stopAmbientSound();
        }
    };

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(selectedDuration * 60);
        stopAmbientSound();
    };

    // Ambient Sound Generator using Web Audio API (Rain, Binaural, Deep Waves, Lofi Pulse)
    const startAmbientSound = (type: string) => {
        stopAmbientSound();
        if (type === 'none') return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(volume, ctx.currentTime);
            masterGain.connect(ctx.destination);
            gainNodeRef.current = masterGain;

            if (type === 'rain' || type === 'waves') {
                // Pink noise generator for rain/ocean waves
                const bufferSize = ctx.sampleRate * 2;
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                    output[i] *= 0.11; // scale down
                    b6 = white * 0.115926;
                }

                const whiteNoise = ctx.createBufferSource();
                whiteNoise.buffer = noiseBuffer;
                whiteNoise.loop = true;

                // Lowpass filter for smooth rain sound
                const filter = ctx.createBiquadFilter();
                filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
                filter.frequency.setValueAtTime(type === 'rain' ? 800 : 400, ctx.currentTime);

                whiteNoise.connect(filter);
                filter.connect(masterGain);
                whiteNoise.start();
                noiseNodeRef.current = whiteNoise;

            } else if (type === 'binaural') {
                // 432 Hz + 440 Hz Alpha Waves for deep concentration
                const oscL = ctx.createOscillator();
                const oscR = ctx.createOscillator();
                
                oscL.type = 'sine';
                oscR.type = 'sine';
                oscL.frequency.setValueAtTime(216, ctx.currentTime); // 432Hz harmonic
                oscR.frequency.setValueAtTime(224, ctx.currentTime); // 8Hz Alpha beat delta

                const gainL = ctx.createGain();
                const gainR = ctx.createGain();
                gainL.gain.setValueAtTime(0.2, ctx.currentTime);
                gainR.gain.setValueAtTime(0.2, ctx.currentTime);

                oscL.connect(gainL);
                oscR.connect(gainR);
                gainL.connect(masterGain);
                gainR.connect(masterGain);

                oscL.start();
                oscR.start();
                oscillatorRef.current = oscL;

            } else if (type === 'lofi') {
                // Soft warm low-frequency pulse
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(110, ctx.currentTime); // A2 note

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(300, ctx.currentTime);

                osc.connect(filter);
                filter.connect(masterGain);
                osc.start();
                oscillatorRef.current = osc;
            }

            setIsPlayingSound(true);
        } catch (e) {
            console.error("Audio synthesis error:", e);
        }
    };

    const stopAmbientSound = () => {
        try {
            if (noiseNodeRef.current) {
                (noiseNodeRef.current as any).stop();
                noiseNodeRef.current = null;
            }
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
                oscillatorRef.current = null;
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
                audioCtxRef.current = null;
            }
        } catch (e) {
            console.error("Stop audio error:", e);
        }
        setIsPlayingSound(false);
    };

    const handleSoundSelect = (soundType: string) => {
        setSelectedSound(soundType);
        if (isActive || soundType !== 'none') {
            startAmbientSound(soundType);
        }
    };

    const handleVolumeChange = (newVol: number) => {
        setVolume(newVol);
        if (gainNodeRef.current && audioCtxRef.current) {
            gainNodeRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
        }
    };

    // Format time (MM:SS)
    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Progress percentage
    const progressPercent = ((selectedDuration * 60 - timeLeft) / (selectedDuration * 60)) * 100;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[3000] bg-[#0a0f24] text-white flex flex-col overflow-y-auto"
        >
            {/* Ambient Background Aura */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-blue-950/20 to-[#0a0f24] pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/15 blur-[120px] rounded-full pointer-events-none animate-pulse" />

            {/* Header Nav */}
            <div className="relative z-10 flex items-center justify-between p-4 border-b border-purple-500/20 max-w-4xl mx-auto w-full backdrop-blur-xl bg-slate-900/60 rounded-b-2xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                        <Shield className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-lg text-white flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">
                            Focus Sanctuary <Sparkles className="w-4 h-4 text-amber-400" />
                        </h1>
                        <p className="text-xs text-purple-300">Zero Distraction NEET Study Zone</p>
                    </div>
                </div>


                {/* Live Aspirants Pill */}
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <Users className="w-3.5 h-3.5" />
                        <span>{activeUsersCount.toLocaleString()} Studying Now</span>
                    </div>

                    <button 
                        onClick={() => {
                            stopAmbientSound();
                            onClose();
                        }}
                        className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Main Interactive Content */}
            <div className="relative z-10 flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-between items-center text-center">

                {/* Live Aspirants Badge for Mobile */}
                <div className="sm:hidden flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold my-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Users className="w-3 h-3" />
                    <span>{activeUsersCount.toLocaleString()} NEET Aspirants Active Now</span>
                </div>

                {/* Quotes Banner */}
                <motion.div 
                    key={quoteIndex}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="my-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-indigo-200/90 font-medium italic max-w-lg"
                >
                    "{NEET_MOTIVATIONS[quoteIndex]}"
                </motion.div>

                {/* Duration Picker Pills */}
                <div className="flex items-center gap-2 sm:gap-3 my-4 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                    {[15, 25, 45, 60].map(mins => (
                        <button
                            key={mins}
                            onClick={() => handleDurationChange(mins)}
                            className={`px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                                selectedDuration === mins
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40 font-bold'
                                    : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {mins} Min Block
                        </button>
                    ))}
                </div>

                {/* Circular Pomodoro Timer */}
                <div className="relative my-6 flex items-center justify-center">
                    <svg className="w-64 h-64 sm:w-80 sm:h-80 -rotate-90">
                        {/* Background Ring */}
                        <circle
                            cx="50%"
                            cy="50%"
                            r="42%"
                            className="stroke-white/10 fill-none"
                            strokeWidth="10"
                        />
                        {/* Animated Progress Ring */}
                        <circle
                            cx="50%"
                            cy="50%"
                            r="42%"
                            className="stroke-indigo-500 fill-none transition-all duration-1000 ease-linear"
                            strokeWidth="10"
                            strokeDasharray={2 * Math.PI * 120}
                            strokeDashoffset={(2 * Math.PI * 120) * (1 - progressPercent / 100)}
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Timer Inside Text */}
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white font-mono drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                            {formatTime(timeLeft)}
                        </span>
                        <span className="mt-2 text-xs sm:text-sm font-semibold tracking-wider uppercase text-indigo-300/80">
                            {isActive ? '🔥 DEEP FOCUS ACTIVE' : 'PAUSED'}
                        </span>
                    </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-4 my-2">
                    <button
                        onClick={resetTimer}
                        className="p-3 sm:p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition"
                        title="Reset Timer"
                    >
                        <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    <button
                        onClick={toggleTimer}
                        className={`px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg flex items-center gap-3 transition-all shadow-xl ${
                            isActive
                                ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-amber-500/25 hover:brightness-110'
                                : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white shadow-indigo-500/30 hover:brightness-110'
                        }`}
                    >
                        {isActive ? (
                            <>
                                <Pause className="w-6 h-6 fill-current" />
                                <span>Pause Session</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-6 h-6 fill-current" />
                                <span>Start Deep Focus</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Ambient Music & Sound Generator Selector */}
                <div className="w-full mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-indigo-300">
                            <Headphones className="w-4 h-4" />
                            <span>Ambient Soundscape Synthesizer</span>
                        </div>
                        {isPlayingSound && (
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                    className="w-20 accent-indigo-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                            { id: 'none', label: 'Mute', icon: VolumeX },
                            { id: 'rain', label: 'Monsoon Rain', icon: CloudRain },
                            { id: 'binaural', label: '432Hz Alpha', icon: Waves },
                            { id: 'lofi', label: 'Lofi Pulse', icon: Music },
                            { id: 'waves', label: 'Deep Waves', icon: Disc }
                        ].map(item => {
                            const IconComponent = item.icon;
                            const isSelected = selectedSound === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSoundSelect(item.id)}
                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition ${
                                        isSelected
                                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                                            : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <IconComponent className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : ''}`} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Session Stats Bar */}
                <div className="w-full grid grid-cols-3 gap-3 my-4">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                            <Flame className="w-4 h-4" />
                            <span className="text-xs font-semibold">Streak</span>
                        </div>
                        <span className="text-lg font-bold text-white">{streakDays} Days</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-semibold">Sessions</span>
                        </div>
                        <span className="text-lg font-bold text-white">{completedSessions} Done</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                            <Award className="w-4 h-4" />
                            <span className="text-xs font-semibold">Total Time</span>
                        </div>
                        <span className="text-lg font-bold text-white">{totalFocusMinutes} Mins</span>
                    </div>
                </div>

            </div>
        </motion.div>
    );
}
