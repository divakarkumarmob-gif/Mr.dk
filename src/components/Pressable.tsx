import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion } from 'motion/react';
import React from 'react';

interface PressableProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export default function Pressable({ children, onClick, className, type = 'button' }: PressableProps) {
  const handlePress = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
    if (onClick) onClick();
  };

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.98 }}
      onClick={handlePress}
      className={`transition-colors duration-150 ${className}`}
    >
      {children}
    </motion.button>
  );
}
