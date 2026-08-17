import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, XCircle, PauseCircle, Plus, Trash2, Check, Sliders, FileCode, Layers } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { StatusCodePicker } from '../common/StatusCodePicker';
import { HeaderKeyCombobox, HeaderValueCombobox } from '../common/HeaderCombobox';

export const BreakpointDrawer: React.FC = () => {
  const { pausedBreakpoints, removeBreakpoint } = useProxyStore();
  const { monacoTheme } = useThemeStore();
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');

  const current = pausedBreakpoints[activeIdx] || pausedBreakpoints[0];
  const isResp = current?.type === 'response' || current?.stage === 'response';
  const req = current?.request;
  const resp = current?.response;

  const [body, setBody] = useState('');
  const [statusCode, setStatusCode] = useState(200);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (current) {
      const initialBody = isResp ? resp?.bodyString || resp?.body || '' : req?.bodyString || req?.body || '';
      setBody(initialBody);
      setStatusCode(resp?.statusCode || 200);

      const targetHeaders = isResp ? resp?.headers || {} : req?.headers || {};
      const hdrList = Object.entries(targetHeaders).map(([k, v]) => ({
        key: k,
        value: Array.isArray(v) ? v.join(', ') : String(v),
      }));
      setHeaders(hdrList);
    }
  }, [current, isResp, req, resp]);

  if (!pausedBreakpoints || pausedBreakpoints.length === 0 || !current) return null;

  const reqId = current.requestId || current.id || '';

  const handleResume = async (modified: boolean) => {
    try {
      if ((window as any).go?.main?.App?.ResumeBreakpoint) {
        if (modified) {
          const headerObj: Record<string, string> = {};
          headers.forEach((h) => {
            if (h.key.trim()) headerObj[h.key.trim()] = h.value;
          });

          const modObj = isResp
            ? { ...resp, statusCode, headers: headerObj, body }
            : { ...req, headers: headerObj, body };

          await (window as any).go.main.App.ResumeBreakpoint(reqId, isResp, JSON.stringify(modObj));
          toast.success('Resumed breakpoint with modified payload');
        } else {
          await (window as any).go.main.App.ResumeBreakpoint(reqId, isResp, '');
          toast.info('Resumed breakpoint unmodified');
        }
      }
    } catch (e: any) {
      toast.error('Resume breakpoint error', e.message || String(e));
    }
    removeBreakpoint(reqId);
  };

  const handleAbort = async () => {
    try {
      if ((window as any).go?.main?.App?.AbortBreakpoint) {
        await (window as any).go.main.App.AbortBreakpoint(reqId, isResp);
        toast.warning('Dropped paused traffic at breakpoint');
      }
    } catch (e: any) {
      toast.error('Abort breakpoint error', e.message || String(e));
    }
    removeBreakpoint(reqId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans">
      <div className="bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-900/60 rounded-2xl w-full max-w-4xl h-[700px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header with Paused Traffic Badge */}
        <div className="h-16 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-800 shrink-0">
              <PauseCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Traffic Paused at Breakpoint</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 uppercase font-bold">
                  {current.type || current.stage || 'request'}
                </span>
                {pausedBreakpoints.length > 1 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Queue: {pausedBreakpoints.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-lg font-mono">
                {req?.method} {req?.url}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAbort}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 text-rose-800 dark:text-rose-200 font-bold text-xs rounded-xl transition-colors border border-rose-200 dark:border-rose-800 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Abort &amp; Drop</span>
            </button>

            <button
              onClick={() => handleResume(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors border border-slate-200 dark:border-gray-700 cursor-pointer"
            >
              <span>Resume Unmodified</span>
            </button>

            <button
              onClick={() => handleResume(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume with Changes</span>
            </button>
          </div>
        </div>

        {/* Status Bar / Inspector Tabs */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('body')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                activeTab === 'body'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-200 dark:border-gray-700'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Payload Body Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                activeTab === 'headers'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-200 dark:border-gray-700'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Headers ({headers.length})</span>
            </button>
          </div>

          {/* Status Code Picker (for Response) */}
          {isResp && (
            <div className="flex items-center gap-2 w-64">
              <span className="font-bold text-gray-500 shrink-0">Status:</span>
              <StatusCodePicker value={statusCode} onChange={setStatusCode} />
            </div>
          )}
        </div>

        {/* Main Editor Body */}
        <div className="flex-1 p-4 overflow-hidden bg-slate-50 dark:bg-gray-950 flex flex-col min-h-0">
          {activeTab === 'body' ? (
            <div className="flex-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
              <Editor
                height="100%"
                theme={monacoTheme}
                defaultLanguage="json"
                value={body}
                onChange={(val) => setBody(val || '')}
                options={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  wordWrap: 'on',
                }}
              />
            </div>
          ) : (
            <div className="flex-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="font-bold text-xs text-gray-700 dark:text-gray-300">Live Header Editor</span>
                <button
                  type="button"
                  onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>

              {headers.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-1/3">
                    <HeaderKeyCombobox
                      value={h.key}
                      onChange={(k) => {
                        const next = [...headers];
                        next[idx].key = k;
                        setHeaders(next);
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <HeaderValueCombobox
                      headerKey={h.key}
                      value={h.value}
                      onChange={(v) => {
                        const next = [...headers];
                        next[idx].value = v;
                        setHeaders(next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                    className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
