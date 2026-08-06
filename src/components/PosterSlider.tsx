import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const images = [
  "/posters/poster_1.jpeg",
  "/posters/poster_2.jpeg",
  "/posters/poster_3.jpeg",
  "/posters/poster_4.jpeg"
];

export default function PosterSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev
  const [loadedImages, setLoadedImages] = useState<string[]>(images);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (loadedImages.length === 0) return;
    intervalRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % loadedImages.length);
    }, 4000);
  };

  useEffect(() => {
    // Pre-validate which images are actually loadable (e.g. in Capacitor
    // WebView the public/ files may not have been synced yet)
    let cancelled = false;
    const validate = async () => {
      const valid: string[] = [];
      for (const src of images) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src;
        });
        if (ok) valid.push(src);
      }
      if (!cancelled) {
        setLoadedImages(valid.length > 0 ? valid : images); // fallback to all if none pre-loaded
      }
    };
    validate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadedImages]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0
    })
  };

  if (loadedImages.length === 0) return null;

  return (
    <div 
      className="w-full h-48 sm:h-64 rounded-xl overflow-hidden shadow-lg mb-6 relative bg-gray-100"
      onMouseEnter={() => { if (intervalRef.current) clearInterval(intervalRef.current); }}
      onMouseLeave={startTimer}
      onTouchStart={() => { if (intervalRef.current) clearInterval(intervalRef.current); }}
      onTouchEnd={startTimer}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.img
          key={currentIndex}
          src={loadedImages[currentIndex]}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-contain"
          alt="Poster"
          loading="eager"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(e, { offset }) => {
            const swipe = offset.x;
            if (swipe < -50) {
              setDirection(1);
              setCurrentIndex((prev) => (prev + 1) % loadedImages.length);
              startTimer();
            } else if (swipe > 50) {
              setDirection(-1);
              setCurrentIndex((prev) => (prev - 1 + loadedImages.length) % loadedImages.length);
              startTimer();
            }
          }}
        />
      </AnimatePresence>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-10">
        {loadedImages.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${index === currentIndex ? 'bg-black' : 'bg-black/50'}`}
          />
        ))}
      </div>
    </div>
  );
}

