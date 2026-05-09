import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function NeuralSolver({ onClose }: { onClose: () => void }) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Namaste! Main tumhara Neural Doubt Solver hoon. Study se related koi bhi sawal pucho!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const newMessages = [...messages, { role: 'user' as const, content: input }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const backendUrl = "https://mrdk.onrender.com";
            const response = await fetch(`${backendUrl}/api/neural-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages })
            });

            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, error aa gaya. Study related pucho." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-4 flex flex-col text-white">
            <div className="flex justify-between items-center mb-4">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold">Neural Doubt Solver</h2>
                <div />
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 mb-4">
                {messages.map((m, i) => (
                    <div key={i} className={`p-4 rounded-xl ${m.role === 'user' ? 'bg-blue-600 self-end' : 'bg-[#161e38] self-start'}`}>
                        {m.content}
                    </div>
                ))}
                {loading && <Loader2 className="animate-spin text-blue-500" />}
            </div>

            <div className="flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-[#161e38] p-3 rounded-xl" placeholder="Kuch pucho..." />
                <button onClick={handleSend} className="bg-blue-600 p-3 rounded-xl"><Send /></button>
            </div>
        </div>
    );
}
