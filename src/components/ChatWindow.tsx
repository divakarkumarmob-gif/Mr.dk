import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, uploadMedia, subscribeToMessages } from '../services/chatService';
import { Send, Paperclip } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  timestamp: any;
}

export default function ChatWindow({ chatId, userId, isAdmin }: { chatId: string, userId: string, isAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages as Message[]);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  const handleSend = async (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
    if (!text.trim() && !mediaUrl) return;
    await sendMessage(chatId, userId, text, mediaUrl, mediaType);
    setText('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
    const path = `chats/${chatId}/${Date.now()}_${file.name}`;
    const url = await uploadMedia(file, path);
    await handleSend(url, mediaType);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => {
          const isSentByMe = m.senderId === userId;
          console.log(`DEBUG: ChatWindow -> msg: "${m.text}", senderId: "${m.senderId}", userId: "${userId}", isSentByMe: ${isSentByMe}`);
          
          return (
            <div key={m.id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-lg max-w-[80%] ${isSentByMe ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-gray-100'} shadow-md`}>
                <p className="text-sm">{m.text}</p>
                {m.mediaUrl && (
                  m.mediaType === 'image' ? <img src={m.mediaUrl} alt="media" className="max-w-full rounded mt-1" /> :
                  m.mediaType === 'video' ? <video src={m.mediaUrl} controls className="max-w-full rounded mt-1" /> :
                  <audio src={m.mediaUrl} controls className="max-w-full rounded mt-1" />
                )}
                <p className="text-[10px] text-gray-400 mt-1">{m.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 sm:p-4 bg-gray-800 flex items-center gap-2">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
        <button onClick={() => fileInputRef.current?.click()} className="shrink-0"><Paperclip size={20} /></button>
        <input value={text} onChange={e => setText(e.target.value)} className="flex-1 min-w-0 bg-gray-700 p-2 rounded text-sm" placeholder="Type a message..." />
        <button onClick={() => handleSend()} className="shrink-0"><Send size={20} /></button>
      </div>
    </div>
  );
}
