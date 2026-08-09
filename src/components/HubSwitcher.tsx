import { useState, useEffect, useRef } from 'react';
import { Box, Brain } from 'lucide-react';
import { motion } from 'motion/react';

interface HubSwitcherProps {
  active: 'home' | 'study';
  onNavigate: (view: 'home' | 'study') => void;
}

export default function HubSwitcher({ active, onNavigate }: HubSwitcherProps) {
  const [isVisible, setIsVisible] = useState(true);
  const prevScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 50) {
        setIsVisible(true);
      } else {
        setIsVisible(prevScrollY.current > currentScrollY);
      }
      prevScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={`sticky top-0 z-50 flex gap-2.5 w-full mb-4 py-1.5 backdrop-blur-md transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-24'}`}
    >
      <button 
        onClick={() => onNavigate('home')}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
          active === 'home' 
            ? 'bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-pink-500/20 border-purple-500/50 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]' 
            : 'bg-slate-900/60 backdrop-blur-xl border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        {active === 'home' && (
          <motion.div
            layoutId="hubSwitcherActive"
            className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 pointer-events-none"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Box className={`h-4 w-4 sm:h-5 sm:w-5 relative z-10 ${active === 'home' ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-slate-400'}`} />
        <span className="font-bold text-xs sm:text-sm tracking-wide relative z-10">MAIN HUB</span>
      </button>

      <button 
        onClick={() => onNavigate('study')}
        className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
          active === 'study' 
            ? 'bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-pink-500/20 border-purple-500/50 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]' 
            : 'bg-slate-900/60 backdrop-blur-xl border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        {active === 'study' && (
          <motion.div
            layoutId="hubSwitcherActive"
            className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 pointer-events-none"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Brain className={`h-4 w-4 sm:h-5 sm:w-5 relative z-10 ${active === 'study' ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-slate-400'}`} />
        <span className="font-bold text-xs sm:text-sm tracking-wide relative z-10">STUDY HUB</span>
      </button>
    </div>
  );
}

