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

export default function Pressable({ children, onClick, className, type = 'button', disabled }: PressableProps) {
  const handlePress = async () => {
    if (disabled) return;
    await Haptics.impact({ style: ImpactStyle.Light });
    if (onClick) onClick();
  };

  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={handlePress}
      disabled={disabled}
      className={`transition-colors duration-150 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </motion.button>
  );
}
