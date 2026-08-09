import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';

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
    const maxDiameter = Math.hypot(window.innerWidth, window.innerHeight) * 2.1;
    const scale = useMotionValue(1);
    const hasRevealedRef = useRef(false);

    useEffect(() => {
        if (!active) {
            scale.set(1);
            hasRevealedRef.current = false;
            return;
        }
        scale.set(1);
        hasRevealedRef.current = false;
        const controls = animate(scale, 0, {
            duration: 0.65,
            ease: [0.22, 1, 0.36, 1],
            onComplete: () => {
                hasRevealedRef.current = true;
                onFullyRevealed?.();
            },
        });
        return () => controls.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, originX, originY]);

    return (
        <div className="fixed inset-0 z-[3000]">
            {/* Content mounts immediately and unclipped — cheap, painted once */}
            <div className="absolute inset-0 overflow-hidden">
                {children}
            </div>

            {/* Overlay shape shrinks away toward the origin point using only
                transform (GPU-composited, never repaints the content below) */}
            {active && (
                <motion.div
                    className="absolute rounded-full pointer-events-none z-[3000]"
                    style={{
                        width: maxDiameter,
                        height: maxDiameter,
                        left: originX - maxDiameter / 2,
                        top: originY - maxDiameter / 2,
                        scale,
                        background: 'radial-gradient(circle, rgba(139,92,246,0.95) 0%, rgba(59,130,246,0.95) 50%, rgba(236,72,153,0.85) 100%)',
                        boxShadow: '0 0 60px 20px rgba(139, 92, 246, 0.6), inset 0 0 30px rgba(236, 72, 153, 0.4)',
                        willChange: 'transform',
                    }}
                />
            )}
        </div>
    );
}

