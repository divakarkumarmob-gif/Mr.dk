import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { initializeChat, sendMessage, uploadMedia, subscribeToMessages } from '../services/chatService';
import { Phone, Headphones, ArrowLeft } from 'lucide-react';
import { Message } from '../types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { callPhoneNumber } from '../utils/callPhone';

// TODO: replace with the real support contact number
const SUPPORT_PHONE_NUMBER = '+919999999999';

export default function UserChat({ fullScreen, user, initialScreenshot, initialText, onBack }: { fullScreen?: boolean, user: any, initialScreenshot?: string, initialText?: string, onBack?: () => void }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(initialText || '');
  const [preview, setPreview] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<string | null>(initialScreenshot || null);
  const [replyTarget, setReplyTarget] = useState<{ text: string; senderId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (initialText) setText(initialText);
      if (initialScreenshot) setPreview(initialScreenshot);
  }, [initialText, initialScreenshot]);

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

  const handleSend = async (textOverride?: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
    const messageText = textOverride ?? text;
    if ((!messageText.trim() && !mediaUrl) || !chatId || !user) return;

    const replyToSend = replyTarget;

    // Optimistic Update
    const optimisticMessage: Message = {
        id: Date.now().toString(),
        senderId: user.uid,
        text: messageText,
        timestamp: Timestamp.now(),
        mediaUrl,
        mediaType,
        isOptimistic: true,
        replyTo: replyToSend,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setText('');
    setReplyTarget(null);

    try {
        await sendMessage(chatId, user.uid, messageText, mediaUrl, mediaType, replyToSend);
    } catch (e) {
        // Handle send failure: Remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        console.error("Message send failed", e);
    }
  };

  const handleFileUpload = async (file: File, textOverride?: string) => {
    let currentChatId = chatId;
    if (!currentChatId && user) {
        currentChatId = await initializeChat(user.uid);
        setChatId(currentChatId);
    }
    
    if (!currentChatId) {
        alert("Chat not initialized. Please try again.");
        return;
    }
    
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
    const path = `chats/${currentChatId}/${Date.now()}_${file.name}`;
    try {
        const url = await uploadMedia(file, path);
        
        try {
            await handleSend(textOverride, url, mediaType);
        } catch (sendError) {
            console.error('[UserChat] Message send error:', sendError);
            alert('Message upload successful but failed to send. Please retry.');
        }
    } catch (uploadError) {
        console.error('[UserChat] File upload error:', uploadError);
        alert('Failed to upload file.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file, text);
  };

  return (
    <div className={`flex flex-col ${fullScreen ? 'h-full flex-1 min-h-0 bg-[#0a0f24]' : 'h-[500px] bg-[#0a0f24] border border-purple-500/25 rounded-2xl shadow-2xl'} overflow-hidden`}>
      <div className={`w-full h-full flex flex-col ${fullScreen ? 'max-w-4xl mx-auto px-1 sm:px-4' : ''}`}>
      {/* Space Neon header */}
      <div 
        className="bg-slate-900/80 backdrop-blur-xl px-4 pb-3 flex items-center gap-3 border-b border-purple-500/20 flex-shrink-0"
        style={{ paddingTop: fullScreen ? 'max(env(safe-area-inset-top, 0px), 14px)' : '14px' }}
      >
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 hover:text-white transition-all cursor-pointer border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="h-10 w-10 rounded-2xl gradient-btn-primary flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.4)]">
          <Headphones className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-white text-sm truncate bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">Technical Support</p>
          <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live AI & Human Support
          </p>
        </div>
        <button
          onClick={() => callPhoneNumber(SUPPORT_PHONE_NUMBER)}
          className="h-10 w-10 flex items-center justify-center bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 rounded-2xl transition-all cursor-pointer flex-shrink-0"
          aria-label="Call support"
        >
          <Phone className="h-5 w-5 text-purple-300" />
        </button>
      </div>

      <MessageList
        messages={messages}
        messagesEndRef={messagesEndRef}
        isLoading={loading}
        chatId={chatId || ''}
        onReply={(msg) => setReplyTarget({ text: msg.text || 'Media message', senderId: msg.senderId })}
      />
      <MessageInput
        text={text}
        setText={setText}
        handleSend={handleSend}
        handleFileChange={handleFileChange}
        handleFileUpload={handleFileUpload}
        preview={preview}
        setPreview={setPreview}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />
      </div>
    </div>
  );
}

