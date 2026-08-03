import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

export default function WaveReveal({
    active,
    originX,
    originY,
    onFullyRevealed,
    children,
}: {
    active: boolean;
    originX: number;
    originY: number;
    onFullyRevealed?: () => void;
    children: React.ReactNode;
}) {
    const maxRadius = Math.hypot(window.innerWidth, window.innerHeight) * 1.05;
    const radius = useMotionValue(0);
    const clipPath = useTransform(radius, (r) => `circle(${r}px at ${originX}px ${originY}px)`);
    const ringSize = useTransform(radius, (r) => r * 2);
    const ringOffset = useTransform(radius, (r) => -r);

    useEffect(() => {
        if (!active) {
            radius.set(0);
            return;
        }
        radius.set(0);
        const controls = animate(radius, maxRadius, {
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1], // smooth "ease-out-expo"-style curve — no abrupt start/stop
            onComplete: () => onFullyRevealed?.(),
        });
        return () => controls.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, originX, originY]);

    if (!active) return null;

    return (
        <div className="fixed inset-0 z-[3000]" style={{ willChange: 'clip-path' }}>
            <motion.div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath, willChange: 'clip-path' }}
            >
                {children}
            </motion.div>

            <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: ringSize,
                    height: ringSize,
                    left: originX,
                    top: originY,
                    x: ringOffset,
                    y: ringOffset,
                    boxShadow: '0 0 24px 6px rgba(139, 92, 246, 0.55), inset 0 0 18px 4px rgba(59, 130, 246, 0.35)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    willChange: 'width, height, transform',
                }}
            />
        </div>
    );
}
