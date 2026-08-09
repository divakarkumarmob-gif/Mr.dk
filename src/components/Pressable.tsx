import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion } from 'motion/react';
import React from 'react';

interface PressableProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export default function Pressable({ children, onClick, className = '', type = 'button', disabled }: PressableProps) {
  const handlePress = async () => {
    if (disabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Fallback if Haptics is unavailable
    }
    if (onClick) onClick();
  };

  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      onClick={handlePress}
      disabled={disabled}
      className={`transition-all duration-200 cursor-pointer ${className} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </motion.button>
  );
}

