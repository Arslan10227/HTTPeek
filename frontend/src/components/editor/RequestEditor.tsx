import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Send,
  Plus,
  Trash2,
  Copy,
  Terminal,
  Check,
  PauseCircle,
  StopCircle,
} from 'lucide-react';
import { HttpRequest, HttpResponse } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { parseCurlCommand } from '../../utils/curlParser';

export type RequestEditorSource = 'editor' | 'breakpointRequest' | 'breakpointResponse';

interface RequestEditorProps {
  request?: HttpRequest;
  response?: HttpResponse;
  source?: RequestEditorSource;
  breakpointId?: string;
  onExecuteRequest?: (req: HttpRequest) => void;
  onExecuteResponse?: (resp: HttpResponse) => void;
  onAbortBreakpoint?: () => void;
  onClose: () => void;
}

interface ParamEntry {
  key: string;
  value: string;
  enabled: boolean;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request: initialRequest,
  response: initialResponse,
  source = 'editor',
  breakpointId,
  onExecuteRequest,
  onExecuteResponse,
  onAbortBreakpoint,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const { environments, activeEnvironmentId } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [method, setMethod] = useState(initialRequest?.method || 'GET');
  const [url, setUrl] = useState(initialRequest?.url || 'https://httpbin.org/get');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'response'>('params');
  const [bodyType, setBodyType] = useState<'none' | 'form' | 'json' | 'raw'>('none');
  const [bodyContent, setBodyContent] = useState(initialRequest?.body || '');
  const [response, setResponse] = useState<HttpResponse | null>(initialResponse || null);
  const [loading, setLoading] = useState(false);

  // Params
  const [params, setParams] = useState<ParamEntry[]>(() => {
    if (!initialRequest?.url) return [];
    try {
      const urlObj = new URL(initialRequest.url);
      const list: ParamEntry[] = [];
      urlObj.searchParams.forEach((v, k) => list.push({ key: k, value: v, enabled: true }));
      return list;
    } catch (_) {
      return [];
    }
  });

  // Headers
  const [headers, setHeaders] = useState<ParamEntry[]>(() => {
    if (!initialRequest?.headers) return [{ key: 'User-Agent', value: 'ProxyPin/1.3.1', enabled: true }];
    return Object.entries(initialRequest.headers).map(([k, v]) => ({
      key: k,
      value: Array.isArray(v) ? v.join(', ') : String(v ?? ''),
      enabled: true,
    }));
  });

  const isBreakpoint =
    source === 'breakpointRequest' || source === 'breakpointResponse';

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  // Handle cURL parse using robust parseCurlCommand utility
  const handleParseCurl = (text: string) => {
    try {
      const parsed = parseCurlCommand(text);
      setUrl(parsed.url);
      setMethod(parsed.method);

      const parsedHeaders: ParamEntry[] = Object.entries(parsed.headers).map(([k, v]) => ({
        key: k,
        value: v,
        enabled: true,
      }));
      if (parsedHeaders.length > 0) setHeaders(parsedHeaders);

      if (parsed.body) {
        setBodyType(parsed.bodyType === 'json' ? 'json' : parsed.bodyType === 'form-urlencoded' ? 'form' : 'raw');
        setBodyContent(parsed.body);
      }
      toast.success(t.success, 'Parsed cURL command');
    } catch (e: any) {
      toast.error(t.fail, 'Failed to parse cURL: ' + e?.message);
    }
  };

  const handlePasteCurlFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim().startsWith('curl')) {
        handleParseCurl(text);
      } else {
        const manual = prompt('Paste your cURL command here:');
        if (manual && manual.trim().startsWith('curl')) {
          handleParseCurl(manual);
        }
      }
    } catch (_) {
      const manual = prompt('Paste your cURL command here:');
      if (manual && manual.trim().startsWith('curl')) {
        handleParseCurl(manual);
      }
    }
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      if (isBreakpoint) {
        if (source === 'breakpointRequest') {
          const req: HttpRequest = {
            id: initialRequest?.id || '',
            method,
            url,
            headers: headers.filter((h) => h.enabled).reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
            body: bodyType !== 'none' ? bodyContent : '',
            timestamp: Date.now(),
          };
          onExecuteRequest?.(req);
        } else if (source === 'breakpointResponse') {
          const resp: HttpResponse = {
            statusCode: response?.statusCode || 200,
            headers: headers.filter((h) => h.enabled).reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
            body: bodyContent,
            duration: response?.duration || 0,
          };
          onExecuteResponse?.(resp);
        }
        onClose();
        return;
      }

      // Execute normal send
      const headersMap: Record<string, string> = {};
      headers.filter((h) => h.enabled && h.key).forEach((h) => {
        headersMap[h.key] = h.value;
      });

      const startTime = performance.now();
      const res = await fetch(url, {
        method,
        headers: headersMap,
        body: ['GET', 'HEAD'].includes(method) ? undefined : (bodyType !== 'none' ? bodyContent : undefined),
      });
      const endTime = performance.now();

      const respBody = await res.text();
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });

      const httpResp: HttpResponse = {
        statusCode: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        body: respBody,
        bodySize: respBody.length,
        duration: Math.round(endTime - startTime),
      };

      setResponse(httpResp);
      setActiveTab('response');
      toast.success(t.success, `HTTP ${res.status}`);
    } catch (e: any) {
      toast.error(t.fail, e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[880px] h-[85vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {isBreakpoint ? (
              <PauseCircle className="w-4 h-4 text-orange-500 animate-pulse" />
            ) : (
              <Send className="w-4 h-4" style={{ color: activeColor.hex }} />
            )}
            <h2 className="text-sm font-semibold">
              {isBreakpoint
                ? source === 'breakpointRequest'
                  ? 'Breakpoint: Request Intercepted'
                  : 'Breakpoint: Response Intercepted'
                : 'HTTP Request Editor'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Request Line */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border font-bold text-xs bg-transparent focus:outline-none cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted.trim().startsWith('curl')) {
                e.preventDefault();
                handleParseCurl(pasted);
              }
            }}
            placeholder="https://example.com/api/v1/..."
            className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          />

          <button
            type="button"
            onClick={handlePasteCurlFromClipboard}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
            title="Paste and parse cURL command"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-500" />
            <span>Paste cURL</span>
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg font-bold text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: activeColor.hex }}
          >
            {loading ? (
              <span>Sending...</span>
            ) : isBreakpoint ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute / Resume</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t.send}</span>
              </>
            )}
          </button>

          {isBreakpoint && (
            <button
              type="button"
              onClick={() => {
                onAbortBreakpoint?.();
                onClose();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Abort</span>
            </button>
          )}
        </div>

        {/* Tab Headers */}
        <div className="flex items-center gap-4 px-4 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'params'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Query Params ({params.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'headers'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Headers ({headers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('body')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'body'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Body ({bodyType})
          </button>
          {response && (
            <button
              type="button"
              onClick={() => setActiveTab('response')}
              className={`py-2 px-1 cursor-pointer transition-colors ${
                activeTab === 'response'
                  ? 'md3-tab-active'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Response ({response.statusCode})
            </button>
          )}
        </div>

        {/* Tab Content Panes */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {/* Params Tab */}
          {activeTab === 'params' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setParams([...params, { key: '', value: '', enabled: true }])}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Param</span>
                </button>
              </div>
              <div className="flex flex-col border rounded-xl overflow-hidden font-mono text-[11px]">
                {params.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => {
                        const next = [...params];
                        next[idx].enabled = e.target.checked;
                        setParams(next);
                      }}
                      className="rounded"
                    />
                    <input
                      type="text"
                      value={p.key}
                      onChange={(e) => {
                        const next = [...params];
                        next[idx].key = e.target.value;
                        setParams(next);
                      }}
                      placeholder="Key"
                      className="w-48 px-2 py-1 border rounded bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => {
                        const next = [...params];
                        next[idx].value = e.target.value;
                        setParams(next);
                      }}
                      placeholder="Value"
                      className="flex-1 px-2 py-1 border rounded bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setParams(params.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Headers Tab */}
          {activeTab === 'headers' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>
              <div className="flex flex-col border rounded-xl overflow-hidden font-mono text-[11px]">
                {headers.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => {
                        const next = [...headers];
                        next[idx].enabled = e.target.checked;
                        setHeaders(next);
                      }}
                      className="rounded"
                    />
                    <input
                      type="text"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...headers];
                        next[idx].key = e.target.value;
                        setHeaders(next);
                      }}
                      placeholder="Header Name"
                      className="w-48 px-2 py-1 border rounded bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...headers];
                        next[idx].value = e.target.value;
                        setHeaders(next);
                      }}
                      placeholder="Header Value"
                      className="flex-1 px-2 py-1 border rounded bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body Tab */}
          {activeTab === 'body' && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === 'none'}
                    onChange={() => setBodyType('none')}
                  />
                  <span>None</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === 'json'}
                    onChange={() => setBodyType('json')}
                  />
                  <span>JSON</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === 'form'}
                    onChange={() => setBodyType('form')}
                  />
                  <span>Form URL-Encoded</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === 'raw'}
                    onChange={() => setBodyType('raw')}
                  />
                  <span>Raw</span>
                </label>
              </div>

              {bodyType !== 'none' && (
                <textarea
                  value={bodyContent}
                  onChange={(e) => setBodyContent(e.target.value)}
                  rows={14}
                  placeholder={
                    bodyType === 'json'
                      ? '{\n  "key": "value"\n}'
                      : 'key1=value1&key2=value2'
                  }
                  className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text leading-relaxed"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              )}
            </div>
          )}

          {/* Response Tab */}
          {activeTab === 'response' && response && (
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-white ${
                      response.statusCode >= 200 && response.statusCode < 300
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {response.statusCode} {response.statusText}
                  </span>
                </div>
                <div className="text-gray-400">
                  {response.duration} ms  |  {response.bodySize || (response.body ? response.body.length : 0)} B
                </div>
              </div>

              <textarea
                readOnly
                value={response.body || ''}
                rows={14}
                className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none select-text leading-relaxed"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
