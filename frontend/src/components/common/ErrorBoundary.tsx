import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
    try {
      if ((window as any).go?.main?.App?.WriteLog) {
        (window as any).go.main.App.WriteLog(
          'ERROR',
          'React',
          `UI Render Error: ${error.message}\nStack: ${errorInfo.componentStack}`
        );
      }
    } catch (_) {}
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans select-none">
          <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-xl flex flex-col items-center text-center gap-4">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold">Something went wrong</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>

            {this.state.errorInfo && (
              <pre className="w-full p-3 bg-gray-100 dark:bg-gray-950 rounded-lg text-[10px] font-mono text-left overflow-auto max-h-32 text-gray-700 dark:text-gray-300">
                {this.state.errorInfo.componentStack}
              </pre>
            )}

            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
