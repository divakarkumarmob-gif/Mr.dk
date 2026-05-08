import React, { useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';

interface Props {
  text: string;
  setText: (text: string) => void;
  handleSend: (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function MessageInput({ text, setText, handleSend, handleFileChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 bg-[#202c33] flex items-center gap-2">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" aria-label="File input" />
      <button onClick={() => fileInputRef.current?.click()} className="text-white" aria-label="Attach file"><Paperclip size={20} /></button>
      <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-[#2a3942] p-2 rounded-lg text-white" placeholder="Message..." aria-label="Message input" />
      <button onClick={() => handleSend()} className="text-white" aria-label="Send message"><Send size={24} /></button>
    </div>
  );
}
