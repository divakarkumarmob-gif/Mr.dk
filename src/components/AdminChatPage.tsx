import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { subscribeToSupportChats, getUserName } from '../services/chatService';
import ChatWindow from './ChatWindow';
import ChatList from './ChatList';

export default function AdminChatPage({ onBack }: { onBack: () => void }) {
    const [chats, setChats] = useState<{id: string, participants: string[], lastMessage: string}[]>([]);
    const [selectedChat, setSelectedChat] = useState<string | null>(null);
    const [chatNames, setChatNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsubscribe = subscribeToSupportChats((chatData) => {
            console.log('DEBUG: AdminChatPage received chats:', chatData);
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
        <div className="min-h-screen bg-background p-6 text-foreground">
            <button className="mb-4 text-sm text-muted-foreground" onClick={onBack}>⬅️ Back to Admin</button>
            <h1 className="text-2xl font-bold mb-4">Chat Manager</h1>
            <div className="flex gap-4 h-[70vh]">
                <ChatList chats={chats} selectedChat={selectedChat} setSelectedChat={setSelectedChat} chatNames={chatNames} />
                <div className="flex-1">
                    {selectedChat ? (
                        <ChatWindow chatId={selectedChat} userId={auth.currentUser?.uid || ''} isAdmin={true} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground bg-card rounded-lg border border-border">
                            Select a chat to view messages
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
