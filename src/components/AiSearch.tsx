import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AiSearch() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult('');
    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 429) {
                setResult('AI quota exceeded. Please try again later.');
            } else {
                setResult(data.error || 'Error fetching AI response.');
            }
        } else {
            setResult(data.text);
        }
    } catch (e) {
        setResult('Error connecting to AI service.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-[#161e38] border border-white/10 rounded-2xl shadow-md text-white">
        <h2 className="text-lg font-bold mb-3">Ask Google AI</h2>
        <div className="flex gap-2">
            <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask NEET concepts, questions..."
                className="flex-1 p-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400"
            />
            <button onClick={handleSearch} disabled={loading} className="bg-blue-600 text-white p-2 rounded-md">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </button>
        </div>
        {result && (
            <div className="mt-4 p-3 bg-[#0a0f24] border border-white/10 rounded text-sm text-gray-200 whitespace-pre-line">
                {result}
            </div>
        )}
    </motion.div>
  );
}
