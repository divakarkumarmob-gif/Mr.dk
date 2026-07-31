import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Bell, BellOff, Plus, Trash2, Clock, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { requestNotificationPermission, scheduleNotification } from '../utils/notifications';

interface CustomSlot {
    id: string;
    startTime: string; // "HH:MM" in 24h format
    endTime: string;   // "HH:MM" in 24h format
    title: string;
    notificationActive: boolean;
    createdAt: number;
}

export default function CreateCustomPlanPage({ onBack }: { onBack: () => void }) {
    const [slots, setSlots] = useState<CustomSlot[]>([]);
    const [startTime, setStartTime] = useState<string>('06:00');
    const [endTime, setEndTime] = useState<string>('08:00');
    const [title, setTitle] = useState<string>('');
    const [bellEnabled, setBellEnabled] = useState<boolean>(true);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Load saved slots from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('custom_study_plan_slots');
            if (saved) {
                setSlots(JSON.parse(saved));
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
        }, 3500);
    };

    // Schedule notification timer
    const setupNotificationForSlot = async (slot: CustomSlot) => {
        await requestNotificationPermission();

        // Calculate target date/time for notification
        const [hours, minutes] = slot.startTime.split(':').map(Number);
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // If time already passed today, schedule for tomorrow
        if (scheduledTime.getTime() <= now.getTime()) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const numericId = Math.abs(slot.id.split('').reduce((acc, char) => char.charCodeAt(0) + (acc << 5) - acc, 0)) % 2147483647;

        // Schedule native notification
        await scheduleNotification(
            `🔔 Study Time Reminder: ${slot.title || 'Custom Study Session'}`,
            `Time to start your study session (${slot.startTime} to ${slot.endTime})! Best of luck for NEET! 🎯`,
            numericId,
            scheduledTime
        );

        // Web Notification setup (fallback for Web browsers)
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                const msUntilTime = scheduledTime.getTime() - new Date().getTime();
                if (msUntilTime > 0 && msUntilTime < 2147483647) {
                    setTimeout(() => {
                        try {
                            new Notification(`🔔 Study Reminder: ${slot.title || 'Custom Study Session'}`, {
                                body: `Your study slot (${slot.startTime} - ${slot.endTime}) is starting now! 📚`,
                                icon: '/pwa-192x192.png'
                            });
                        } catch (e) {
                            console.warn('Web notification error:', e);
                        }
                    }, msUntilTime);
                }
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }

        const formattedTime = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        showToast(`🔔 Notification timer set for ${formattedTime}!`);
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
            createdAt: Date.now()
        };

        const updated = [newSlot, ...slots];
        saveSlotsToStorage(updated);
        setTitle('');

        if (bellEnabled) {
            await setupNotificationForSlot(newSlot);
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
            await setupNotificationForSlot({ ...slot, notificationActive: true });
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
        <div className="min-h-dvh bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] text-white font-sans relative pb-12 pt-[max(env(safe-area-inset-top,0px),12px)]">
            {/* Header */}
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between border-b border-indigo-900/50 backdrop-blur-md sticky top-0 z-30 bg-[#0f172a]/80">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 text-indigo-200 px-3.5 py-2 rounded-full transition shadow-sm border border-white/10"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-indigo-200 to-indigo-400 tracking-wide">
                    Make Plan
                </h1>
                <div className="w-16"></div> {/* Spacer for alignment */}
            </div>

            {/* Toast Notification Banner */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-sm border-2 border-amber-300"
                    >
                        <span>{toastMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Side / Main Control Box: Set Time & Notification */}
                <div className="md:col-span-6 bg-slate-900/90 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="flex items-center gap-2 mb-4 text-amber-400 font-bold text-sm uppercase tracking-wider">
                        <Sparkles className="h-4 w-4" /> Add Time Slot
                    </div>

                    <p className="text-xs text-indigo-200/80 mb-6">
                        Set your custom start time and end time. Toggle the bell icon 🔔 to receive automated notifications for your study target!
                    </p>

                    {/* Subject / Task Name Input */}
                    <div className="mb-5">
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

                    {/* Time Box: | 00:00 | to | 00:00 | | SET | 🔔 */}
                    <div className="bg-slate-950/80 border border-indigo-500/40 p-4 rounded-2xl mb-6 shadow-inner">
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
                            {/* Set Button */}
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
                        <span>Clicking <strong>Set Slot</strong> with the bell icon 🔔 enabled will schedule a notification at the start of your study time.</span>
                    </div>
                </div>

                {/* Right Side: List of Scheduled Custom Plan Slots */}
                <div className="md:col-span-6 flex flex-col">
                    <div className="bg-slate-900/90 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl backdrop-blur-xl flex-1 flex flex-col">
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
                                <p className="text-xs text-slate-500 max-w-xs">
                                    Use the time box on the left to set your study schedule from 00:00 to 00:00 and set notifications!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                {slots.map((slot) => (
                                    <motion.div
                                        key={slot.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="bg-slate-950/70 border border-indigo-500/20 hover:border-indigo-500/40 p-4 rounded-2xl flex items-center justify-between gap-3 group transition"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-sm font-extrabold text-amber-300 bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                                                    {slot.startTime} - {slot.endTime}
                                                </span>
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
