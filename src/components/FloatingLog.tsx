import React, { useState, useEffect } from 'react';

export const FloatingLog: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        setLogs(data.logs);
      } catch (e) {
        console.error("Failed to fetch logs", e);
      }
    };
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <button 
        onClick={() => setVisible(!visible)}
        className='bg-blue-500 text-white p-2 rounded-full'
      >
        {visible ? 'Hide Logs' : 'Show Logs'}
      </button>
      {visible && (
        <div className='bg-gray-800 text-white p-4 mt-2 h-64 overflow-y-auto w-80 rounded-md'>
          {logs.map((log, index) => <div key={index} className='text-xs border-b border-gray-600'>{log}</div>)}
        </div>
      )}
    </div>
  );
};
