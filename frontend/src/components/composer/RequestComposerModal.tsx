import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import {
  X,
  Send,
  Plus,
  Trash2,
  FileText,
  Globe,
  Copy,
  Check,
  Terminal,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { HttpRequest, HttpResponse, HttpMethod } from '../../types';
import { useProxyStore } from '../../store/useProxyStore';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { logger } from '../../store/useLogStore';
import {
  COMMON_REQUEST_HEADERS,
  COMMON_HEADER_VALUES,
  COMPOSER_REQUEST_PRESETS,
} from '../../constants/httpTemplates';

interface RequestComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRequest?: HttpRequest | null;
}

// Parse raw cURL command into Composer structured fields
const parseCurlCommand = (curlCmd: string) => {
  let method: HttpMethod = 'GET';
  let url = '';
  const headers: { key: string; value: string }[] = [];
  let body = '';

  // Clean line continuations
  const cleaned = curlCmd.replace(/\\\r?\n/g, ' ').trim();

  // Extract Method
  const methodMatch = cleaned.match(/(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase() as HttpMethod;
  }

  // Extract Headers
  const headerRegex = /(?:-H|--header)\s+["']([^"']+)["']/g;
  let match;
  while ((match = headerRegex.exec(cleaned)) !== null) {
    const colonIdx = match[1].indexOf(':');
    if (colonIdx > 0) {
      headers.push({
        key: match[1].slice(0, colonIdx).trim(),
        value: match[1].slice(colonIdx + 1).trim(),
      });
    }
  }

  // Extract Body
  const dataMatch = cleaned.match(/(?:-d|--data|--data-raw|--data-binary)\s+["']([\s\S]*?)["'](?:\s|$)/);
  if (dataMatch) {
    body = dataMatch[1];
    if (!methodMatch) method = 'POST';
  }

  // Extract URL
  const urlMatch = cleaned.match(/curl\s+(?:-[^\s]+\s+)*(?:["'])(https?:\/\/[^"']+)(?:["'])|curl\s+(?:-[^\s]+\s+)*(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    url = urlMatch[1] || urlMatch[2] || '';
  } else {
    // Fallback URL search
    const genericUrl = cleaned.match(/https?:\/\/[^\s"']+/i);
    if (genericUrl) url = genericUrl[0];
  }

  return { method, url, headers, body };
};

export const RequestComposerModal: React.FC<RequestComposerModalProps> = ({
  isOpen,
  onClose,
  initialRequest,
}) => {
  const { renderTemplate, toggleFavorite } = useProxyStore();
  const { monacoTheme } = useThemeStore();
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [queryParams, setQueryParams] = useState<{ key: string; value: string }[]>([]);
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [curlModalOpen, setCurlModalOpen] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [copiedCurl, setCopiedCurl] = useState(false);

  const safeRenderTemplate = (text: string) => {
    try {
      if (typeof renderTemplate === 'function') {
        return renderTemplate(text);
      }
      return text;
    } catch {
      return text;
    }
  };

  const applyPreset = (presetName: string) => {
    const preset = COMPOSER_REQUEST_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;

    setMethod(preset.method as HttpMethod);
    setUrl(preset.url);
    const hList = Object.entries(preset.headers).map(([k, v]) => ({ key: k, value: v }));
    setHeaders(hList);
    setBody(preset.body);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  // Sync state whenever initialRequest changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialRequest) {
        setMethod((initialRequest.method as HttpMethod) || 'GET');
        setUrl(initialRequest.url || 'https://httpbin.org/get');

        // Headers
        const headerList = Object.entries(initialRequest.headers || {}).map(([key, val]) => ({
          key,
          value: Array.isArray(val) ? val.join(', ') : String(val),
        }));
        setHeaders(headerList.length > 0 ? headerList : [{ key: 'Content-Type', value: 'application/json' }]);

        // Body
        setBody(initialRequest.bodyString || initialRequest.body || '');

        // Query params
        try {
          const parsed = new URL(initialRequest.url.startsWith('http') ? initialRequest.url : `http://${initialRequest.url}`);
          const qList: { key: string; value: string }[] = [];
          parsed.searchParams.forEach((value, key) => {
            qList.push({ key, value });
          });
          setQueryParams(qList);
        } catch {
          setQueryParams([]);
        }
      } else {
        setMethod('GET');
        setUrl('https://httpbin.org/get');
        setHeaders([{ key: 'Content-Type', value: 'application/json' }]);
        setQueryParams([]);
        setBody('');
        setResponse(null);
      }
    }
  }, [isOpen, initialRequest]);

  const handleApplyCurl = () => {
    if (!curlInput.trim()) return;
    try {
      const parsed = parseCurlCommand(curlInput);
      if (parsed.url) setUrl(parsed.url);
      if (parsed.method) setMethod(parsed.method);
      if (parsed.headers.length > 0) setHeaders(parsed.headers);
      if (parsed.body) setBody(parsed.body);
      setCurlModalOpen(false);
      setCurlInput('');
      toast.success('cURL Imported', `${parsed.method} ${parsed.url || ''}`);
    } catch (e: any) {
      toast.error('Failed to parse cURL', e?.message);
    }
  };

  const handleCopyCurl = () => {
    const finalUrl = safeRenderTemplate(url);
    const headerFlags = headers
      .filter((h) => h.key.trim())
      .map((h) => `-H "${h.key.trim()}: ${safeRenderTemplate(h.value)}"`)
      .join(' ');
    const bodyFlag = body ? `-d '${safeRenderTemplate(body)}'` : '';
    const curl = `curl -X ${method} "${finalUrl}" ${headerFlags} ${bodyFlag}`.trim();
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
    toast.success('cURL Copied');
  };

  if (!isOpen) return null;

  const handleSend = async () => {
    setLoading(true);
    try {
      const headersMap: Record<string, string[]> = {};
      headers.forEach((h) => {
        if (h.key.trim()) {
          headersMap[h.key.trim()] = [safeRenderTemplate(h.value)];
        }
      });

      const finalUrl = safeRenderTemplate(url);
      const customReq = {
        id: 'custom-' + Date.now(),
        method,
        url: finalUrl,
        headers: headersMap,
        body: safeRenderTemplate(body),
      };

      if ((window as any).go?.main?.App?.SendCustomRequest) {
        const resp = await (window as any).go.main.App.SendCustomRequest(JSON.stringify(customReq));
        setResponse(resp);
        toast.success(`Request sent: ${resp.statusCode} ${resp.statusText}`);
      } else {
        // Fallback for Mobile / Web mode
        const res = await fetch('/api/composer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customReq),
        });
        const respData = await res.json();
        setResponse(respData);
        toast.success(`Request sent: ${respData.statusCode}`);
      }
    } catch (e: any) {
      toast.error('Request failed', e.message || String(e));
      logger.error('Composer', `Send custom request error: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (idx: number) => setHeaders(headers.filter((_, i) => i !== idx));

  const addParam = () => setQueryParams([...queryParams, { key: '', value: '' }]);
  const removeParam = (idx: number) => {
    const updated = queryParams.filter((_, i) => i !== idx);
    setQueryParams(updated);
    updateUrlWithParams(updated);
  };

  const updateParamKey = (idx: number, key: string) => {
    const updated = [...queryParams];
    updated[idx].key = key;
    setQueryParams(updated);
    updateUrlWithParams(updated);
  };

  const updateParamValue = (idx: number, value: string) => {
    const updated = [...queryParams];
    updated[idx].value = value;
    setQueryParams(updated);
    updateUrlWithParams(updated);
  };

  const updateUrlWithParams = (params: { key: string; value: string }[]) => {
    try {
      const baseUrl = String(url || '').split('?')[0];
      const search = new URLSearchParams();
      params.forEach((p) => {
        if (p.key.trim()) search.append(p.key.trim(), p.value);
      });
      const qs = search.toString();
      setUrl(qs ? `${baseUrl}?${qs}` : baseUrl);
    } catch {}
  };

  const getMethodBadge = (m: string) => {
    const methodUpper = (m || 'GET').toUpperCase();
    if (methodUpper === 'GET') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (methodUpper === 'POST') return 'bg-sky-100 text-sky-800 border-sky-300';
    if (methodUpper === 'PUT') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (methodUpper === 'DELETE') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (methodUpper === 'PATCH') return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="htk-modal-overlay select-none font-sans overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[92vh] h-[740px] my-auto flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/80 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Globe className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Request Composer &amp; Replayer</h2>
              <p className="text-[11px] text-slate-400">Craft, mutate, and send HTTP requests with variable tokens</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurlModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Import cURL</span>
            </button>
            <button
              type="button"
              onClick={handleCopyCurl}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Request Bar: Method + URL + Presets + Send Button */}
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center gap-2.5 bg-white shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className={`text-xs font-bold font-mono rounded-xl px-3 py-2 border focus:outline-none cursor-pointer ${getMethodBadge(method)}`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource or {{baseUrl}}/api"
            className="flex-1 min-w-[260px] bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 font-medium"
          />

          {/* Quick Presets Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                applyPreset(e.target.value);
                e.target.value = '';
              }
            }}
            className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-xl px-2.5 py-2 cursor-pointer focus:outline-none"
          >
            <option value="">⚡ Presets &amp; Templates...</option>
            {COMPOSER_REQUEST_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.method})
              </option>
            ))}
          </select>

          <button
            onClick={handleSend}
            disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        {/* Split View: Request Builder (Left) & Response Inspector (Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Request Builder */}
          <div className="w-1/2 border-r border-slate-200 flex flex-col overflow-hidden bg-slate-50/50">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-3 bg-white">
              <button
                onClick={() => setActiveTab('params')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'params' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Params ({queryParams.length})
              </button>
              <button
                onClick={() => setActiveTab('headers')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'headers' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Headers ({headers.length})
              </button>
              <button
                onClick={() => setActiveTab('body')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'body' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Body
              </button>
            </div>

            {/* Request Tab Contents */}
            <div className="flex-1 p-3 overflow-y-auto">
              {activeTab === 'params' && (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center font-sans">
                    <span className="text-xs font-semibold text-slate-600">Query Parameters</span>
                    <button
                      onClick={addParam}
                      className="text-xs text-emerald-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Param</span>
                    </button>
                  </div>
                  {queryParams.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 font-sans text-xs">
                      <p>No query parameters</p>
                    </div>
                  ) : (
                    queryParams.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Key"
                          value={p.key}
                          onChange={(e) => updateParamKey(idx, e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={p.value}
                          onChange={(e) => updateParamValue(idx, e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => removeParam(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'headers' && (
                <div className="space-y-2 font-mono text-xs">
                  <datalist id="common-headers-list">
                    {COMMON_REQUEST_HEADERS.map((h) => (
                      <option key={h} value={h} />
                    ))}
                  </datalist>

                  <div className="flex justify-between items-center font-sans">
                    <span className="text-xs font-semibold text-slate-600">Custom Headers</span>
                    <button
                      onClick={addHeader}
                      className="text-xs text-emerald-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Header</span>
                    </button>
                  </div>
                  {headers.map((h, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        list="common-headers-list"
                        placeholder="Header name (e.g. Content-Type)"
                        value={h.key}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[idx].key = e.target.value;
                          setHeaders(updated);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                      />
                      <input
                        type="text"
                        list={`header-vals-${idx}`}
                        placeholder="Value (e.g. application/json)"
                        value={h.value}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[idx].value = e.target.value;
                          setHeaders(updated);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id={`header-vals-${idx}`}>
                        {(COMMON_HEADER_VALUES[h.key] || []).map((val) => (
                          <option key={val} value={val} />
                        ))}
                      </datalist>
                      <button
                        onClick={() => removeHeader(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'body' && (
                <div className="h-full flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-2">Request Body</span>
                  <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden min-h-[280px]">
                    <Editor
                      height="100%"
                      language="json"
                      theme={monacoTheme}
                      value={body}
                      onChange={(val) => setBody(val || '')}
                      options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Response Inspector */}
          <div className="w-1/2 flex flex-col overflow-hidden bg-white">
            {response ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-10 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        response.statusCode >= 200 && response.statusCode < 300
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {response.statusCode} {response.statusText}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{response.durationMs}ms</span>
                    <span className="text-xs text-slate-500 font-mono">{response.bodySize} bytes</span>
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto">
                  <Editor
                    height="100%"
                    language={response.contentType?.includes('json') ? 'json' : 'plaintext'}
                    theme={monacoTheme}
                    value={response.bodyString || response.body || ''}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on' }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <FileText className="w-10 h-10 mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">No Response Yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Click Send to execute the custom request</p>
              </div>
            )}
          </div>
        </div>

        {/* cURL Import Modal */}
        {curlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Paste cURL Command</h3>
                <button onClick={() => setCurlModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={curlInput}
                onChange={(e) => setCurlInput(e.target.value)}
                placeholder={'curl -X POST https://api.example.com/data -H "Content-Type: application/json" -d \'{"foo":"bar"}\''}
                className="w-full h-40 p-3 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 bg-slate-50"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCurlModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCurl}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  Import into Composer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
