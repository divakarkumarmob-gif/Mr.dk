import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const candidateImages = [
  "/posters/poster_1.png",
  "/posters/poster_2.png",
  "/posters/poster_3.png",
  "/posters/poster_4.png",
];

export default function PosterSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev
  const [loadedImages, setLoadedImages] = useState<string[]>(candidateImages);
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
    let cancelled = false;
    const validate = async () => {
      const valid: string[] = [];
      for (let i = 1; i <= 4; i++) {
        const sources = [
          `/posters/poster_${i}.png`,
          `/posters/poster_${i}.jpeg`,
          `/posters/poster_${i}.jpg`,
        ];
        for (const src of sources) {
          const ok = await new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
          });
          if (ok) {
            valid.push(src);
            break;
          }
        }
      }
      if (!cancelled && valid.length > 0) {
        setLoadedImages(valid);
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

