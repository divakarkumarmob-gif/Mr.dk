import React, { useRef, useState } from 'react';
import { Mic, Camera, Send, X, Reply } from 'lucide-react';

interface ReplyTarget {
  text: string;
  senderId: string;
}

interface Props {
  text: string;
  setText: (text: string) => void;
  handleSend: (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFileUpload: (file: File, textOverride?: string) => Promise<void>;
  preview: string | null;
  setPreview: (preview: string | null) => void;
  replyTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
}

export default function MessageInput({ text, setText, handleSend, handleFileChange, handleFileUpload, preview, setPreview, replyTarget, onCancelReply }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileSelection = () => {
    fileInputRef.current?.click();
  };
  
  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setPendingFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const removePreview = () => {
      setPreview(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  }
  
  const handleSendWrapper = async () => {
      if (pendingFile) {
          await handleFileUpload(pendingFile, text);
          setPendingFile(null);
      } else if (preview) {
          // Convert preview (dataUrl) to File
          const res = await fetch(preview);
          const blob = await res.blob();
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          await handleFileUpload(file, text);
      } else {
          await handleSend();
      }
      setPreview(null);
      setText('');
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendWrapper();
    }
  };

  return (
    <div className="p-2 sm:p-3 bg-[#1e293b] flex flex-col gap-1.5 border-t border-white/10">
      {replyTarget && (
        <div className="flex items-center gap-2 bg-white/5 border-l-2 border-green-400 rounded-lg px-3 py-2 mx-1">
          <Reply className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-gray-300 truncate">{replyTarget.text}</p>
          <button onClick={onCancelReply} className="text-gray-400 hover:text-white flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {preview && (
          <div className="relative w-16 h-16 ml-2">
              <img src={preview} className="w-full h-full object-cover rounded-lg" alt="preview" />
              <button onClick={removePreview} className="absolute -top-2 -right-2 bg-red-500 rounded-full text-white p-0.5"><X size={12} /></button>
          </div>
      )}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <input type="file" ref={fileInputRef} onChange={handleLocalFileChange} className="hidden" accept="image/*" aria-label="File input" />
        
        <div className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-full px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
          <input 
            value={text} 
            onChange={e => setText(e.target.value)} 
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm" 
            placeholder="Type a message..." 
            aria-label="Message input" 
          />
          <button className="text-white/60 hover:text-orange-400 shrink-0" aria-label="Voice input"><Mic size={18} /></button>
          <button onClick={handleFileSelection} className="text-white/60 hover:text-orange-400 shrink-0" aria-label="Attach image">
            <Camera size={18} />
          </button>
        </div>

        <button onClick={handleSendWrapper} className="bg-orange-500 hover:bg-orange-600 text-white h-11 w-11 flex items-center justify-center rounded-full transition-colors shrink-0 shadow-lg shadow-orange-500/10" aria-label="Send message">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
