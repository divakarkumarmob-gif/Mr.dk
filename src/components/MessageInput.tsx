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
    <div className="p-3 bg-[#0a0f24] flex items-center gap-2">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" aria-label="File input" />
      
      <div className="flex-1 bg-[#161e38] rounded-full px-5 py-3 flex items-center gap-3">
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none" 
          placeholder="Ask anything" 
          aria-label="Message input" 
        />
        <button className="text-white hover:text-blue-400" aria-label="Voice input"><Mic size={20} /></button>
        <button onClick={() => fileInputRef.current?.click()} className="text-white hover:text-blue-400" aria-label="Attach image"><Camera size={20} /></button>
      </div>

      <button onClick={() => handleSend()} className="bg-[#161e38] text-white p-4 rounded-full hover:bg-blue-900 transition-colors" aria-label="Send message">
        <Sparkles size={20} />
      </button>
    </div>
  );
}
