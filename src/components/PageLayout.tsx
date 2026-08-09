import React from 'react';
import { motion } from 'motion/react';

interface PageLayoutProps {
  children: React.ReactNode;
  /** Tailwind background class, e.g. "bg-background" or custom class */
  background?: string;
  /** Tailwind text color class, e.g. "text-foreground" */
  textColor?: string;
  /** Horizontal padding class. Defaults to "px-3". Pass "px-0" to disable. */
  paddingX?: string;
  /**
   * Extra bottom padding class for screens that render a BottomNav
   * (e.g. "pb-20"). Defaults to "" (no extra bottom padding). The
   * safe-area bottom inset is always applied on top of this regardless.
   */
  paddingBottomExtra?: string;
  /**
   * Minimum top padding fallback (used before env() is supported / on web).
   * Defaults to 0px.
   */
  minTopPadding?: number;
  /** Extra classes appended to the outer wrapper, for one-off tweaks. */
  className?: string;
  /** Use "h-dvh" + overflow-y-auto instead of "min-h-dvh". Used by the home view. */
  scrollable?: boolean;
}

export default function PageLayout({
  children,
  background = '',
  textColor = 'text-slate-100',
  paddingX = 'px-3 sm:px-6',
  paddingBottomExtra = '',
  minTopPadding = 0,
  className = '',
  scrollable = false,
}: PageLayoutProps) {
  const heightClass = scrollable ? 'h-dvh overflow-y-auto' : 'min-h-dvh';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={[
        'flex flex-col md:pl-64',
        heightClass,
        background,
        textColor,
        paddingX,
        paddingBottomExtra,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        paddingTop: minTopPadding > 0 
          ? `max(env(safe-area-inset-top, 0px), ${minTopPadding}px)` 
          : 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {children}
    </motion.div>
  );
}

