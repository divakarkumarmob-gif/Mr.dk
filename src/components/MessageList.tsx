import React, { useState } from 'react';
import { Message } from '../types';
import { auth } from '../lib/firebase';
import ImageOverlay from './ImageOverlay';
import { starMessage } from '../services/chatService';
import { saveMediaToGallery } from '../utils/saveMediaToGallery';
import { Check, CheckCheck, Star } from 'lucide-react';

interface Props {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatId: string;
  onReply?: (message: any) => void;
}

export default function MessageList({ messages, messagesEndRef, isLoading, chatId, onReply }: Props & { isLoading?: boolean }) {
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [touchTimer, setTouchTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = (m: any) => {
    const timer = setTimeout(() => {
        setSelectedMessage(m);
    }, 500);
    setTouchTimer(timer);
  };

  const handleTouchEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
  };

  if (isLoading) {
    return <div className="flex-1 p-4 text-center text-gray-400">Loading messages...</div>;
  }
  
  if (messages.length === 0) {
    return <div className="flex-1 p-4 text-center text-gray-400">No messages yet. Start the conversation!</div>;
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-2"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
        backgroundSize: '20px 20px'
      }}
    >
      {messages.map(m => {
        const currentUserUid = auth.currentUser?.uid;
        const isMe = m.senderId === currentUserUid;
        return (
          <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`p-2.5 rounded-2xl max-w-[80%] sm:max-w-[70%] shadow-md relative ${
                isMe ? 'bg-[#005c4b] text-white rounded-br-sm' : 'bg-[#202c33] text-white rounded-bl-sm'
              }`}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(m); }}
              onTouchStart={() => handleTouchStart(m)}
              onTouchEnd={handleTouchEnd}
            >
              {m.starred && (
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 absolute -top-1.5 -left-1.5" />
              )}

              {m.replyTo && (
                <div className="bg-black/20 border-l-2 border-green-400 rounded-lg px-2 py-1.5 mb-1.5 text-xs text-gray-200/90 truncate">
                  {m.replyTo.text}
                </div>
              )}

              {m.text && <p className="text-sm break-words whitespace-pre-wrap px-0.5">{m.text}</p>}

              {m.mediaUrl && (
                m.mediaType === 'image' ? (
                  <img
                    src={m.mediaUrl}
                    alt="media"
                    className="max-w-[200px] max-h-[260px] w-auto h-auto object-contain rounded-lg mt-1 cursor-pointer"
                  />
                ) :
                m.mediaType === 'video' ? (
                  <video src={m.mediaUrl} controls className="max-w-[200px] max-h-[260px] rounded-lg mt-1" />
                ) : (
                  <audio src={m.mediaUrl} controls className="max-w-full rounded mt-1" />
                )
              )}

              <div className="flex items-center justify-end gap-1 mt-1 px-0.5">
                <p className="text-[10px] text-gray-300/80">
                  {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                </p>
                {isMe && (
                  m.isOptimistic
                    ? <Check className="h-3.5 w-3.5 text-gray-300/70" />
                    : <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
      {selectedMessage && (
        <ImageOverlay
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onStar={(id) => starMessage(chatId, id, !selectedMessage.starred)}
          onDownload={(url, mediaType) => saveMediaToGallery(url, mediaType)}
          onReply={(msg) => {
            if (onReply) onReply(msg);
            setSelectedMessage(null);
          }}
        />
      )}
    </div>
  );
}
