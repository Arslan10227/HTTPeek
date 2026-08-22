import { create } from 'zustand';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'RULE' | 'SSL' | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (level: LogLevel, category: string, message: string, details?: any) => void;
  clearLogs: () => void;
  exportLogs: () => void;
}

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [
    {
      id: `log_init_${Date.now()}`,
      timestamp: new Date(),
      level: 'SYSTEM',
      category: 'Core',
      message: 'HTTPeek logging system initialized',
    },
  ],

  addLog: (level: LogLevel, category: string, message: string, details?: any) => {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details,
    };

    set((state) => ({
      logs: [...state.logs.slice(-999), entry], // Keep up to 1000 logs in memory
    }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  exportLogs: () => {
    const { logs } = get();
    const logText = logs
      .map(
        (l) =>
          `[${l.timestamp.toISOString()}] [${l.level.padEnd(6)}] [${l.category}] ${l.message}${
            l.details ? ` | Details: ${JSON.stringify(l.details)}` : ''
          }`
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `httpeek_system_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));

// Quick global logger helper
export const logger = {
  debug: (category: string, message: string, details?: any) => useLogStore.getState().addLog('DEBUG', category, message, details),
  info: (category: string, message: string, details?: any) => useLogStore.getState().addLog('INFO', category, message, details),
  warn: (category: string, message: string, details?: any) => useLogStore.getState().addLog('WARN', category, message, details),
  error: (category: string, message: string, details?: any) => useLogStore.getState().addLog('ERROR', category, message, details),
  rule: (category: string, message: string, details?: any) => useLogStore.getState().addLog('RULE', category, message, details),
  ssl: (category: string, message: string, details?: any) => useLogStore.getState().addLog('SSL', category, message, details),
  system: (category: string, message: string, details?: any) => useLogStore.getState().addLog('SYSTEM', category, message, details),
};
