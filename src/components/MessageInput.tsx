import React, { useRef } from 'react';
import { Mic, Camera, Sparkles } from 'lucide-react';

interface Props {
  text: string;
  setText: (text: string) => void;
  handleSend: (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function MessageInput({ text, setText, handleSend, handleFileChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-2 sm:p-3 bg-[#0a0f24] flex items-center gap-1.5 sm:gap-2">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" aria-label="File input" />
      
      <div className="flex-1 min-w-0 bg-[#161e38] rounded-full px-3 sm:px-5 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm" 
          placeholder="Ask anything" 
          aria-label="Message input" 
        />
        <button className="text-white/60 hover:text-blue-400 shrink-0" aria-label="Voice input"><Mic size={18} /></button>
        <button onClick={() => fileInputRef.current?.click()} className="text-white/60 hover:text-blue-400 shrink-0" aria-label="Attach image"><Camera size={18} /></button>
      </div>

      <button onClick={() => handleSend()} className="bg-blue-600 text-white p-3 sm:p-4 rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-lg shadow-blue-500/10" aria-label="Send message">
        <Sparkles size={18} />
      </button>
    </div>
  );
}
