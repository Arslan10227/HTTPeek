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
  Layers,
  Clock,
  Download,
  Eye,
  Cookie,
  Code2,
  Table,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon
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
import { parseCurlCommand } from '../../utils/curlParser';
import { parseCookies } from '../panel/CookiesCard';

interface RequestComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRequest?: HttpRequest | null;
}

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
  const [bodyType, setBodyType] = useState<'raw' | 'json' | 'form' | 'graphql'>('json');
  const [body, setBody] = useState('');
  
  // GraphQL state
  const [gqlQuery, setGqlQuery] = useState('query GetUserData {\n  user(id: "123") {\n    id\n    name\n    email\n  }\n}');
  const [gqlVariables, setGqlVariables] = useState('{\n  "id": "123"\n}');

  const [activeRequestTab, setActiveRequestTab] = useState<'params' | 'headers' | 'body'>('params');
  const [activeResponseTab, setActiveResponseTab] = useState<'body' | 'headers' | 'preview' | 'cookies' | 'raw'>('body');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [curlModalOpen, setCurlModalOpen] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [imageZoom, setImageZoom] = useState(1);

  useEffect(() => {
    if (initialRequest) {
      setMethod((initialRequest.method || 'GET') as HttpMethod);
      setUrl(initialRequest.url || 'https://httpbin.org/get');

      const initialHeaders: { key: string; value: string }[] = [];
      if (initialRequest.headers) {
        Object.entries(initialRequest.headers).forEach(([k, v]) => {
          initialHeaders.push({
            key: k,
            value: Array.isArray(v) ? v.join(', ') : String(v),
          });
        });
      }
      setHeaders(initialHeaders);

      try {
        const u = new URL(initialRequest.url);
        const params: { key: string; value: string }[] = [];
        u.searchParams.forEach((v, k) => params.push({ key: k, value: v }));
        setQueryParams(params);
      } catch (_) {}

      const b = initialRequest.bodyString || initialRequest.body || '';
      setBody(b);
      if (b.trim().startsWith('{') || b.trim().startsWith('[')) {
        setBodyType('json');
      }
    }
  }, [initialRequest, isOpen]);

  // Sync GraphQL fields into body payload
  useEffect(() => {
    if (bodyType === 'graphql') {
      try {
        let varsObj = {};
        if (gqlVariables.trim()) {
          varsObj = JSON.parse(gqlVariables);
        }
        setBody(JSON.stringify({ query: gqlQuery, variables: varsObj }, null, 2));
      } catch (_) {
        setBody(JSON.stringify({ query: gqlQuery, variables: {} }, null, 2));
      }
    }
  }, [bodyType, gqlQuery, gqlVariables]);

  if (!isOpen) return null;

  const safeRenderTemplate = (str: string) => {
    try {
      return renderTemplate ? renderTemplate(str) : str;
    } catch (_) {
      return str;
    }
  };

  const updateUrlWithParams = (params: { key: string; value: string }[]) => {
    try {
      const u = new URL(url);
      u.search = '';
      params.forEach((p) => {
        if (p.key.trim()) u.searchParams.append(p.key.trim(), p.value);
      });
      setUrl(u.toString());
    } catch (_) {}
  };

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
        toast.success(`HTTP ${resp.statusCode} ${resp.statusText || ''}`);
      } else {
        // Fallback for Mobile / Web mode with EOF safe handling
        const res = await fetch('/api/composer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customReq),
        });
        const text = await res.text();
        let respData: any = null;
        if (text && text.trim().length > 0) {
          try {
            respData = JSON.parse(text);
          } catch (_) {
            respData = {
              statusCode: res.status,
              statusText: res.statusText,
              headers: {},
              bodyString: text,
              body: text,
              bodySize: text.length,
            };
          }
        } else {
          respData = {
            statusCode: res.status,
            statusText: res.statusText || 'No Content',
            headers: {},
            bodyString: '',
            body: '',
            bodySize: 0,
          };
        }
        setResponse(respData);
        toast.success(`HTTP ${respData.statusCode || res.status}`);
      }
    } catch (e: any) {
      toast.error('Request failed', e.message || String(e));
      logger.error('Composer', `Send custom request error: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCurl = () => {
    try {
      const parsed = parseCurlCommand(curlInput);
      setMethod(parsed.method as HttpMethod);
      setUrl(parsed.url);
      setHeaders(
        Object.entries(parsed.headers).map(([k, v]) => ({
          key: k,
          value: v,
        }))
      );
      setBody(parsed.body || '');
      setCurlModalOpen(false);
      toast.success('cURL Imported Successfully');
    } catch (e: any) {
      toast.error('Invalid cURL command', e.message);
    }
  };

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  // Response Content-Type and Cookies
  const respContentType = (
    response?.contentType ||
    (response?.headers && (response.headers['content-type'] || response.headers['Content-Type'])) ||
    ''
  ).toLowerCase();

  const isRespImage = respContentType.startsWith('image/');
  const isRespVideo = respContentType.startsWith('video/');
  const isRespAudio = respContentType.startsWith('audio/');
  const isRespPdf = respContentType.includes('pdf');
  const isRespHtml = respContentType.includes('html');
  const isRespJson = respContentType.includes('json') || (response?.bodyString || '').trimStart().startsWith('{');

  const respCookies = parseCookies('response', response?.headers?.['set-cookie'] || response?.headers?.['Set-Cookie']);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans text-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="h-14 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Advanced Request Composer &amp; Executor</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  GraphQL • REST • cURL
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurlModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              <span>Paste cURL</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Request Address Line */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2 shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-black text-xs bg-gray-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer shrink-0"
          >
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer transition-colors shadow-md shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Sending...' : 'Send Request'}</span>
          </button>
        </div>

        {/* Main 2-Pane Split: Left (Request Config) & Right (Response Inspector) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Request Config Pane */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-800 flex flex-col min-h-0 bg-white dark:bg-gray-900">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-1">
                {(['params', 'headers', 'body'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveRequestTab(tab)}
                    className={`px-3 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                      activeRequestTab === tab
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab === 'params' ? `Params (${queryParams.length})` : tab === 'headers' ? `Headers (${headers.length})` : 'Body'}
                  </button>
                ))}
              </div>

              {activeRequestTab === 'body' && (
                <div className="flex items-center gap-1">
                  {(['json', 'graphql', 'form', 'raw'] as const).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setBodyType(bt)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                        bodyType === bt
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                          : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto min-h-0">
              {activeRequestTab === 'params' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-1">
                    <span className="font-bold text-gray-500 text-[11px]">Query Parameters</span>
                    <button
                      type="button"
                      onClick={() => setQueryParams([...queryParams, { key: '', value: '' }])}
                      className="flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Param
                    </button>
                  </div>
                  {queryParams.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p.key}
                        onChange={(e) => {
                          const next = [...queryParams];
                          next[idx].key = e.target.value;
                          setQueryParams(next);
                          updateUrlWithParams(next);
                        }}
                        placeholder="Parameter Name"
                        className="w-1/2 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-gray-50/50 dark:bg-gray-800 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => {
                          const next = [...queryParams];
                          next[idx].value = e.target.value;
                          setQueryParams(next);
                          updateUrlWithParams(next);
                        }}
                        placeholder="Value"
                        className="flex-1 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-gray-50/50 dark:bg-gray-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = queryParams.filter((_, i) => i !== idx);
                          setQueryParams(next);
                          updateUrlWithParams(next);
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeRequestTab === 'headers' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-1">
                    <span className="font-bold text-gray-500 text-[11px]">Request Headers</span>
                    <button
                      type="button"
                      onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                      className="flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Header
                    </button>
                  </div>
                  {headers.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => {
                          const next = [...headers];
                          next[idx].key = e.target.value;
                          setHeaders(next);
                        }}
                        placeholder="Header Name (e.g. Authorization)"
                        className="w-1/2 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-gray-50/50 dark:bg-gray-800 focus:outline-none"
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
                        className="flex-1 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-gray-50/50 dark:bg-gray-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                        className="p-1.5 text-gray-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeRequestTab === 'body' && (
                <div className="flex flex-col gap-3 h-full">
                  {bodyType === 'graphql' ? (
                    <div className="flex flex-col gap-2 flex-1 min-h-[300px]">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="font-bold text-gray-500 text-[10px] uppercase">GraphQL Query / Mutation:</span>
                        <div className="flex-1 border rounded-xl overflow-hidden min-h-[140px]">
                          <Editor
                            height="100%"
                            theme={monacoTheme}
                            language="graphql"
                            value={gqlQuery}
                            onChange={(v) => setGqlQuery(v ?? '')}
                            options={{ fontSize: 11, minimap: { enabled: false } }}
                          />
                        </div>
                      </div>
                      <div className="h-32 flex flex-col gap-1">
                        <span className="font-bold text-gray-500 text-[10px] uppercase">GraphQL Variables (JSON):</span>
                        <div className="flex-1 border rounded-xl overflow-hidden">
                          <Editor
                            height="100%"
                            theme={monacoTheme}
                            language="json"
                            value={gqlVariables}
                            onChange={(v) => setGqlVariables(v ?? '')}
                            options={{ fontSize: 11, minimap: { enabled: false } }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 border rounded-2xl overflow-hidden min-h-[250px]">
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language={bodyType === 'json' ? 'json' : 'plaintext'}
                        value={body}
                        onChange={(v) => setBody(v ?? '')}
                        options={{
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono, monospace',
                          minimap: { enabled: false },
                          wordWrap: 'on',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Detailed Response Inspector Pane */}
          <div className="w-1/2 flex flex-col min-h-0 bg-slate-50/50 dark:bg-gray-950">
            {response ? (
              <>
                {/* Response Status Bar */}
                <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-white font-black text-xs ${
                        response.statusCode >= 200 && response.statusCode < 300
                          ? 'bg-emerald-600'
                          : response.statusCode >= 300 && response.statusCode < 400
                          ? 'bg-blue-600'
                          : response.statusCode >= 400 && response.statusCode < 500
                          ? 'bg-amber-600'
                          : 'bg-rose-600'
                      }`}
                    >
                      {response.statusCode}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {response.statusText || 'OK'}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      • {response.durationMs || response.duration || 0} ms
                    </span>
                  </div>

                  <span className="text-[11px] text-gray-400 font-mono">
                    {response.bodySize || response.bodyString?.length || response.body?.length || 0} bytes
                  </span>
                </div>

                {/* Response Sub-tabs */}
                <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1">
                    {(['body', 'headers', 'preview', 'cookies', 'raw'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveResponseTab(tab)}
                        className={`px-3 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                          activeResponseTab === tab
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {tab === 'cookies' ? `Cookies (${respCookies.length})` : tab}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(response.bodyString || response.body || '', 'Response Body Copied')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
                    title="Copy response body"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Response Content Area */}
                <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col">
                  {activeResponseTab === 'body' && (
                    <div className="flex-1 border rounded-2xl overflow-hidden shadow-2xs bg-white dark:bg-gray-900">
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language={isRespJson ? 'json' : isRespHtml ? 'html' : 'plaintext'}
                        value={
                          isRespJson
                            ? (() => {
                                try {
                                  return JSON.stringify(JSON.parse(response.bodyString || response.body || '{}'), null, 2);
                                } catch (_) {
                                  return response.bodyString || response.body || '';
                                }
                              })()
                            : response.bodyString || response.body || ''
                        }
                        options={{
                          readOnly: true,
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono, monospace',
                          minimap: { enabled: false },
                          wordWrap: 'on',
                        }}
                      />
                    </div>
                  )}

                  {activeResponseTab === 'headers' && (
                    <div className="flex flex-col border rounded-2xl overflow-hidden font-mono text-[11px] bg-white dark:bg-gray-900">
                      {Object.entries(response.headers || {}).map(([k, v], idx) => (
                        <div
                          key={k}
                          className={`flex items-start px-3 py-2 border-b last:border-b-0 ${
                            idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                          }`}
                        >
                          <span className="w-48 font-bold text-blue-600 dark:text-blue-400 select-text shrink-0">
                            {k}
                          </span>
                          <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all pl-2">
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeResponseTab === 'preview' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-900 rounded-2xl border overflow-auto">
                      {isRespImage ? (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={response.bodyBase64 ? `data:${response.contentType};base64,${response.bodyBase64}` : `data:${response.contentType};base64,${response.body}`}
                            alt="Preview"
                            className="max-h-80 max-w-full object-contain rounded-lg shadow-md"
                          />
                        </div>
                      ) : isRespHtml ? (
                        <iframe
                          sandbox="allow-same-origin"
                          srcDoc={response.bodyString || response.body || ''}
                          title="Preview"
                          className="w-full h-full min-h-[300px]"
                        />
                      ) : (
                        <div className="text-gray-400">Visual preview available for images and HTML documents</div>
                      )}
                    </div>
                  )}

                  {activeResponseTab === 'cookies' && (
                    <div className="flex flex-col border rounded-2xl overflow-hidden font-mono text-[11px] bg-white dark:bg-gray-900">
                      {respCookies.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No cookies returned in Set-Cookie header</div>
                      ) : (
                        respCookies.map((c, idx) => (
                          <div key={idx} className="p-3 border-b last:border-b-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-600">{c.name}</span>
                              <span className="text-gray-800 dark:text-gray-200 break-all">{c.value}</span>
                            </div>
                            {(c.domain || c.path || c.expires) && (
                              <div className="text-[10px] text-gray-400">
                                {c.domain && `Domain: ${c.domain} `}
                                {c.path && `Path: ${c.path} `}
                                {c.expires && `Expires: ${c.expires}`}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeResponseTab === 'raw' && (
                    <pre className="flex-1 p-3.5 rounded-2xl border font-mono text-[11px] bg-slate-900 text-gray-200 overflow-auto whitespace-pre-wrap select-all">
                      {`HTTP/1.1 ${response.statusCode} ${response.statusText || ''}\n${Object.entries(response.headers || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}\n\n${response.bodyString || response.body || ''}`}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs italic p-12">
                <Globe className="w-8 h-8 opacity-30 mb-2" />
                <span>Configure request and click "Send Request" to view output</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* cURL Import Dialog */}
      {curlModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-500" />
                <span>Import cURL Command</span>
              </h3>
              <button type="button" onClick={() => setCurlModalOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={curlInput}
              onChange={(e) => setCurlInput(e.target.value)}
              rows={6}
              placeholder="curl -X POST https://api.example.com/data -H 'Content-Type: application/json' -d '...'"
              className="w-full p-3 rounded-2xl border font-mono text-xs bg-gray-50 dark:bg-gray-950 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurlModalOpen(false)}
                className="px-4 py-2 rounded-xl border font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCurl}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xs"
              >
                Parse &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
