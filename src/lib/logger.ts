import { useState, useEffect, useRef } from 'react';

type LogEntry = { type: 'log' | 'error' | 'warn'; message: string; timestamp: string };

export const useLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Use a ref to buffer logs so we don't have to trigger re-renders instantly
  const logBuffer = useRef<LogEntry[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: LogEntry['type'], ...args: any[]) => {
      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      
      // Prevent infinite loop if logging an error occurring during render or effect
      if (message.includes('update a component')) return;

      const newLog = { type, message, timestamp: new Date().toLocaleTimeString() };
      logBuffer.current.push(newLog);
      setLogs([...logBuffer.current]); // Update state with the buffer

      if (type === 'log') originalLog(...args);
      if (type === 'error') originalError(...args);
      if (type === 'warn') originalWarn(...args);
    };

    console.log = (...args) => addLog('log', ...args);
    console.error = (...args) => addLog('error', ...args);
    console.warn = (...args) => addLog('warn', ...args);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return logs;
};
