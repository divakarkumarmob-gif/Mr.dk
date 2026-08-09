import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Paperclip, Loader2, Bot } from 'lucide-react';
import { chatWithAI } from '../services/geminiService';

interface TestTutorProps {
    result: any;
    onClose: () => void;
}

export default function TestTutor({ result, onClose }: TestTutorProps) {
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
        { role: 'model', content: `Namaste! I've analyzed your test performance. Aapne **${result.percentage || result.score || 0}%** score kiya hai. Let's discuss your performance or any doubts you have!` }
    ]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!text.trim() || loading) return;
        
        const userMsg = { role: 'user' as const, content: text };
        setMessages(prev => [...prev, userMsg]);
        setText('');
        setLoading(true);

        try {
            const reply = await chatWithAI(messages, text);
            setMessages(prev => [...prev, { role: 'model', content: reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, error aa gaya. Study related pucho." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[120] flex flex-col p-4 text-white select-none backdrop-blur-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 bg-slate-900/80 border border-purple-500/25 p-3.5 px-5 rounded-2xl shadow-lg backdrop-blur-xl">
                <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer">
                    <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300">
                        <Bot className="h-5 w-5" />
                    </div>
                    <h2 className="font-extrabold text-base sm:text-lg text-white">AI Test Tutor</h2>
                </div>
                <div className="w-8" />
            </div>

            {/* Chat List */}
            <div className="flex-grow overflow-y-auto space-y-3.5 mb-4 p-2">
                {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-md border text-sm sm:text-base leading-relaxed ${
                            m.role === 'user' 
                                ? 'gradient-btn-primary text-white rounded-tr-none shadow-[0_0_15px_rgba(139,92,246,0.3)]' 
                                : 'bg-slate-900/80 border-purple-500/20 text-slate-100 rounded-tl-none backdrop-blur-xl'
                        }`}>
                            <ReactMarkdown
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    u: ({node, ...props}) => <u className="text-pink-400 font-bold" {...props} />
                                }}
                            >
                                {m.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex items-center gap-2 p-3 bg-slate-900/60 rounded-2xl border border-purple-500/20 self-start text-purple-300 text-xs font-semibold">
                        <Loader2 className="animate-spin h-4 w-4 text-purple-400" /> AI Tutor is thinking...
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl p-2.5 px-4 rounded-3xl border border-purple-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <input 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    className="flex-1 bg-transparent px-2 py-1 outline-none text-white text-sm sm:text-base placeholder-slate-400" 
                    placeholder="Ask AI Tutor about this test..." 
                />
                <button 
                    onClick={handleSend} 
                    disabled={!text.trim() || loading}
                    className="gradient-btn-primary p-3 rounded-2xl shadow-lg disabled:opacity-40 cursor-pointer flex items-center justify-center"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
