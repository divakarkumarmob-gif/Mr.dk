import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function WaveTransition({ active, originX, originY, onCovered }: {
    active: boolean;
    originX: number;
    originY: number;
    onCovered?: () => void;
}) {
    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    className="fixed inset-0 z-[3000] pointer-events-none"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
                >
                    <svg
                        className="w-full h-full"
                        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                        <motion.circle
                            cx={originX}
                            cy={originY}
                            fill="url(#waveGradient)"
                            initial={{ r: 0 }}
                            animate={{
                                r: Math.hypot(window.innerWidth, window.innerHeight) * 1.1,
                            }}
                            transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
                            onAnimationComplete={onCovered}
                        />
                        {/* Wavy edge overlay for a liquid feel, riding just inside the circle's edge */}
                        <motion.path
                            d="M0,0 Q 50,20 100,0 T 200,0"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="6"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                            transition={{ duration: 0.5 }}
                        />
                    </svg>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
