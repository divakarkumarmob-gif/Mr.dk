import React, { useState } from 'react';
import { ZoomIn, X } from 'lucide-react';

interface QuestionImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function QuestionImage({ src, alt = "Question Diagram", className = "" }: QuestionImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) return null;

  return (
    <>
      <div className={`my-4 relative group inline-block max-w-full ${className}`}>
        <div 
          onClick={() => setIsOpen(true)}
          className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm hover:border-blue-400 transition-all cursor-pointer group"
        >
          <img 
            src={src} 
            alt={alt} 
            onError={() => setHasError(true)}
            className="max-h-72 w-auto max-w-full object-contain mx-auto rounded-xl p-2 transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
              <ZoomIn className="w-3.5 h-3.5" /> Tap to expand
            </span>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Preview */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={src} 
              alt={alt} 
              className="max-h-[85vh] max-w-full object-contain rounded-2xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
