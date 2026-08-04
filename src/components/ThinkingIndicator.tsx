import React from 'react';
import StatusLoader, { StatusLoaderVariant, StatusLoaderSize } from './StatusLoader';

interface ThinkingIndicatorProps {
    variant?: StatusLoaderVariant;
    label?: string;
    size?: StatusLoaderSize;
    className?: string;
    cycleLabels?: string[];
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ 
    variant = 'thinking', 
    label, 
    size = 'sm', 
    className = '',
    cycleLabels
}) => {
    return (
        <StatusLoader 
            variant={variant} 
            label={label} 
            size={size} 
            className={className} 
            cycleLabels={cycleLabels}
        />
    );
};

export default ThinkingIndicator;
