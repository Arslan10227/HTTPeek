import { api } from '../store/apiAdapter';

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class FrontendLogger {
  private initialized = false;
  private origConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // Intercept unhandled JS errors and promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Window', `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
        this.error('Window', `Unhandled Promise Rejection: ${msg}`);
      });
    }

    // Intercept console outputs and pipe to backend
    console.log = (...args: any[]) => {
      this.origConsole.log.apply(console, args);
      this.forward('INFO', 'Console', args);
    };

    console.info = (...args: any[]) => {
      this.origConsole.info.apply(console, args);
      this.forward('INFO', 'Console', args);
    };

    console.warn = (...args: any[]) => {
      this.origConsole.warn.apply(console, args);
      this.forward('WARN', 'Console', args);
    };

    console.error = (...args: any[]) => {
      this.origConsole.error.apply(console, args);
      this.forward('ERROR', 'Console', args);
    };

    console.debug = (...args: any[]) => {
      this.origConsole.debug.apply(console, args);
      this.forward('DEBUG', 'Console', args);
    };

    this.info('UI', 'Frontend logger initialized and connected to Go backend');
  }

  private isForwarding = false;

  private forward(level: LogLevel, category: string, args: any[]) {
    if (this.isForwarding) return;
    this.isForwarding = true;
    try {
      const message = args
        .map((a) => {
          if (typeof a === 'string') return a;
          if (a instanceof Error) return a.stack || a.message;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');

      api.writeLog(level, category, message).catch(() => {});
    } catch {
      // safe fallback
    } finally {
      this.isForwarding = false;
    }
  }

  public trace(category: string, message: string) {
    this.origConsole.debug(`[TRACE] [${category}]`, message);
    api.writeLog('TRACE', category, message).catch(() => {});
  }

  public debug(category: string, message: string) {
    this.origConsole.debug(`[DEBUG] [${category}]`, message);
    api.writeLog('DEBUG', category, message).catch(() => {});
  }

  public info(category: string, message: string) {
    this.origConsole.info(`[INFO] [${category}]`, message);
    api.writeLog('INFO', category, message).catch(() => {});
  }

  public warn(category: string, message: string) {
    this.origConsole.warn(`[WARN] [${category}]`, message);
    api.writeLog('WARN', category, message).catch(() => {});
  }

  public error(category: string, message: string) {
    this.origConsole.error(`[ERROR] [${category}]`, message);
    api.writeLog('ERROR', category, message).catch(() => {});
  }
}

export const logger = new FrontendLogger();
