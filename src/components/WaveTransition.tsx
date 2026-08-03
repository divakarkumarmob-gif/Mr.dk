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

    useEffect(() => {
        if (active) {
            radius.set(0);
            const controls = animate(radius, maxRadius, {
                duration: 0.6,
                ease: [0.65, 0, 0.35, 1],
                onComplete: () => onFullyRevealed?.(),
            });
            return () => controls.stop();
        } else {
            radius.set(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, originX, originY]);

    if (!active) return null;

    return (
        <div className="fixed inset-0 z-[3000]">
            {/* The revealed content, clipped to the growing circle */}
            <motion.div
                className="absolute inset-0 overflow-hidden"
                style={{
                    clipPath: useMotionValueClipPath(radius, originX, originY),
                }}
            >
                {children}
            </motion.div>

            {/* Decorative wave ring riding the edge of the reveal circle */}
            <RevealRing radius={radius} originX={originX} originY={originY} />
        </div>
    );
}

function useMotionValueClipPath(radius: ReturnType<typeof useMotionValue<number>>, x: number, y: number) {
    return useTransform(radius, (r: number) => `circle(${r}px at ${x}px ${y}px)`);
}

function RevealRing({ radius, originX, originY }: { radius: ReturnType<typeof useMotionValue<number>>; originX: number; originY: number }) {
    const size = useTransform(radius, (r: number) => r * 2);
    const offset = useTransform(radius, (r: number) => -r);

    return (
        <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
                width: size,
                height: size,
                left: originX,
                top: originY,
                x: offset,
                y: offset,
                boxShadow: '0 0 24px 6px rgba(139, 92, 246, 0.55), inset 0 0 18px 4px rgba(59, 130, 246, 0.35)',
                border: '2px solid rgba(255,255,255,0.4)',
            }}
        />
    );
}
