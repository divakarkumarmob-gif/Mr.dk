// StatusLoader.tsx - Animated AI Agent Status Pill Component (React + TypeScript)
// Optional upgrade: lucide-react or framer-motion can be used if desired, but this is pure SVG/CSS for maximum performance.

import React, { useState, useEffect } from 'react';
import './StatusLoader.css';

export type StatusLoaderVariant = 'thinking' | 'solving' | 'searching' | 'working';
export type StatusLoaderSize = 'sm' | 'md';

export interface StatusLoaderProps {
  variant: StatusLoaderVariant;
  label?: string;
  size?: StatusLoaderSize;
  className?: string;
  cycleLabels?: string[];
}

const DEFAULT_LABELS: Record<StatusLoaderVariant, string> = {
  thinking: 'Thinking....',
  solving: 'Solving....',
  searching: 'Searching....',
  working: 'Working....',
};

// 1. Thinking Icon: Swirling Dual Ring SVG
const ThinkingIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="status-loader-thinking-ring"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      strokeOpacity="0.25"
    />
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="url(#thinking-gradient)"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="status-loader-thinking-dash"
    />
    <defs>
      <linearGradient id="thinking-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#C084FC" />
      </linearGradient>
    </defs>
  </svg>
);

// 2. Solving Icon: Dotted Sphere / Globe Pulsing SVG
const SolvingIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="status-loader-solving-globe"
  >
    <circle cx="12" cy="12" r="9" stroke="#34D399" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.6" />
    <ellipse cx="12" cy="12" rx="9" ry="4" stroke="#10B981" strokeWidth="1.2" strokeDasharray="2 2" strokeOpacity="0.8" />
    <circle cx="12" cy="3" r="1.5" fill="#34D399" className="status-loader-dot-p1" />
    <circle cx="21" cy="12" r="1.5" fill="#10B981" className="status-loader-dot-p2" />
    <circle cx="12" cy="21" r="1.5" fill="#059669" className="status-loader-dot-p3" />
    <circle cx="3" cy="12" r="1.5" fill="#6EE7B7" className="status-loader-dot-p4" />
  </svg>
);

// 3. Searching Icon: Sparkle / Scatter Dots SVG
const SearchingIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Center Sparkle */}
    <path
      d="M12 4L13.8 9.2L19 11L13.8 12.8L12 18L10.2 12.8L5 11L10.2 9.2L12 4Z"
      fill="url(#searching-sparkle-grad)"
      className="status-loader-sparkle-core"
    />
    {/* Scatter dots around */}
    <circle cx="5" cy="5" r="1.2" fill="#FBBF24" className="status-loader-sparkle-d1" />
    <circle cx="19" cy="5" r="1" fill="#F59E0B" className="status-loader-sparkle-d2" />
    <circle cx="20" cy="19" r="1.2" fill="#FCD34D" className="status-loader-sparkle-d3" />
    <circle cx="4" cy="18" r="1" fill="#FBBF24" className="status-loader-sparkle-d4" />
    <defs>
      <linearGradient id="searching-sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
  </svg>
);

// 4. Working Icon: Orbiting Dots SVG
const WorkingIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="status-loader-working-orbit"
  >
    <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    <circle cx="12" cy="4" r="2.2" fill="#3B82F6" />
    <circle cx="19.6" cy="12" r="1.8" fill="#60A5FA" opacity="0.85" />
    <circle cx="12" cy="20" r="1.4" fill="#93C5FD" opacity="0.65" />
    <circle cx="4.4" cy="12" r="1" fill="#BFDBFE" opacity="0.45" />
  </svg>
);

const renderIcon = (variant: StatusLoaderVariant, pixelSize: number) => {
  switch (variant) {
    case 'thinking':
      return <ThinkingIcon size={pixelSize} />;
    case 'solving':
      return <SolvingIcon size={pixelSize} />;
    case 'searching':
      return <SearchingIcon size={pixelSize} />;
    case 'working':
      return <WorkingIcon size={pixelSize} />;
    default:
      return <ThinkingIcon size={pixelSize} />;
  }
};

export const StatusLoader: React.FC<StatusLoaderProps> = ({
  variant = 'thinking',
  label,
  size = 'md',
  className = '',
  cycleLabels,
}) => {
  const [currentLabelIndex, setCurrentLabelIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  const defaultLabel = DEFAULT_LABELS[variant] || DEFAULT_LABELS.thinking;
  const activeLabelList = cycleLabels && cycleLabels.length > 0 ? cycleLabels : null;

  useEffect(() => {
    if (!activeLabelList) return;

    const interval = setInterval(() => {
      setFadeState('out');
      setTimeout(() => {
        setCurrentLabelIndex((prev) => (prev + 1) % activeLabelList.length);
        setFadeState('in');
      }, 300);
    }, 2000);

    return () => clearInterval(interval);
  }, [activeLabelList]);

  const displayLabel = activeLabelList
    ? activeLabelList[currentLabelIndex]
    : label !== undefined
    ? label
    : defaultLabel;

  const pixelSize = size === 'sm' ? 16 : 20;

  return (
    <div
      className={`status-loader-container status-loader-${size} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="status-loader-icon">{renderIcon(variant, pixelSize)}</div>
      <span className={`status-loader-label fade-${fadeState}`}>{displayLabel}</span>
    </div>
  );
};

// Demo component showing all 4 variants side-by-side
export const StatusLoaderDemo: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: '#090d16', borderRadius: '1rem' }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>AI Status Loader Variants</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <StatusLoader variant="thinking" size="md" />
        <StatusLoader variant="solving" size="md" />
        <StatusLoader variant="searching" size="md" />
        <StatusLoader variant="working" size="md" />
      </div>
      <h4 style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>Compact (sm) & Cycling Labels Example</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <StatusLoader variant="thinking" size="sm" />
        <StatusLoader
          variant="solving"
          size="md"
          cycleLabels={['Analyzing NCERT...', 'Evaluating Formulas...', 'Generating Solution...']}
        />
      </div>
    </div>
  );
};

export default StatusLoader;
