import React from 'react';

interface Props {
  chats: {id: string, participants: string[], lastMessage: string}[];
  selectedChat: string | null;
  setSelectedChat: (chatId: string) => void;
  chatNames: Record<string, string>;
}

export default function ChatList({ chats, selectedChat, setSelectedChat, chatNames }: Props) {
  if (chats.length === 0) {
    return <div className="w-1/3 p-4 text-gray-400 text-sm">No chats found.</div>;
  }

  return (
    <div className="w-1/3 bg-[#161e38] rounded-lg overflow-y-auto border border-white/10">
      {chats.map(chat => (
        <button key={chat.id} onClick={() => setSelectedChat(chat.id)} className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 ${selectedChat === chat.id ? 'bg-white/10' : ''}`}>
          <p className="font-bold">{chatNames[chat.id] || 'Loading...'}</p>
          <p className="text-sm text-gray-400 truncate">{chat.lastMessage}</p>
        </button>
      ))}
    </div>
  );
}
