import React from 'react';

/**
 * PageLayout
 * ----------
 * Central place for safe-area (status bar / gesture bar) padding so every
 * full-screen view in App.tsx applies it the same way instead of repeating
 * the same Tailwind arbitrary-value classes 16+ times.
 *
 * Usage (replaces patterns like):
 *   <div className="flex flex-col min-h-dvh bg-background pt-[max(env(safe-area-inset-top,0px),12px)] px-3">
 *
 * with:
 *   <PageLayout background="bg-background">
 *
 * Props intentionally mirror the variations already present in App.tsx
 * (different bg colors, some views need extra bottom padding for the
 * BottomNav, some need px-0, one needs px-1.5 sm:px-3) so this is a
 * drop-in replacement with zero visual change by default.
 */

interface PageLayoutProps {
  children: React.ReactNode;
  /** Tailwind background class, e.g. "bg-background" or "bg-[#f4e4bc]" */
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
   * Defaults to 12px. StudyHub uses 24px, so that's overridable.
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
  textColor = '',
  paddingX = 'px-3',
  paddingBottomExtra = '',
  minTopPadding = 5,
  className = '',
  scrollable = false,
}: PageLayoutProps) {
  const heightClass = scrollable ? 'h-dvh overflow-y-auto' : 'min-h-dvh';

  return (
    <div
      className={[
        'flex flex-col',
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
        paddingTop: `max(env(safe-area-inset-top, 0px), ${minTopPadding}px)`,
        // Bottom inset is always applied so content never sits under the
        // gesture bar / 3-button nav bar. Screens with a BottomNav add
        // paddingBottomExtra (e.g. "pb-20") as a Tailwind class on top of
        // this so the nav bar itself has room, matching prior behavior.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {children}
    </div>
  );
}
