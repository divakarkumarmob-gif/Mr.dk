import React, { useState } from 'react';
import { Search, MessageCircle } from 'lucide-react';

interface Props {
  chats: { id: string, participants: string[], lastMessage: string, updatedAt?: any }[];
  selectedChat: string | null;
  setSelectedChat: (chatId: string) => void;
  chatNames: Record<string, string>;
}

function getInitials(name: string) {
  if (!name || name === 'Loading...') return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-orange-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500',
  'bg-pink-500', 'bg-amber-500', 'bg-teal-500', 'bg-rose-500',
];

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(ts: any) {
  if (!ts?.toDate) return '';
  const date = ts.toDate();
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function ChatList({ chats, selectedChat, setSelectedChat, chatNames }: Props) {
  const [search, setSearch] = useState('');

  const filteredChats = chats.filter(chat => {
    const name = chatNames[chat.id] || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      <div className="p-3 border-b border-white/10 bg-[#111b21]">
        <div className="relative">
          <Search className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 px-6 text-center">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1 text-gray-600">User conversations will appear here</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 px-6 text-center">
            <p className="text-sm">No chats match "{search}"</p>
          </div>
        ) : (
          filteredChats.map(chat => {
            const name = chatNames[chat.id] || 'Loading...';
            const isSelected = selectedChat === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-white/5 transition-colors ${
                  isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${colorForId(chat.id)}`}>
                  {getInitials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white text-sm truncate">{name}</p>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{formatTime(chat.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{chat.lastMessage || 'No messages yet'}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
