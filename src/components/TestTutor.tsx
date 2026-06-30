import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Paperclip, Loader2 } from 'lucide-react';
import { chatWithAI } from '../services/geminiService';

interface TestTutorProps {
    result: any;
    onClose: () => void;
}

export default function TestTutor({ result, onClose }: TestTutorProps) {
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
        { role: 'model', content: `Namaste! I've analyzed your test performance. Aapne ${result.percentage || result.score || 0}% score kiya hai. Let's discuss your performance or any doubts you have!` }
    ]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!text.trim()) return;
        
        const userMsg = { role: 'user' as const, content: text };
        setMessages(prev => [...prev, userMsg]);
        setText('');
        setLoading(true);

        try {
            const reply = await chatWithAI(messages, text);
            setMessages(prev => [...prev, { role: 'model', content: reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, error aa gaya." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background z-[120] flex flex-col p-4 text-foreground">
            <div className="flex justify-between items-center mb-4">
                <button onClick={onClose}><X /></button>
                <h2 className="font-bold">Test Tutor</h2>
                <div />
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 mb-4">
                {messages.map((m, i) => (
                        <div key={i} className={`p-4 rounded-xl ${m.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-card text-card-foreground self-start border border-border'}`}>
                            <ReactMarkdown
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    u: ({node, ...props}) => <u className="text-red-500 font-bold" {...props} />
                                }}
                            >
                                {m.content}
                            </ReactMarkdown>
                        </div>
                ))}
                {loading && <Loader2 className="animate-spin text-blue-500" />}
            </div>

            <div className="flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-card text-card-foreground p-3 rounded-xl border border-border" placeholder="Kuch pucho..." />
                <button onClick={handleSend} className="bg-primary text-primary-foreground p-3 rounded-xl"><Send /></button>
            </div>
        </div>
    );
}
