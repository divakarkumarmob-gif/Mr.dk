import React from 'react';
import { Message } from '../types';
import { auth } from '../lib/firebase';

interface Props {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export default function MessageList({ messages, messagesEndRef, isLoading }: Props & { isLoading?: boolean }) {
  if (isLoading) {
    return <div className="flex-1 p-4 text-center text-gray-400">Loading messages...</div>;
  }
  
  if (messages.length === 0) {
    return <div className="flex-1 p-4 text-center text-gray-400">No messages yet. Start the conversation!</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map(m => {
        const currentUserUid = auth.currentUser?.uid;
        const isMe = m.senderId === currentUserUid;
        console.log(`DEBUG: MessageList -> msg: "${m.text}", senderId: "${m.senderId}", currentUserUid: "${currentUserUid}", isMe: ${isMe}`);
        return (
          <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-[75%] ${isMe ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-white'} shadow-md`}>
              <p className="text-sm">{m.text}</p>
              {m.mediaUrl && (
                m.mediaType === 'image' ? <img src={m.mediaUrl} alt="media" className="max-w-full rounded mt-1" /> :
                m.mediaType === 'video' ? <video src={m.mediaUrl} controls className="max-w-full rounded mt-1" /> :
                <audio src={m.mediaUrl} controls className="max-w-full rounded mt-1" />
              )}
              <p className="text-[10px] text-gray-300 mt-1">{m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}</p>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
