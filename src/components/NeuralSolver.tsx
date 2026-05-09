import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Trash2 } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const welcomeMessage = { role: 'assistant' as const, content: "Namaste! Main tumhara Neural Doubt Solver hoon. Study se related koi bhi sawal pucho!" };

export default function NeuralSolver({ onClose }: { onClose: () => void }) {
    const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

    useEffect(() => {
        console.log("Chat loading for user:", auth.currentUser?.uid);
        if (!auth.currentUser) return;
        const chatRef = doc(db, 'chats', auth.currentUser.uid, 'history', 'default');
        getDoc(chatRef).then(snap => {
            let msgs = [welcomeMessage];
            if (snap.exists()) {
                const loadedMessages = snap.data().messages;
                if (loadedMessages.length > 0 && loadedMessages[0].content !== welcomeMessage.content) {
                    msgs = [welcomeMessage, ...loadedMessages];
                } else if (loadedMessages.length > 0) {
                    msgs = loadedMessages;
                }
            }
            setMessages(msgs);
            if (snap.exists() && msgs.length > (snap.data().messages?.length || 0)) {
                saveChat(msgs);
            }
        }).catch(error => {
            handleFirestoreError(error, OperationType.GET, 'chats/history/default');
        });
    }, []);

    const saveChat = async (msgs: Message[]) => {
        if (!auth.currentUser) return;
        const chatRef = doc(db, 'chats', auth.currentUser.uid, 'history', 'default');
        try {
            await setDoc(chatRef, { messages: msgs });
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'chats/history/default');
        }
    };

    const deleteMessage = async (index: number) => {
        const newMessages = messages.filter((_, i) => i !== index);
        setMessages(newMessages);
        saveChat(newMessages);
        setSelectedMessageIndex(null);
    }

    const handleSend = async () => {
        if (!input.trim()) return;

        const newMessages = [...messages, { role: 'user' as const, content: input }];
        setMessages(newMessages);
        saveChat(newMessages); // Save user message
        setInput('');
        setLoading(true);

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
            const response = await fetch(`${backendUrl}/api/neural-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages })
            });

            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            const updatedMessages = [...newMessages, { role: 'assistant' as const, content: data.reply }];
            setMessages(updatedMessages);
            saveChat(updatedMessages); // Save updated history
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, error aa gaya. Study related pucho." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-4 flex flex-col text-white select-none">
            <div className="flex justify-between items-center mb-4 bg-[#161e38] p-4 rounded-xl shadow-md text-white">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold">Neural Doubt Solver</h2>
                <div />
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 mb-4 p-2" onClick={() => setSelectedMessageIndex(null)}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {selectedMessageIndex === i && i !== 0 && (
                          <button onClick={() => deleteMessage(i)} className="text-red-300 text-xs">Delete</button>
                        )}
                        <div onClick={(e) => { e.stopPropagation(); setSelectedMessageIndex(i); }} 
                             className={`p-3 px-4 rounded-2xl max-w-[80%] shadow-sm ${m.role === 'user' ? 'bg-blue-600 rounded-tr-none' : 'bg-[#161e38] rounded-tl-none'}`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {loading && <div className="self-start bg-[#161e38] p-3 rounded-2xl rounded-tl-none shadow-sm"><Loader2 className="animate-spin text-gray-500" /></div>}
            </div>

            <div className="flex gap-2 bg-[#161e38] p-3 rounded-full shadow-md">
                <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-transparent p-2 outline-none text-white" placeholder="Message..." />
                <button onClick={handleSend} className="bg-blue-600 text-white p-3 rounded-full"><Send size={20} /></button>
            </div>
        </div>
    );
}
