import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, uploadMedia, subscribeToMessages, starMessage, getUserPhone, subscribeToUserPresence } from '../services/chatService';
import { Send, Paperclip, Loader2, Phone, Reply, X, Check, CheckCheck, Star } from 'lucide-react';
import ImageOverlay from './ImageOverlay';
import { saveMediaToGallery } from '../utils/saveMediaToGallery';
import { callPhoneNumber } from '../utils/callPhone';
import { formatPresence } from '../utils/formatPresence';

interface Message {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  timestamp: any;
  starred?: boolean;
  replyTo?: { text: string; senderId: string } | null;
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ChatWindow({
  chatId,
  userId,
  isAdmin,
  contactName,
  onBack
}: {
  chatId: string;
  userId: string;
  isAdmin: boolean;
  contactName?: string;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ online: boolean; lastSeen: any }>({ online: false, lastSeen: null });
  const [replyTarget, setReplyTarget] = useState<{ text: string; senderId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [touchTimer, setTouchTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages as Message[]);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    // chatId doubles as the target user's UID for support chats
    if (chatId) {
      getUserPhone(chatId).then(setContactPhone);
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = subscribeToUserPresence(chatId, setPresence);
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  const handleSend = async (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
    if (!text.trim() && !mediaUrl) return;
    const toSend = text;
    const replyToSend = replyTarget;
    setText('');
    setReplyTarget(null);
    await sendMessage(chatId, userId, toSend, mediaUrl, mediaType, replyToSend);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
      const path = `chats/${chatId}/${Date.now()}_${file.name}`;
      const url = await uploadMedia(file, path);
      await handleSend(url, mediaType);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTouchStart = (m: any) => {
    const timer = setTimeout(() => {
        setSelectedMessage(m);
    }, 500);
    setTouchTimer(timer);
  };

  const handleTouchEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1e293b] border-b border-white/10 flex-shrink-0">
        <div className="h-9 w-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {getInitials(contactName || '')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{contactName || 'User'}</p>
          <p className={`text-[11px] ${presence.online ? 'text-green-400' : 'text-gray-400'}`}>
            {formatPresence(presence.online, presence.lastSeen)}
          </p>
        </div>
        <button
          onClick={() => callPhoneNumber(contactPhone)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          aria-label="Call user"
        >
          <Phone className="h-5 w-5 text-green-400" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }}
      >
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No messages yet. Say hello 👋
          </div>
        )}
        {messages.map(m => {
          const isSentByMe = m.senderId === userId;
          return (
            <div key={m.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`px-3 py-2 rounded-2xl max-w-[80%] sm:max-w-[65%] shadow-md relative ${
                  isSentByMe
                    ? 'bg-[#005c4b] text-white rounded-br-sm'
                    : 'bg-[#202c33] text-gray-100 rounded-bl-sm'
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

                {m.text && <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>}
                {m.mediaUrl && (
                  m.mediaType === 'image' ? (
                    <img 
                        src={m.mediaUrl} 
                        alt="media" 
                        className="max-w-full max-h-72 w-auto h-auto object-contain rounded-lg mt-1 cursor-pointer"
                    />
                  ) :
                  m.mediaType === 'video' ? <video src={m.mediaUrl} controls className="max-w-full max-h-72 rounded-lg mt-1" /> :
                  <audio src={m.mediaUrl} controls className="max-w-full mt-1" />
                )}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <p className="text-[10px] text-gray-300/70">
                    {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                  {isSentByMe && <CheckCheck className="h-3.5 w-3.5 text-sky-300" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {selectedMessage && (
        <ImageOverlay 
          message={selectedMessage} 
          onClose={() => setSelectedMessage(null)}
          onStar={(id) => starMessage(chatId, id, !selectedMessage.starred)}
          onDownload={(url, mediaType) => saveMediaToGallery(url, mediaType)}
          onReply={(msg) => {
            setReplyTarget({ text: msg.text || 'Media message', senderId: msg.senderId });
            setSelectedMessage(null);
          }}
        />
      )}

      {/* Input bar */}
      <div className="p-2.5 sm:p-3 bg-[#1e293b] flex flex-col gap-1.5 flex-shrink-0 border-t border-white/10">
        {replyTarget && (
          <div className="flex items-center gap-2 bg-white/5 border-l-2 border-green-400 rounded-lg px-3 py-2">
            <Reply className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <p className="flex-1 min-w-0 text-xs text-gray-300 truncate">{replyTarget.text}</p>
            <button onClick={() => setReplyTarget(null)} className="text-gray-400 hover:text-white flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 p-2 text-gray-300 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </button>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 placeholder:text-gray-500"
            placeholder="Type a message..."
          />
          <button
            onClick={() => handleSend()}
            disabled={!text.trim()}
            className="shrink-0 h-10 w-10 flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
