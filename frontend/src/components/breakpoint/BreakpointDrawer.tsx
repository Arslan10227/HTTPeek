import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, XCircle } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { ColorfulIcon } from '../common/ColorfulIcon';

export const BreakpointDrawer: React.FC = () => {
  const { pausedBreakpoints, removeBreakpoint } = useProxyStore();
  const { monacoTheme } = useThemeStore();
  const [activeIdx] = useState(0);

  if (pausedBreakpoints.length === 0) return null;

  const current = pausedBreakpoints[activeIdx] || pausedBreakpoints[0];
  const isResp = current.type === 'response';
  const req = current.request;
  const resp = current.response;

  const [body, setBody] = useState(isResp ? resp?.body || '' : req?.body || '');

  const reqId = current.requestId || current.id || '';

  const handleResume = async (modified: boolean) => {
    try {
      if (window.go?.main?.App?.ResumeBreakpoint) {
        if (modified) {
          const modObj = isResp ? { ...resp, body } : { ...req, body };
          await window.go.main.App.ResumeBreakpoint(reqId, isResp, JSON.stringify(modObj));
          toast.success("Resumed breakpoint with modified payload");
        } else {
          await window.go.main.App.ResumeBreakpoint(reqId, isResp, '');
          toast.info("Resumed breakpoint unmodified");
        }
      }
    } catch (e: any) {
      toast.error("Resume breakpoint error", e.message || String(e));
    }
    removeBreakpoint(reqId);
  };

  const handleAbort = async () => {
    try {
      if (window.go?.main?.App?.AbortBreakpoint) {
        await window.go.main.App.AbortBreakpoint(reqId, isResp);
        toast.warning("Dropped paused traffic at breakpoint");
      }
    } catch (e: any) {
      toast.error("Abort breakpoint error", e.message || String(e));
    }
    removeBreakpoint(reqId);
  };

  return (
    <div className="htk-modal-overlay select-none font-sans">
      <div className="bg-white border border-rose-300 rounded-2xl w-full max-w-3xl h-[650px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header with Paused Warning */}
        <div className="h-16 bg-rose-50 border-b border-rose-200 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-rose-100/80 rounded-xl border border-rose-200 shrink-0">
              <ColorfulIcon name="stop" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Traffic Paused at Breakpoint</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-800 border border-rose-200 uppercase font-bold">
                  {current.type}
                </span>
              </h2>
              <p className="text-[11px] text-slate-600 truncate max-w-md font-mono">{req?.url}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAbort}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl transition-colors border border-rose-200 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Abort & Drop</span>
            </button>

            <button
              onClick={() => handleResume(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors border border-slate-200 cursor-pointer"
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

        {/* Inline Body Editor */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 font-sans">
              Edit {isResp ? 'Response' : 'Request'} Payload:
            </span>
            <span className="text-[11px] text-slate-500 font-mono font-bold">
              Status: {resp?.statusCode || req?.method}
            </span>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
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
        </div>
      </div>
    </div>
  );
};
