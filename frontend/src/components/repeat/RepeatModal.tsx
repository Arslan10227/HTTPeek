import React, { useState } from 'react';
import { X, Play, RotateCw, CheckCircle, XCircle } from 'lucide-react';
import { HttpRequest } from '../../types';

interface RepeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: HttpRequest | null;
}

export const RepeatModal: React.FC<RepeatModalProps> = ({
  isOpen,
  onClose,
  request,
}) => {
  const [count, setCount] = useState(10);
  const [intervalMs, setIntervalMs] = useState(100);
  const [concurrent, setConcurrent] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  if (!isOpen || !request) return null;

  const startRepeat = async () => {
    setRunning(true);
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setResults([]);

    const executeRequest = async (i: number) => {
      const startTime = Date.now();
      const result = await (async () => {
        try {
          if ((window as any).go?.main?.App?.ReplayRequest) {
            return await (window as any).go.main.App.ReplayRequest(request);
          }
          return null;
        } catch (e: any) {
          return { error: e.message };
        }
      })();
      
      const duration = Date.now() - startTime;
      
      const isError = !result || result.error || (result.statusCode && result.statusCode >= 400);
      
      if (isError) {
        setErrorCount((prev) => prev + 1);
      } else {
        setSuccessCount((prev) => prev + 1);
      }
      
      setResults(prev => [...prev, { ...result, index: i + 1, duration, isError }]);
      setProgress(prev => prev + 1);
    };

    if (concurrent) {
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(executeRequest(i));
      }
      await Promise.all(promises);
    } else {
      for (let i = 0; i < count; i++) {
        await executeRequest(i);
        if (intervalMs > 0 && i < count - 1) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
    }

    setRunning(false);
  };

  return (
    <div className="htk-modal-overlay font-sans">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh]">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <RotateCw className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">Repeat Request (Batch Runner)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-hidden">
          {/* Target Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 shrink-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                {request.method}
              </span>
              <span className="text-xs font-mono text-slate-800 truncate font-semibold" title={request.url}>
                {request.url}
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-3 gap-3 text-xs shrink-0">
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Repeat Count</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={running}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Interval Delay (ms)</label>
              <input
                type="number"
                min="0"
                step="50"
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                disabled={running || concurrent}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1 flex flex-col justify-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-semibold">
                <input
                  type="checkbox"
                  checked={concurrent}
                  onChange={(e) => setConcurrent(e.target.checked)}
                  disabled={running}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Concurrent Execution
              </label>
            </div>
          </div>

          {/* Progress Bar */}
          {(progress > 0 || running) && (
            <div className="space-y-2 shrink-0">
              <div className="flex justify-between text-xs text-slate-600 font-semibold">
                <span>Progress: {progress} / {count}</span>
                <div className="flex gap-3">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {successCount}
                  </span>
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {errorCount}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-2 transition-all duration-150"
                  style={{ width: `${(progress / count) * 100}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={startRepeat}
            disabled={running}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{running ? 'Running Requests...' : 'Start Repeat'}</span>
          </button>

          {/* Results Table */}
          {results.length > 0 && (
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg min-h-[200px]">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600">#</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-right">Time</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((res, idx) => (
                    <tr key={idx} className={res.isError ? 'bg-rose-50/50 text-rose-700' : 'text-slate-700 hover:bg-slate-50'}>
                      <td className="px-3 py-1.5">{res.index}</td>
                      <td className="px-3 py-1.5 font-bold">
                        {res.error ? 'Error' : res.statusCode}
                      </td>
                      <td className="px-3 py-1.5 text-right">{res.duration}ms</td>
                      <td className="px-3 py-1.5 text-right">
                        {res.body ? (res.body.length / 1024).toFixed(1) + ' KB' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
