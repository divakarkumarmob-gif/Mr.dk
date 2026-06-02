import React, { useState, useEffect } from 'react';
import { globalLogger } from '../lib/globalLogger';

export const LogViewer = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return globalLogger.subscribe(setLogs);
  }, []);

  const copyToClipboard = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('Logs copied!');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-800 text-white p-2 rounded text-xs"
      >
        Logs
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 h-96 bg-gray-900 border border-gray-700 rounded shadow-xl flex flex-col">
      <div className="flex justify-between items-center p-2 border-b border-gray-700 bg-gray-800">
        <h2 className="text-white text-sm font-bold">Debug Logs</h2>
        <div className="flex gap-2">
            <button onClick={copyToClipboard} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Copy</button>
            <button onClick={() => setIsOpen(false)} className="text-xs text-white">X</button>
        </div>
      </div>
      <div className="flex-grow overflow-auto p-2 text-[10px] text-white">
        {logs.map((log, i) => (
          <div key={i} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-gray-300'}`}>
            [{log.timestamp}] {log.message}
            {log.stack && <pre className="text-[8px] bg-black p-1 mt-1">{log.stack}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
};
