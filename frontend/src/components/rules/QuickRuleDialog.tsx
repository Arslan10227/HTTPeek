import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Sliders, 
  Globe, 
  PauseCircle, 
  Code2, 
  Plus, 
  Trash2, 
  Save, 
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
  Play,
  Copy,
  Clock,
  Ban,
  AlignLeft,
  Braces
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { HttpRequest, RuleActionType, UrlMatchType, HttpBodyType, FormDataEntry } from '../../types';
import { StatusCodePicker } from '../common/StatusCodePicker';
import { HeaderKeyCombobox, HeaderValueCombobox } from '../common/HeaderCombobox';
import { HttpMethodPicker } from '../common/HttpMethodPicker';
import { MOCK_RESPONSE_TEMPLATES } from '../../constants/httpTemplates';
import { toast } from '../../store/useToastStore';

export interface QuickRuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'rewrite' | 'mock' | 'breakpoint' | 'script';
  request: HttpRequest | null;
  onSaveRule?: (ruleData: any) => void;
}

export const QuickRuleDialog: React.FC<QuickRuleDialogProps> = ({
  isOpen,
  onClose,
  type: initialType,
  request,
  onSaveRule,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'simulator'>('editor');
  const [ruleType, setRuleType] = useState<'rewrite' | 'mock' | 'breakpoint' | 'script'>(initialType);
  const [ruleName, setRuleName] = useState('');
  const [urlPattern, setUrlPattern] = useState('');
  const [matchType, setMatchType] = useState<UrlMatchType>('wildcard');
  const [enabled, setEnabled] = useState(true);

  // Advanced Action & Stage
  const [actionType, setActionType] = useState<RuleActionType>('replace');
  const [targetStage, setTargetStage] = useState<'request' | 'response' | 'both'>('response');
  const [delayMs, setDelayMs] = useState<number>(500);

  // Rewrite / Mock Rule Payload
  const [redirectUrl, setRedirectUrl] = useState('');
  const [statusCode, setStatusCode] = useState(200);
  const [headers, setHeaders] = useState<{ key: string; value: string; action: 'set' | 'remove' }[]>([]);
  
  // Body Types: json, form-urlencoded, raw, xml, html, base64, graphql
  const [bodyType, setBodyType] = useState<HttpBodyType>('json');
  const [bodyContent, setBodyContent] = useState('{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}');
  const [formEntries, setFormEntries] = useState<FormDataEntry[]>([
    { key: 'username', value: 'admin', enabled: true },
    { key: 'token', value: 'sample_token_xyz', enabled: true }
  ]);
  const [bodySearch, setBodySearch] = useState('');

  // Breakpoint Rule State
  const [breakpointMethod, setBreakpointMethod] = useState('');
  const [interceptRequest, setInterceptRequest] = useState(true);
  const [interceptResponse, setInterceptResponse] = useState(true);

  // Script State
  const [scriptCode, setScriptCode] = useState('');

  // Simulator State
  const [simUrl, setSimUrl] = useState('');
  const [simMethod, setSimMethod] = useState('GET');
  const [simResult, setSimResult] = useState<{ matched: boolean; output?: string } | null>(null);

  // Pre-fill data when dialog opens or request changes
  useEffect(() => {
    setRuleType(initialType);
    if (request) {
      const url = request.url || '';
      const domain = request.hostPort?.host || '';
      const path = request.path || '';
      
      const defaultPattern = domain ? `*://${domain}${path || '/*'}` : url;
      setUrlPattern(defaultPattern);
      setSimUrl(url || `https://${domain}${path}`);
      setSimMethod(request.method || 'GET');
      setRuleName(`${initialType.toUpperCase()} - ${domain || 'Rule'}`);

      // Pre-fill Rewrite / Mock
      setStatusCode(request.response?.statusCode || 200);
      const reqHeaders = Object.entries(request.headers || {}).slice(0, 3).map(([k, v]) => ({
        key: k,
        value: Array.isArray(v) ? v[0] : String(v),
        action: 'set' as const,
      }));
      setHeaders(reqHeaders);

      const respBody = request.response?.bodyString || request.response?.body || '';
      if (respBody) {
        setBodyContent(respBody);
        try {
          JSON.parse(respBody);
          setBodyType('json');
        } catch (_) {
          setBodyType('raw');
        }
      }

      // Pre-fill Breakpoint
      setBreakpointMethod(request.method || '');

      // Pre-fill Script
      setScriptCode(`/**
 * JavaScript Dynamic Rule for ${domain || 'HTTPeek'}
 * Powered by Goja ECMAScript engine
 */

function onRequest(context, request) {
    console.log("[Script] Intercepted Request:", request.method, request.url);
    // request.headers['X-Custom-Auth'] = 'Bearer token_123';
    return request;
}

function onResponse(context, request, response) {
    console.log("[Script] Intercepted Response for:", request.url);
    // response.statusCode = 200;
    return response;
}`);
    }
  }, [isOpen, initialType, request]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: any) => {
    setStatusCode(tmpl.statusCode);
    setBodyContent(tmpl.body);
    setBodyType('json');
    toast.info(`Applied template: ${tmpl.name}`);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      setBodyContent(JSON.stringify(parsed, null, 2));
      toast.success('Formatted JSON');
    } catch (_) {
      toast.error('Invalid JSON syntax');
    }
  };

  const handleMinifyJson = () => {
    try {
      const parsed = JSON.parse(bodyContent);
      setBodyContent(JSON.stringify(parsed));
      toast.info('Minified JSON');
    } catch (_) {
      toast.error('Invalid JSON syntax');
    }
  };

  const handleFormEntriesChange = (entries: FormDataEntry[]) => {
    setFormEntries(entries);
    // Generate serialized URL-encoded string
    const params = new URLSearchParams();
    entries.forEach((e) => {
      if (e.enabled && e.key.trim()) {
        params.append(e.key.trim(), e.value);
      }
    });
    setBodyContent(params.toString());
  };

  const handleSimulate = () => {
    let matched = false;
    const testPattern = urlPattern.trim();
    const targetUrl = simUrl.trim();

    if (!testPattern) {
      matched = true;
    } else {
      switch (matchType) {
        case 'wildcard':
          if (testPattern.includes('*')) {
            const escaped = testPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
            matched = new RegExp(`^${escaped}$`, 'i').test(targetUrl);
          } else {
            matched = targetUrl.toLowerCase().includes(testPattern.toLowerCase());
          }
          break;
        case 'regex':
          try {
            matched = new RegExp(testPattern, 'i').test(targetUrl);
          } catch (_) {
            matched = false;
          }
          break;
        case 'exact':
          matched = targetUrl === testPattern;
          break;
        case 'prefix':
          matched = targetUrl.toLowerCase().startsWith(testPattern.toLowerCase());
          break;
        case 'contains':
        default:
          matched = targetUrl.toLowerCase().includes(testPattern.toLowerCase());
          break;
      }
    }

    if (ruleType === 'breakpoint' && breakpointMethod && breakpointMethod !== 'ALL') {
      if (simMethod.toUpperCase() !== breakpointMethod.toUpperCase()) {
        matched = false;
      }
    }

    let output = '';
    if (matched) {
      if (actionType === 'drop') {
        output = '⚡ Connection Aborted & Dropped Silently (Simulated 0ms TCP RST)';
      } else if (actionType === 'delay') {
        output = `⏱ Injected Artificial Latency: +${delayMs}ms delay before forward`;
      } else if (actionType === 'redirect') {
        output = `🔀 Redirect URL Target: ${redirectUrl || 'https://mock.example.com/$1'}`;
      } else if (ruleType === 'mock' || actionType === 'replace') {
        output = `HTTP/1.1 ${statusCode}\nContent-Type: ${bodyType === 'json' ? 'application/json' : bodyType === 'form-urlencoded' ? 'application/x-www-form-urlencoded' : 'text/plain'}\n\n${bodyContent}`;
      } else {
        output = `Matched rule: ${ruleName}\nStage: ${targetStage}\nAction: ${actionType}`;
      }
    }

    setSimResult({ matched, output });
  };

  const handleSave = () => {
    if (!urlPattern.trim()) {
      toast.warning('Please specify a URL match pattern');
      return;
    }

    const ruleData = {
      id: `rule-${Date.now()}`,
      name: ruleName || `Rule ${urlPattern}`,
      urlPattern: urlPattern.trim(),
      matchType,
      type: ruleType,
      action: actionType,
      stage: targetStage,
      enabled,
      statusCode,
      bodyType,
      replaceBody: bodyContent,
      redirectUrl,
      delayMs,
      headers: headers.reduce((acc, h) => {
        if (h.key.trim()) acc[h.key.trim()] = h.value;
        return acc;
      }, {} as Record<string, string>),
      breakpointMethod: breakpointMethod || undefined,
      scriptCode: ruleType === 'script' ? scriptCode : undefined,
    };

    if (onSaveRule) {
      onSaveRule(ruleData);
    }
    toast.success('Rule Created Successfully', ruleName || urlPattern);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl max-h-[86vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="h-14 px-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Visual GUI Rule Builder &amp; Interceptor
              </h2>
              <p className="text-xs text-gray-500">Create smart URL rewrite, mock response, delay, and breakpoint rules</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab & Rule Type Selector */}
        <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              1. Rule Configuration
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('simulator');
                handleSimulate();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>2. Live Rule Simulator</span>
            </button>
          </div>

          {/* Preset Templates Pill */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Presets:</span>
            {MOCK_RESPONSE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-medium hover:border-blue-500 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 flex flex-col gap-4 text-xs">
          {activeTab === 'editor' ? (
            <>
              {/* Row 1: Rule Name & Action Type & Match Mode */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Rule Name:</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Mock User Profile 200"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Action Type:</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-bold text-xs bg-white dark:bg-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="replace">Replace (Status, Headers, Body)</option>
                    <option value="redirect">Redirect (URL Forward / Rewrite)</option>
                    <option value="update">Update (Regex Search &amp; Replace)</option>
                    <option value="modify_headers">Modify Headers Only</option>
                    <option value="drop">Drop Connection (Abort / TCP RST)</option>
                    <option value="delay">Inject Latency / Delay (Lag)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">URL Match Mode:</label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-bold text-xs bg-white dark:bg-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="wildcard">Wildcard Pattern (*://*.com/*)</option>
                    <option value="regex">Regular Expression (^https://...$)</option>
                    <option value="exact">Exact Full URL Match</option>
                    <option value="contains">Contains / Substring</option>
                    <option value="prefix">URL Prefix / Starts With</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Target URL Match Pattern */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 dark:text-gray-300">URL Pattern to Match:</label>
                  <span className="text-[11px] text-gray-400 font-mono">
                    Example: *://api.github.com/users/*
                  </span>
                </div>
                <input
                  type="text"
                  value={urlPattern}
                  onChange={(e) => setUrlPattern(e.target.value)}
                  placeholder="*://api.example.com/v1/*"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Action Specific Fields */}
              {actionType === 'redirect' && (
                <div className="flex flex-col gap-1 p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <label className="font-bold text-blue-900 dark:text-blue-200">Redirect Target URL:</label>
                  <input
                    type="text"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    placeholder="https://staging.example.com/v1/$1"
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                  />
                </div>
              )}

              {actionType === 'delay' && (
                <div className="flex items-center gap-4 p-3.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                      <span>Simulated Latency Lag:</span>
                      <span>{delayMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="5000"
                      step="50"
                      value={delayMs}
                      onChange={(e) => setDelayMs(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {actionType === 'drop' && (
                <div className="flex items-center gap-3 p-3.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                  <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold">Silent Connection Dropper:</span>
                    <p className="text-[11px] opacity-80 mt-0.5">Matching requests will be immediately aborted with connection reset simulation.</p>
                  </div>
                </div>
              )}

              {(actionType === 'replace' || actionType === 'update') && (
                <>
                  {/* Status Code & Target Stage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-gray-700 dark:text-gray-300">Status Code Override:</label>
                      <StatusCodePicker value={statusCode} onChange={setStatusCode} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-gray-700 dark:text-gray-300">Target Stage:</label>
                      <div className="flex items-center gap-2 pt-1">
                        {(['response', 'request', 'both'] as const).map((stage) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => setTargetStage(stage)}
                            className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                              targetStage === stage
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Body Type Bar & Payload Editor */}
                  <div className="flex flex-col gap-2 flex-1 min-h-[220px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-700 dark:text-gray-300 mr-2">Body Type:</span>
                        {(['json', 'form-urlencoded', 'raw', 'xml', 'html', 'graphql'] as const).map((bt) => (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => setBodyType(bt)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                              bodyType === bt
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                          >
                            {bt}
                          </button>
                        ))}
                      </div>

                      {bodyType === 'json' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleFormatJson}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-semibold cursor-pointer"
                          >
                            <Braces className="w-3 h-3 text-blue-500" />
                            <span>Prettify</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleMinifyJson}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-semibold cursor-pointer"
                          >
                            <AlignLeft className="w-3 h-3 text-gray-500" />
                            <span>Minify</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {bodyType === 'form-urlencoded' ? (
                      /* Form Key-Value Table */
                      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-3 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Form URL-Encoded Key/Values:</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleFormEntriesChange([
                                ...formEntries,
                                { key: '', value: '', enabled: true },
                              ])
                            }
                            className="flex items-center gap-1 text-emerald-600 font-bold hover:underline cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Field</span>
                          </button>
                        </div>

                        {formEntries.map((fe, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fe.enabled}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx].enabled = e.target.checked;
                                handleFormEntriesChange(next);
                              }}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={fe.key}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx].key = e.target.value;
                                handleFormEntriesChange(next);
                              }}
                              placeholder="Parameter Name"
                              className="w-1/3 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={fe.value}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx].value = e.target.value;
                                handleFormEntriesChange(next);
                              }}
                              placeholder="Value"
                              className="flex-1 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleFormEntriesChange(formEntries.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="text-[11px] font-mono text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-800 truncate">
                          Preview: {bodyContent || '(empty)'}
                        </div>
                      </div>
                    ) : (
                      /* Monaco Code Editor for JSON/Raw/XML/HTML/GraphQL */
                      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xs">
                        <Editor
                          height="180px"
                          theme="vs-dark"
                          defaultLanguage={bodyType === 'xml' || bodyType === 'html' ? 'xml' : bodyType === 'json' ? 'json' : 'plaintext'}
                          language={bodyType === 'xml' || bodyType === 'html' ? 'xml' : bodyType === 'json' ? 'json' : 'plaintext'}
                          value={bodyContent}
                          onChange={(val) => setBodyContent(val || '')}
                          options={{
                            fontSize: 12,
                            fontFamily: 'JetBrains Mono, monospace',
                            minimap: { enabled: false },
                            wordWrap: 'on',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Tab 2: Live Simulator */
            <div className="flex-1 flex flex-col gap-4">
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2 font-bold text-purple-900 dark:text-purple-200">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Real-Time Rule Match &amp; Execution Simulator</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">
                  Enter a test URL to evaluate if your pattern matches and view the exact mutated payload returned to the client.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={simUrl}
                    onChange={(e) => setSimUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/users/123"
                    className="flex-1 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Simulation</span>
                  </button>
                </div>
              </div>

              {simResult && (
                <div
                  className={`flex-1 p-4 rounded-2xl border flex flex-col gap-2 overflow-hidden ${
                    simResult.matched
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {simResult.matched ? (
                      <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 font-bold" />
                    ) : (
                      <X className="w-5 h-5 text-rose-600 dark:text-rose-400 font-bold" />
                    )}
                    <span className="font-bold text-sm">
                      {simResult.matched
                        ? `Rule Matched Successfully via ${matchType.toUpperCase()} mode!`
                        : 'No Match: The provided URL does not satisfy this rule pattern.'}
                    </span>
                  </div>

                  {simResult.matched && simResult.output && (
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 font-mono text-xs overflow-y-auto whitespace-pre-wrap">
                      {simResult.output}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-16 px-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableRule"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="enableRule" className="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
              Enable Rule Immediately
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Activate Rule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
