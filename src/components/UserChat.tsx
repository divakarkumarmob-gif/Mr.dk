import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { initializeChat, sendMessage, uploadMedia, subscribeToMessages } from '../services/chatService';
import { User } from 'lucide-react';
import { Message } from '../types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function UserChat({ fullScreen, user }: { fullScreen?: boolean, user: any }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;
    
    initializeChat(userId).then(setChatId).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
        setMessages(newMessages);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    const scroll = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    // Use requestAnimationFrame to ensure rendering is complete before scrolling
    requestAnimationFrame(scroll);
  }, [messages]);

  const handleSend = async (mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
    if ((!text.trim() && !mediaUrl) || !chatId || !user) return;

    // Optimistic Update
    const optimisticMessage: Message = {
        id: Date.now().toString(),
        senderId: user.uid,
        text: text,
        timestamp: Timestamp.now(),
        mediaUrl,
        mediaType,
        isOptimistic: true
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setText(''); 

    try {
        await sendMessage(chatId, user.uid, text, mediaUrl, mediaType);
    } catch (e) {
        // Handle send failure: Remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        console.error("Message send failed", e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
    const path = `chats/${chatId}/${Date.now()}_${file.name}`;
    try {
        const url = await uploadMedia(file, path);
        await handleSend(url, mediaType);
    } catch (error) {
        console.error('File upload error', error);
    }
  };

  return (
    <div className={`flex flex-col ${fullScreen ? 'h-screen' : 'h-[500px]'} bg-[#0c1317] border border-white/10 rounded-xl overflow-hidden shadow-2xl`}>
      <div className="bg-[#1f2c34] p-3 text-white font-bold flex items-center justify-end gap-2">
        <User size={20} /> Support Chat
      </div>
      <MessageList messages={messages} messagesEndRef={messagesEndRef} isLoading={loading} />
      <MessageInput text={text} setText={setText} handleSend={handleSend} handleFileChange={handleFileChange} />
    </div>
  );
}
