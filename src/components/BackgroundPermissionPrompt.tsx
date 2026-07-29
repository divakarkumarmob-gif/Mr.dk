import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { App as CapacitorApp } from '@capacitor/app';
import { BatteryCharging, X, CheckCircle2, ExternalLink, Circle } from 'lucide-react';
import { getPreference, setPreference } from '../utils/preferences';
import { BackgroundSettings } from '../utils/backgroundSettings';

const STORAGE_KEY = 'background_permission_prompt_seen';

type ActionStep = {
    text: string;
    // 'battery'/'autostart' fire a real native screen; 'manual' has no API,
    // user has to do it by hand (e.g. locking the Recents card).
    action: 'battery' | 'autostart' | 'manual';
};

type OemGuide = {
    match: (manufacturer: string) => boolean;
    brand: string;
    steps: ActionStep[];
};

const OEM_GUIDES: OemGuide[] = [
    {
        brand: 'Xiaomi / Redmi / POCO (MIUI)',
        match: (m) => /xiaomi|redmi|poco/.test(m),
        steps: [
            { text: 'Turn on Autostart for the app', action: 'autostart' },
            { text: 'Set battery usage to "No restrictions"', action: 'battery' },
            { text: 'In Recent Apps, swipe down on the app card until 🔒 appears, tap it', action: 'manual' },
        ],
    },
    {
        brand: 'Oppo / Realme (ColorOS)',
        match: (m) => /oppo|realme|cph/.test(m),
        steps: [
            { text: 'Allow "Auto-launch" for the app', action: 'autostart' },
            { text: 'Allow background activity / unrestricted battery', action: 'battery' },
            { text: 'In Recent Apps, swipe down on the app card until 🔒 appears, tap it', action: 'manual' },
        ],
    },
    {
        brand: 'Vivo / iQOO (OriginOS / FuntouchOS)',
        match: (m) => /vivo|iqoo/.test(m),
        steps: [
            { text: 'Add the app to the background/auto-start whitelist', action: 'autostart' },
            { text: 'Allow background power consumption', action: 'battery' },
            { text: 'In Recent Apps, swipe down on the app card until 🔒 appears, tap it', action: 'manual' },
        ],
    },
    {
        brand: 'OnePlus (OxygenOS)',
        match: (m) => /oneplus/.test(m),
        steps: [
            { text: 'Set battery optimization to "Don\'t optimize"', action: 'battery' },
            { text: 'Allow background activity in App info', action: 'autostart' },
            { text: 'In Recent Apps, swipe down on the app card until 🔒 appears, tap it', action: 'manual' },
        ],
    },
    {
        brand: 'Samsung (One UI)',
        match: (m) => /samsung/.test(m),
        steps: [
            { text: 'Set battery usage to "Unrestricted"', action: 'battery' },
            { text: 'Make sure the app is not in "Sleeping apps"', action: 'autostart' },
        ],
    },
    {
        brand: 'Your phone',
        match: () => true,
        steps: [
            { text: 'Turn off battery optimization for the app', action: 'battery' },
            { text: 'Allow background data / background activity', action: 'autostart' },
            { text: 'Avoid using "Force Stop" — it blocks notifications until you reopen the app', action: 'manual' },
        ],
    },
];

async function detectGuide(): Promise<OemGuide> {
    if (!Capacitor.isNativePlatform()) return OEM_GUIDES[OEM_GUIDES.length - 1];
    try {
        const info = await Device.getInfo();
        const manufacturer = (info.manufacturer || '').toLowerCase();
        return OEM_GUIDES.find(g => g.match(manufacturer)) || OEM_GUIDES[OEM_GUIDES.length - 1];
    } catch {
        return OEM_GUIDES[OEM_GUIDES.length - 1];
    }
}

export default function BackgroundPermissionPrompt() {
    const [visible, setVisible] = useState(false);
    const [guide, setGuide] = useState<OemGuide | null>(null);
    const [dismissing, setDismissing] = useState(false);
    const [batteryDone, setBatteryDone] = useState(false);
    const [autostartTapped, setAutostartTapped] = useState(false);
    const [manualChecked, setManualChecked] = useState(false);
    const returningFromSettings = useRef(false);

    const refreshBatteryStatus = async () => {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const { ignoring } = await BackgroundSettings.isIgnoringBatteryOptimizations();
            if (ignoring) setBatteryDone(true);
        } catch {
            // Plugin not available (e.g. running an older build without it) — ignore.
        }
    };

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

        (async () => {
            const seen = await getPreference(STORAGE_KEY);
            if (seen === 'true') return;
            const g = await detectGuide();
            setGuide(g);
            setVisible(true);
            refreshBatteryStatus();
        })();

        // When the user comes back from a settings screen we opened, re-check
        // whether battery optimization is now actually off, and tick the
        // autostart step since we can't verify that one automatically.
        const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive && returningFromSettings.current) {
                returningFromSettings.current = false;
                refreshBatteryStatus();
            }
        });
        return () => { listener.then(l => l.remove()); };
    }, []);

    const handleClose = async () => {
        setDismissing(true);
        await setPreference(STORAGE_KEY, 'true');
        setTimeout(() => setVisible(false), 200);
    };

    const runAction = async (action: ActionStep['action']) => {
        if (action === 'manual') {
            setManualChecked(true);
            return;
        }
        returningFromSettings.current = true;
        try {
            if (action === 'battery') {
                await BackgroundSettings.requestIgnoreBatteryOptimizations();
            } else {
                await BackgroundSettings.openAutostartSettings();
                setAutostartTapped(true);
            }
        } catch {
            returningFromSettings.current = false;
        }
    };

    const isStepDone = (step: ActionStep) => {
        if (step.action === 'battery') return batteryDone;
        if (step.action === 'autostart') return autostartTapped;
        return manualChecked;
    };

    const allDone = guide?.steps.every(isStepDone) ?? false;

    return (
        <AnimatePresence>
            {visible && guide && (
                <motion.div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: dismissing ? 0 : 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 60 }}
                        className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-500/20 rounded-2xl">
                                <BatteryCharging className="h-8 w-8 text-orange-400" />
                            </div>
                            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">Don't miss important updates</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Your phone (<span className="text-orange-400 font-medium">{guide.brand}</span>) may block notifications once the app is fully closed. Tap each step below to fix it:
                        </p>

                        <div className="space-y-3 mb-6">
                            {guide.steps.map((step, i) => {
                                const done = isStepDone(step);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => runAction(step.action)}
                                        disabled={done}
                                        className={`w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                                            done ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                        }`}
                                    >
                                        {done ? (
                                            <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-400" />
                                        ) : (
                                            <Circle className="h-6 w-6 flex-shrink-0 text-gray-500" />
                                        )}
                                        <p className={`text-sm leading-snug flex-1 ${done ? 'text-green-300' : 'text-gray-200'}`}>
                                            {step.text}
                                        </p>
                                        {!done && step.action !== 'manual' && (
                                            <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-500" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleClose}
                            className={`w-full py-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 ${
                                allDone ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                            }`}
                        >
                            <CheckCircle2 className="h-5 w-5" />
                            {allDone ? 'All set' : 'Done, got it'}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
