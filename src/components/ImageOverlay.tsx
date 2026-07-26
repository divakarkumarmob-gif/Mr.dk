import React from 'react';
import { Star, Download, Reply, X } from 'lucide-react';

interface Props {
  message: any;
  onClose: () => void;
  onStar: (id: string) => void;
  onDownload: (url: string, mediaType?: 'image' | 'video' | 'audio') => void;
  onReply: (message: any) => void;
}

export default function ImageOverlay({ message, onClose, onStar, onDownload, onReply }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={onClose}>
      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={e => e.stopPropagation()}>
        {message.mediaType === 'video' ? (
          <video src={message.mediaUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" />
        ) : (
          <img src={message.mediaUrl} alt="media" className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>

      {/* Bottom action bar */}
      <div
        className="bg-[#1e293b] px-2 py-2 flex items-center justify-around border-t border-white/10 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors"
          onClick={() => { onStar(message.id); onClose(); }}
        >
          <Star className={`h-5 w-5 ${message.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
          <span className="text-[11px] text-gray-300">{message.starred ? 'Unstar' : 'Star'}</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors"
          onClick={() => { onDownload(message.mediaUrl, message.mediaType); onClose(); }}
        >
          <Download className="h-5 w-5 text-blue-400" />
          <span className="text-[11px] text-gray-300">Save</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors"
          onClick={() => { onReply(message); onClose(); }}
        >
          <Reply className="h-5 w-5 text-green-400" />
          <span className="text-[11px] text-gray-300">Reply</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors"
          onClick={onClose}
        >
          <X className="h-5 w-5 text-gray-300" />
          <span className="text-[11px] text-gray-300">Close</span>
        </button>
      </div>
    </div>
  );
}
