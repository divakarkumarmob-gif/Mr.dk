import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { initializeChat, sendMessage, uploadMedia, subscribeToMessages } from '../services/chatService';
import { Phone, Headphones } from 'lucide-react';
import { Message } from '../types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { callPhoneNumber } from '../utils/callPhone';

// TODO: replace with the real support contact number
const SUPPORT_PHONE_NUMBER = '+919999999999';

export default function UserChat({ fullScreen, user, initialScreenshot, initialText }: { fullScreen?: boolean, user: any, initialScreenshot?: string, initialText?: string }) {
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
    <div className={`flex flex-col ${fullScreen ? 'h-full flex-1 min-h-0 bg-[#0b141a]' : 'h-[500px] bg-[#0b141a] border border-white/10 rounded-xl shadow-2xl'} overflow-hidden`}>
      {/* WhatsApp-style header */}
      <div className="bg-[#1e293b] p-3 flex items-center gap-3 border-b border-white/10 flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Headphones className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">Support Chat</p>
          <p className="text-[11px] text-green-400">Usually replies within a few hours</p>
        </div>
        <button
          onClick={() => callPhoneNumber(SUPPORT_PHONE_NUMBER)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          aria-label="Call support"
        >
          <Phone className="h-5 w-5 text-green-400" />
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
  );
}
