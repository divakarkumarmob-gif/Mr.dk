import { useEffect } from 'react';

export const useReportProblemGesture = (onTrigger: () => void) => {
    useEffect(() => {
        let lastX = 0, lastY = 0, lastZ = 0;
        let lastTime = Date.now();
        const threshold = 25; // Shake sensitivity

        const handleMotion = (event: DeviceMotionEvent) => {
            const acceleration = event.acceleration;
            if (!acceleration) return;

            const { x, y, z } = acceleration;
            if (x === null || y === null || z === null) return;

            const currentTime = Date.now();
            const timeDiff = currentTime - lastTime;

            if (timeDiff > 100) {
                const deltaX = Math.abs(x - lastX);
                const deltaY = Math.abs(y - lastY);
                const deltaZ = Math.abs(z - lastZ);

                if (deltaX + deltaY + deltaZ > threshold) {
                    onTrigger();
                }

                lastX = x;
                lastY = y;
                lastZ = z;
                lastTime = currentTime;
            }
        };

        window.addEventListener('devicemotion', handleMotion);

        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [onTrigger]);
};
