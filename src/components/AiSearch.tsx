import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, Loader2, History, Camera } from 'lucide-react';
import { motion } from 'motion/react';

export default function AiSearch({ onFocus }: { onFocus?: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{prompt: string, result: string, timestamp: number}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('searchHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [historyRef]);

  const saveToHistory = (p: string, r: string) => {
    const newItem = { prompt: p, result: r, timestamp: Date.now() };
    const newHistory = [newItem, ...history.filter(item => item.prompt !== p)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult('');
    setSources([]);
    setShowSources(false);
    setShowHistory(false);
    try {
        const response = await fetch('/api/search-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, base64Image })
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResult = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; 
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.sources) {
                          setSources(parsed.sources);
                        } else if (parsed.content) {
                            accumulatedResult += parsed.content;
                            setResult(accumulatedResult);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for incomplete chunks
                    }
                }
            }
        }
        saveToHistory(prompt, accumulatedResult);
    } catch (e) {
        setResult('Error connecting to AI service.');
    } finally {
        setLoading(false);
    }
  };


  return (
    <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl p-[3px] overflow-hidden shadow-md"
    >
        {/* Border effect */}
        <div 
            className={`absolute -inset-[2px] rounded-[18px] ${loading ? 'animate-[spin_2s_linear_infinite]' : ''}`}
            style={{ 
                background: 'conic-gradient(from 0deg, #ef4444 0deg 90deg, #22c55e 90deg 180deg, #3b82f6 180deg 270deg, #eab308 270deg 360deg)',
                opacity: loading ? 1 : 0.2
            }} 
        />
        
        {/* Inner content */}
        <div className="relative p-4 bg-[#161e38] rounded-xl text-white">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">Ask Google AI</h2>
            <button onClick={() => setShowHistory(!showHistory)} className="text-gray-400 hover:text-white">
                <History className="h-5 w-5" />
            </button>
        </div>
        
        {showHistory && (
            <motion.div ref={historyRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute z-10 w-[calc(100%-2rem)] mt-2 p-3 bg-[#1e2a4a] border border-white/10 rounded-lg shadow-xl text-sm max-h-48 overflow-y-auto">
                <h3 className="font-bold mb-2">History</h3>
                {history.map((item, i) => (
                    <button key={i} onClick={() => { setPrompt(item.prompt); setResult(item.result); setShowHistory(false); }} className="w-full text-left p-2 hover:bg-white/10 rounded truncate">
                        {item.prompt}
                    </button>
                ))}
            </motion.div>
        )}

        {base64Image && (
            <div className="relative inline-block mt-2 mb-2">
                <img src={base64Image} alt="Selected" className="h-16 w-16 object-cover rounded-md" />
                <button onClick={() => setBase64Image(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white">
                    <span className="text-xs font-bold px-1">x</span>
                </button>
            </div>
            )}
            <div className="flex gap-2">
            <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={onFocus}
                placeholder="Ask NEET concepts, questions..."
                className="flex-1 p-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400"
            />
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                   const reader = new FileReader();
                   reader.onloadend = () => setBase64Image(reader.result as string);
                   reader.readAsDataURL(e.target.files[0]);
                }
            }} />
            <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-md ${base64Image ? 'text-blue-500' : 'text-gray-400'} hover:text-white`}>
                <Camera className="h-5 w-5" />
            </button>
            <button onClick={handleSearch} disabled={loading} className="bg-blue-600 text-white p-2 rounded-md">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </button>
        </div>
        {sources.length > 0 && (
          <div className="mt-4 text-xs text-blue-300">
            <button onClick={() => setShowSources(!showSources)} className="font-bold underline hover:text-blue-200">
                Sources {showSources ? '▲' : '▼'}
            </button>
            {showSources && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {sources.map((s, index) => (
                        <a key={index} href={s.url} target="_blank" rel="noopener noreferrer" className="mr-2 hover:underline">
                            [{index}] {s.title}
                        </a>
                    ))}
                </div>
            )}
          </div>
        )}
        {result && (
            <div className="mt-4 p-3 bg-[#0a0f24] border border-white/10 rounded text-sm text-gray-200">
                <ReactMarkdown>{result}</ReactMarkdown>
            </div>
        )}
        </div>
    </motion.div>
  );
}
