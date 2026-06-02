type LogEntry = { type: 'log' | 'error' | 'warn'; message: string; timestamp: string; stack?: string };

class GlobalLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  constructor() {
    this.overrideConsole();
  }

  private overrideConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: LogEntry['type'], ...args: any[]) => {
      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      
      // Prevent infinite loop if logging an error occurring during render or effect
      if (message.includes('update a component')) return;

      const stack = new Error().stack;
      const newLog: LogEntry = { type, message, timestamp: new Date().toLocaleTimeString() };
      
      if (type === 'warn' && message.includes('Database')) {
        newLog.stack = stack;
        originalLog("DEBUG: Firebase Warning Stack Trace:", stack);
      }

      this.logs.push(newLog);
      this.notifyListeners();

      if (type === 'log') originalLog(...args);
      if (type === 'error') originalError(...args);
      if (type === 'warn') originalWarn(...args);
    };

    console.log = (...args) => addLog('log', ...args);
    console.error = (...args) => addLog('error', ...args);
    console.warn = (...args) => addLog('warn', ...args);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.logs));
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener(this.logs); // Immediate update
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const globalLogger = new GlobalLogger();
