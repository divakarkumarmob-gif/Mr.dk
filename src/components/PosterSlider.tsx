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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setDirection(1); // Auto slide is always next
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  return (
    <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden shadow-lg mb-6 relative bg-gray-100">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.img
          key={currentIndex}
          src={images[currentIndex]}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full h-full object-contain"
          alt="Poster"
          loading="lazy"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(e, { offset }) => {
            const swipe = offset.x;
            if (swipe < -50) {
              setDirection(1);
              setCurrentIndex((prev) => (prev + 1) % images.length);
              startTimer();
            } else if (swipe > 50) {
              setDirection(-1);
              setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
              startTimer();
            }
          }}
        />
      </AnimatePresence>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
        {images.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${index === currentIndex ? 'bg-black' : 'bg-black/50'}`}
          />
        ))}
      </div>
    </div>
  );
}
