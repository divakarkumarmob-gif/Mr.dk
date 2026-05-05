import {useState, useEffect, useRef} from 'react';
import {Box, Brain} from 'lucide-react';

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
      
      // If we are at the very top, always show
      if (currentScrollY < 50) {
        setIsVisible(true);
      } else {
        // Show if scrolling up, hide if scrolling down
        setIsVisible(prevScrollY.current > currentScrollY);
      }
      prevScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={`sticky top-0 z-50 flex gap-2 w-full mb-6 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-24'}`}
    >
      <button 
        onClick={() => onNavigate('home')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border transition-all duration-300 ${
          active === 'home' 
            ? 'bg-[#161e38] border-orange-500 text-white' 
            : 'bg-[#161e38]/50 border-transparent text-gray-500'
        }`}
      >
        <Box className="h-5 w-5" />
        <span className="font-semibold text-sm">MAIN HUB</span>
      </button>

      <button 
        onClick={() => onNavigate('study')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full border transition-all duration-300 ${
          active === 'study' 
            ? 'bg-[#161e38] border-orange-500 text-white' 
            : 'bg-[#161e38]/50 border-transparent text-gray-500'
        }`}
      >
        <Brain className="h-5 w-5" />
        <span className="font-semibold text-sm">STUDY HUB</span>
      </button>
    </div>
  );
}
