import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Bell, BellOff, Plus, Trash2, Clock, Sparkles, BookOpen, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { requestNotificationPermission, scheduleNotification, sendTestNotification, initNotificationChannel } from '../utils/notifications';

export interface CustomSlot {
    id: string;
    startTime: string; // "HH:MM" in 24h format
    endTime: string;   // "HH:MM" in 24h format
    title: string;
    notificationActive: boolean;
    createdAt: number;
    days?: string[];   // e.g. ["Sunday", "Monday", ...]
}

const ALL_DAYS = [
    { key: 'Sunday', label: 'Sunday', short: 'Sun' },
    { key: 'Monday', label: 'Monday', short: 'Mon' },
    { key: 'Tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'Wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'Thursday', label: 'Thursday', short: 'Thu' },
    { key: 'Friday', label: 'Friday', short: 'Fri' },
    { key: 'Saturday', label: 'Saturday', short: 'Sat' },
];

export default function CreateCustomPlanPage({ onBack }: { onBack: () => void }) {
    const [slots, setSlots] = useState<CustomSlot[]>([]);
    const [startTime, setStartTime] = useState<string>('06:00');
    const [endTime, setEndTime] = useState<string>('08:00');
    const [title, setTitle] = useState<string>('');
    const [bellEnabled, setBellEnabled] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    
    // Days selected by default (All 7 days selected by default)
    const [selectedDays, setSelectedDays] = useState<string[]>(
        ALL_DAYS.map(d => d.key)
    );

    // Initialize notification channel on mount & load saved slots
    useEffect(() => {
        initNotificationChannel();
        try {
            const saved = localStorage.getItem('custom_study_plan_slots');
            if (saved) {
                const parsed = JSON.parse(saved);
                setSlots(parsed);
            }
        } catch (e) {
            console.error('Error loading custom study plan slots:', e);
        }
    }, []);

    // Save slots to localStorage when modified
    const saveSlotsToStorage = (updatedSlots: CustomSlot[]) => {
        setSlots(updatedSlots);
        try {
            localStorage.setItem('custom_study_plan_slots', JSON.stringify(updatedSlots));
        } catch (e) {
            console.error('Error saving custom study plan slots:', e);
        }
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(null);
        }, 4000);
    };

    // Toggle individual day selection
    const toggleDay = (dayKey: string) => {
        setSelectedDays(prev =>
            prev.includes(dayKey)
                ? prev.filter(d => d !== dayKey)
                : [...prev, dayKey]
        );
    };

    // Schedule notification timer
    const setupNotificationForSlot = async (slot: CustomSlot, showToastMsg = true) => {
        const hasPermission = await requestNotificationPermission();

        const [hours, minutes] = slot.startTime.split(':').map(Number);
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // If time already passed today, schedule for tomorrow
        if (scheduledTime.getTime() <= now.getTime()) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const numericId = Math.abs(slot.id.split('').reduce((acc, char) => char.charCodeAt(0) + (acc << 5) - acc, 0)) % 2147483647;

        const daysLabel = slot.days && slot.days.length > 0 && slot.days.length < 7
            ? ` (${slot.days.map(d => d.slice(0, 3)).join(', ')})`
            : '';

        await scheduleNotification(
            `🔔 Study Time: ${slot.title || 'Custom Study Session'}`,
            `Time to start your study session (${slot.startTime} - ${slot.endTime})${daysLabel}! Best of luck for NEET! 🎯`,
            numericId,
            scheduledTime
        );

        if (showToastMsg) {
            const formattedTime = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (hasPermission) {
                showToast(`🔔 Notification timer set for ${formattedTime}!`);
            } else {
                showToast(`⚠️ Slot set for ${formattedTime}. Please enable notification permission on your device!`);
            }
        }
    };

    // Test notification handler
    const handleTestNotification = async () => {
        showToast('⏳ Sending test notification...');
        const success = await sendTestNotification();
        if (success) {
            showToast('🔔 Test notification sent! Check your notification bar.');
        } else {
            showToast('⚠️ Could not send notification. Please enable notification permission!');
        }
    };

    // Sync with AI Plan handler
    const handleSyncAIPlan = async () => {
        const allDaysList = ALL_DAYS.map(d => d.key);
        
        // High-yield AI NEET Study Plan timetable slots
        const aiPlanSlots: CustomSlot[] = [
            {
                id: 'ai-slot-1-' + Date.now(),
                startTime: '06:00',
                endTime: '08:30',
                title: '🧬 Bio NCERT Deep Reading & Flashcards',
                notificationActive: true,
                createdAt: Date.now(),
                days: [...allDaysList]
            },
            {
                id: 'ai-slot-2-' + Date.now(),
                startTime: '09:30',
                endTime: '12:30',
                title: '⚡ Physics Concepts & Problem Solving',
                notificationActive: true,
                createdAt: Date.now() + 1,
                days: [...allDaysList]
            },
            {
                id: 'ai-slot-3-' + Date.now(),
                startTime: '14:00',
                endTime: '16:30',
                title: '🧪 Chemistry Organic & Inorganic Practice',
                notificationActive: true,
                createdAt: Date.now() + 2,
                days: [...allDaysList]
            },
            {
                id: 'ai-slot-4-' + Date.now(),
                startTime: '17:00',
                endTime: '19:00',
                title: '🎯 PYQs & NTA Mock Test Practice',
                notificationActive: true,
                createdAt: Date.now() + 3,
                days: [...allDaysList]
            },
            {
                id: 'ai-slot-5-' + Date.now(),
                startTime: '20:30',
                endTime: '22:30',
                title: '📚 Daily Active Recall & Mistakes Review',
                notificationActive: true,
                createdAt: Date.now() + 4,
                days: [...allDaysList]
            }
        ];

        saveSlotsToStorage(aiPlanSlots);

        // Schedule notifications for all AI slots
        for (const slot of aiPlanSlots) {
            await setupNotificationForSlot(slot, false);
        }

        showToast('✨ AI Study Plan synchronized! 5 timetable slots configured automatically.');
    };

    const handleSetSlot = async () => {
        if (!startTime || !endTime) {
            showToast('⚠️ Please select both Start and End time!');
            return;
        }

        const slotTitle = title.trim() || 'Study Session';
        const newSlot: CustomSlot = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            startTime,
            endTime,
            title: slotTitle,
            notificationActive: bellEnabled,
            createdAt: Date.now(),
            days: selectedDays.length > 0 ? selectedDays : ALL_DAYS.map(d => d.key)
        };

        const updated = [newSlot, ...slots];
        saveSlotsToStorage(updated);
        setTitle('');

        if (bellEnabled) {
            await setupNotificationForSlot(newSlot, true);
        } else {
            showToast(`✅ Custom study slot added! (${startTime} to ${endTime})`);
        }
    };

    const handleToggleNotification = async (slotId: string) => {
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;

        const nextState = !slot.notificationActive;
        const updated = slots.map(s => s.id === slotId ? { ...s, notificationActive: nextState } : s);
        saveSlotsToStorage(updated);

        if (nextState) {
            await setupNotificationForSlot({ ...slot, notificationActive: true }, true);
        } else {
            showToast(`🔕 Notification turned off for ${slot.title}`);
        }
    };

    const handleDeleteSlot = (slotId: string) => {
        const updated = slots.filter(s => s.id !== slotId);
        saveSlotsToStorage(updated);
        showToast('🗑️ Slot removed');
    };

    return (
        <div className="min-h-dvh bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] text-white font-sans relative pb-12 pt-[env(safe-area-inset-top,0px)]">
            {/* Header */}
            <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between border-b border-indigo-900/50 backdrop-blur-md sticky top-0 z-30 bg-[#0f172a]/90">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-indigo-200 px-3 py-2 rounded-full transition shadow-sm border border-white/10"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                
                <h1 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-indigo-200 to-indigo-400 tracking-wide">
                    Make Plan
                </h1>

                {/* Upper Right Corner Option: Sync with AI Plan */}
                <button
                    onClick={handleSyncAIPlan}
                    className="flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-amber-400 via-indigo-500 to-purple-600 hover:from-amber-300 hover:to-purple-500 text-white px-3.5 py-2 rounded-full shadow-lg shadow-indigo-500/25 border border-amber-300/40 active:scale-95 transition"
                    title="Automatically sync timetable with AI study plan"
                >
                    <Sparkles className="h-4 w-4 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                    <span className="hidden sm:inline">Sync with AI Plan</span>
                    <span className="sm:hidden">Sync AI</span>
                </button>
            </div>

            {/* Toast Notification Banner */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs sm:text-sm border-2 border-amber-200 text-center max-w-[90vw]"
                    >
                        <span>{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Side / Main Control Box: Set Time, Subject & Days */}
                <div className="md:col-span-6 bg-slate-900/90 border border-indigo-500/30 p-5 sm:p-6 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-wider">
                            <Sparkles className="h-4 w-4" /> Add Time Slot
                        </div>

                        {/* Test Notification Button */}
                        <button
                            onClick={handleTestNotification}
                            className="flex items-center gap-1 text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30 transition"
                            title="Click to test if notification alarm works on your device"
                        >
                            <Zap className="h-3 w-3 text-amber-400" /> Test Alarm
                        </button>
                    </div>

                    <p className="text-xs text-indigo-200/80 mb-5">
                        Select title, choose repeat days, set start/end time and enable the bell icon 🔔 for study alarms.
                    </p>

                    {/* Subject / Task Name Input Box */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-indigo-300 mb-1.5 uppercase tracking-wide">
                            Subject / Activity Title
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Physics - Mechanics / Bio NCERT"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-800/90 border border-indigo-500/30 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition"
                        />
                    </div>

                    {/* Horizontal Days Capsule Pill Row (Below Subject / Title Input Box) */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wide">
                                Repeat Days
                            </label>
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                All selected by default
                            </span>
                        </div>

                        {/* Horizontal Capsules Row */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                            {ALL_DAYS.map((day) => {
                                const isSelected = selectedDays.includes(day.key);
                                return (
                                    <button
                                        key={day.key}
                                        type="button"
                                        onClick={() => toggleDay(day.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition border shrink-0 ${
                                            isSelected
                                                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-950/50'
                                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        {isSelected ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                        ) : (
                                            <div className="h-3.5 w-3.5 rounded-full border border-slate-600 shrink-0" />
                                        )}
                                        <span>{day.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Time Box: | 00:00 | to | 00:00 | | SET | 🔔 */}
                    <div className="bg-slate-950/80 border border-indigo-500/40 p-4 rounded-2xl mb-5 shadow-inner">
                        <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
                            <span>Time Slot Setup</span>
                            <span className="text-amber-400 font-mono">24h format</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Start Time Picker */}
                            <div className="flex-1 min-w-[100px] bg-slate-900 border border-indigo-400/40 rounded-xl p-2 text-center">
                                <span className="block text-[10px] text-slate-400 uppercase font-bold">From</span>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="bg-transparent font-mono text-lg font-bold text-amber-300 w-full text-center focus:outline-none cursor-pointer"
                                />
                            </div>

                            <span className="text-xs font-bold text-slate-400 px-1">to</span>

                            {/* End Time Picker */}
                            <div className="flex-1 min-w-[100px] bg-slate-900 border border-indigo-400/40 rounded-xl p-2 text-center">
                                <span className="block text-[10px] text-slate-400 uppercase font-bold">To</span>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="bg-transparent font-mono text-lg font-bold text-amber-300 w-full text-center focus:outline-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Controls Row: | SET | and 🔔 Bell Icon */}
                        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800">
                            {/* Set Slot Button */}
                            <button
                                onClick={handleSetSlot}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-xl shadow-lg hover:shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-2 text-sm"
                            >
                                <Plus className="h-4 w-4 stroke-[3]" /> Set Slot
                            </button>

                            {/* Bell Icon Toggle */}
                            <button
                                onClick={() => {
                                    const next = !bellEnabled;
                                    setBellEnabled(next);
                                    showToast(next ? '🔔 Notification alarm enabled for new slot' : '🔕 Notification alarm disabled');
                                }}
                                title={bellEnabled ? 'Notification Bell Active (Click to disable)' : 'Notification Bell Disabled (Click to enable)'}
                                className={`p-3 rounded-xl border transition flex items-center justify-center ${
                                    bellEnabled 
                                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10' 
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {bellEnabled ? (
                                    <Bell className="h-5 w-5 fill-amber-400 animate-bounce" />
                                ) : (
                                    <BellOff className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-3 flex items-start gap-2 text-xs text-indigo-200">
                        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>Clicking <strong>Set Slot</strong> with the bell icon 🔔 active schedules an alarm at your study start time.</span>
                    </div>
                </div>

                {/* Right Side: List of Scheduled Custom Plan Slots */}
                <div className="md:col-span-6 flex flex-col">
                    <div className="bg-slate-900/90 border border-indigo-500/30 p-5 sm:p-6 rounded-3xl shadow-2xl backdrop-blur-xl flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Clock className="h-5 w-5 text-indigo-400" />
                                Your Timetable Slots ({slots.length})
                            </h2>
                            {slots.length > 0 && (
                                <span className="text-xs text-indigo-300 font-semibold bg-indigo-900/60 px-2.5 py-1 rounded-full border border-indigo-700/50">
                                    Saved Plan
                                </span>
                            )}
                        </div>

                        {slots.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                                <BookOpen className="h-10 w-10 text-slate-600 mb-3" />
                                <p className="text-sm font-bold text-slate-400 mb-1">No custom slots added yet</p>
                                <p className="text-xs text-slate-500 max-w-xs mb-4">
                                    Use the time box on the left to set your study schedule or click <strong>Sync with AI Plan</strong> in the top right corner!
                                </p>
                                <button
                                    onClick={handleSyncAIPlan}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Sync AI Plan Now
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                                {slots.map((slot) => (
                                    <motion.div
                                        key={slot.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="bg-slate-950/70 border border-indigo-500/20 hover:border-indigo-500/40 p-4 rounded-2xl flex items-center justify-between gap-3 group transition"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center flex-wrap gap-2 mb-1">
                                                <span className="font-mono text-sm font-extrabold text-amber-300 bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                                                    {slot.startTime} - {slot.endTime}
                                                </span>

                                                {/* Days display badge */}
                                                {slot.days && (
                                                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                                        {slot.days.length === 7 ? 'Everyday' : slot.days.map(d => d.slice(0, 3)).join(', ')}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm font-bold text-slate-200 truncate">
                                                {slot.title}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Notification Toggle Button */}
                                            <button
                                                onClick={() => handleToggleNotification(slot.id)}
                                                className={`p-2 rounded-xl border transition ${
                                                    slot.notificationActive
                                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                                                        : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'
                                                }`}
                                                title={slot.notificationActive ? 'Notification Active (Click to mute)' : 'Notification Muted (Click to activate)'}
                                            >
                                                {slot.notificationActive ? (
                                                    <Bell className="h-4 w-4 fill-amber-400" />
                                                ) : (
                                                    <BellOff className="h-4 w-4" />
                                                )}
                                            </button>

                                            {/* Delete Slot Button */}
                                            <button
                                                onClick={() => handleDeleteSlot(slot.id)}
                                                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition"
                                                title="Delete Slot"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
