import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { subscribeToSupportChats, getUserName } from '../services/chatService';
import ChatWindow from './ChatWindow';
import ChatList from './ChatList';

export default function AdminChatPage({ onBack }: { onBack: () => void }) {
    const [chats, setChats] = useState<{ id: string, participants: string[], lastMessage: string, updatedAt?: any }[]>([]);
    const [selectedChat, setSelectedChat] = useState<string | null>(null);
    const [chatNames, setChatNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const handlePop = () => {
            const state = window.history.state;
            if (selectedChat && !state?.chatId) {
                setSelectedChat(null);
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [selectedChat]);

    const handleSelectChat = (id: string | null) => {
        if (id) {
            window.history.pushState({ ...window.history.state, chatId: id }, '', window.location.href);
        } else if (selectedChat) {
            window.history.back();
        }
        setSelectedChat(id);
    };

    useEffect(() => {
        const unsubscribe = subscribeToSupportChats((chatData) => {
            setChats(chatData);
            chatData.forEach(async (chat) => {
                const userId = chat.id; // As seen in UserChat.tsx, the chat ID is the user UID
                if (userId === 'admin') return;
                const name = await getUserName(userId);
                setChatNames(prev => ({ ...prev, [chat.id]: name }));
            });
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="h-dvh bg-[#0f172a] text-white flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 5px)' }}>
            {/* Mobile: show either list or chat window, WhatsApp style */}
            <div className="flex-1 flex overflow-hidden">
                {/* List panel */}
                <div className={`
                    w-full sm:w-[340px] sm:flex-shrink-0 sm:border-r sm:border-white/10
                    ${selectedChat ? 'hidden sm:block' : 'block'}
                `}>
                    <ChatList chats={chats} selectedChat={selectedChat} setSelectedChat={handleSelectChat} chatNames={chatNames} />
                </div>

                {/* Chat window panel */}
                <div className={`
                    flex-1 min-w-0
                    ${selectedChat ? 'block' : 'hidden sm:block'}
                `}>
                    {selectedChat ? (
                        <ChatWindow
                            chatId={selectedChat}
                            userId={auth.currentUser?.uid || ''}
                            isAdmin={true}
                            contactName={chatNames[selectedChat]}
                            onBack={() => handleSelectChat(null)}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-[#0b141a] px-6 text-center">
                            <p className="text-sm">Select a chat to view messages</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
