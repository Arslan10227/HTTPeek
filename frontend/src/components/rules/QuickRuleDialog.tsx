import React, { useState, useEffect, useMemo } from 'react';
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
  Braces,
  RotateCcw,
  Tag,
  Key,
  ShieldAlert
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { HttpRequest, RuleActionType, UrlMatchType, HttpBodyType, FormDataEntry } from '../../types';
import { StatusCodePicker } from '../common/StatusCodePicker';
import { HeaderKeyCombobox, HeaderValueCombobox } from '../common/HeaderCombobox';
import { HttpMethodPicker } from '../common/HttpMethodPicker';
import { MOCK_RESPONSE_TEMPLATES } from '../../constants/httpTemplates';
import { toast } from '../../store/useToastStore';
import { useProxyStore } from '../../store/useProxyStore';
import { useThemeStore } from '../../store/useThemeStore';

export interface HeaderItem {
  id: string;
  key: string;
  value: string;
  action: 'set' | 'remove';
  enabled: boolean;
}

export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface QuickRuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'rewrite' | 'mock' | 'breakpoint' | 'script';
  request: HttpRequest | null;
  prefill?: any;
  onSaveRule?: (ruleData: any) => void;
}

const COMMON_HEADER_PRESETS = [
  { label: '+ Auth Token', key: 'Authorization', value: 'Bearer token_secret_123', action: 'set' as const },
  { label: '+ Content-Type JSON', key: 'Content-Type', value: 'application/json; charset=utf-8', action: 'set' as const },
  { label: '+ CORS Allow All', key: 'Access-Control-Allow-Origin', value: '*', action: 'set' as const },
  { label: '+ Disable Cache', key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate', action: 'set' as const },
  { label: '+ Custom API Key', key: 'X-API-Key', value: 'apikey_live_998877', action: 'set' as const },
];

const STATUS_CODE_PILLS = [
  { code: 200, label: '200 OK', color: 'bg-emerald-600 hover:bg-emerald-700' },
  { code: 201, label: '201 Created', color: 'bg-emerald-600 hover:bg-emerald-700' },
  { code: 204, label: '204 No Content', color: 'bg-teal-600 hover:bg-teal-700' },
  { code: 302, label: '302 Redirect', color: 'bg-blue-600 hover:bg-blue-700' },
  { code: 400, label: '400 Bad Request', color: 'bg-amber-600 hover:bg-amber-700' },
  { code: 401, label: '401 Unauthorized', color: 'bg-amber-700 hover:bg-amber-800' },
  { code: 403, label: '403 Forbidden', color: 'bg-rose-600 hover:bg-rose-700' },
  { code: 404, label: '404 Not Found', color: 'bg-rose-600 hover:bg-rose-700' },
  { code: 500, label: '500 Server Error', color: 'bg-red-700 hover:bg-red-800' },
  { code: 502, label: '502 Bad Gateway', color: 'bg-red-800 hover:bg-red-900' },
];

export const QuickRuleDialog: React.FC<QuickRuleDialogProps> = ({
  isOpen,
  onClose,
  type: initialType,
  request,
  prefill,
  onSaveRule,
}) => {
  const { requests } = useProxyStore();
  const { monacoTheme } = useThemeStore();

  const [activeTab, setActiveTab] = useState<'editor' | 'headers' | 'params' | 'simulator'>('editor');
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
  
  // Headers builder
  const [headerList, setHeaderList] = useState<HeaderItem[]>([]);
  
  // Query parameters builder
  const [paramList, setParamList] = useState<QueryParamItem[]>([]);

  // Body Types: json, form-urlencoded, raw, xml, html, base64, graphql
  const [bodyType, setBodyType] = useState<HttpBodyType>('json');
  const [bodyContent, setBodyContent] = useState('{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}');
  const [formEntries, setFormEntries] = useState<FormDataEntry[]>([
    { key: 'username', value: 'admin', enabled: true },
    { key: 'token', value: 'sample_token_xyz', enabled: true }
  ]);

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

  // Extract unique captured domains
  const capturedDomains = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((r) => {
      const h = r.hostPort?.host;
      if (h && !h.includes(':')) {
        map.set(h, (map.get(h) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([domain]) => domain);
  }, [requests]);

  // Helper to generate a clean smart rule name
  const generateRuleName = (domain: string, path: string, typeStr: string, status: number) => {
    const cleanPath = path.split('?')[0] || '/';
    const shortPath = cleanPath.length > 25 ? cleanPath.slice(0, 25) + '...' : cleanPath;
    if (typeStr === 'mock') {
      return `Mock [${domain}${shortPath}] (${status})`;
    } else if (typeStr === 'breakpoint') {
      return `Breakpoint [${domain}${shortPath}]`;
    } else if (typeStr === 'script') {
      return `Script [${domain}]`;
    }
    return `Rewrite [${domain}${shortPath}]`;
  };

  // Pre-fill data when dialog opens or request changes
  useEffect(() => {
    if (!isOpen) return;

    setRuleType(initialType);
    if (initialType === 'mock') {
      setActionType('replace');
      setTargetStage('response');
    } else if (initialType === 'breakpoint') {
      setInterceptRequest(true);
      setInterceptResponse(true);
    }

    if (request) {
      const url = request.url || '';
      const domain = request.hostPort?.host || '';
      const path = request.path || '';
      const status = request.response?.statusCode || prefill?.statusCode || 200;
      
      const defaultPattern = domain ? `*://${domain}${path || '/*'}` : url;
      setUrlPattern(defaultPattern);
      setSimUrl(url || `https://${domain}${path}`);
      setSimMethod(request.method || 'GET');
      setStatusCode(status);

      // Generate smart rule name
      if (prefill?.name) {
        setRuleName(prefill.name);
      } else {
        setRuleName(generateRuleName(domain, path, initialType, status));
      }

      // Pre-fill Query Parameters
      const parsedParams: QueryParamItem[] = [];
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.forEach((v, k) => {
          parsedParams.push({ id: `p_${Date.now()}_${Math.random()}`, key: k, value: v, enabled: true });
        });
      } catch (_) {}
      setParamList(parsedParams);

      // Pre-fill Headers
      const parsedHeaders: HeaderItem[] = [];
      const srcHeaders = initialType === 'mock' && request.response?.headers 
        ? request.response.headers 
        : request.headers || {};
      
      Object.entries(srcHeaders).slice(0, 12).forEach(([k, rawV]) => {
        const v = Array.isArray(rawV) ? rawV.join(', ') : String(rawV ?? '');
        parsedHeaders.push({
          id: `h_${Date.now()}_${Math.random()}`,
          key: k,
          value: v,
          action: 'set',
          enabled: true,
        });
      });
      setHeaderList(parsedHeaders);

      // Pre-fill Body
      const respBody = request.response?.bodyString || request.response?.body || prefill?.body || '';
      const reqBody = request.bodyString || request.body || '';
      const bodyToUse = initialType === 'mock' || targetStage === 'response' ? respBody : reqBody;

      if (bodyToUse) {
        setBodyContent(bodyToUse);
        try {
          JSON.parse(bodyToUse);
          setBodyType('json');
        } catch (_) {
          if (bodyToUse.startsWith('query ') || bodyToUse.startsWith('mutation ')) {
            setBodyType('graphql');
          } else if (bodyToUse.includes('<') && bodyToUse.includes('>')) {
            setBodyType('xml');
          } else if (bodyToUse.includes('=') && bodyToUse.includes('&')) {
            setBodyType('form-urlencoded');
          } else {
            setBodyType('raw');
          }
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
    } else if (prefill) {
      if (prefill.name) setRuleName(prefill.name);
      if (prefill.statusCode) setStatusCode(prefill.statusCode);
      if (prefill.body) setBodyContent(prefill.body);
      if (prefill.action) setActionType(prefill.action);
      if (prefill.redirectUrl) setRedirectUrl(prefill.redirectUrl);
      if (prefill.delayMs) setDelayMs(prefill.delayMs);
    }
  }, [isOpen, initialType, request, prefill]);

  if (!isOpen) return null;

  const handleSelectDomain = (d: string) => {
    setUrlPattern(`*://${d}/*`);
    setSimUrl(`https://${d}/api/v1/test`);
    setRuleName(generateRuleName(d, '/*', ruleType, statusCode));
    toast.info('Domain Pattern Applied', `*://${d}/*`);
  };

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

  const handleAddHeader = (preset?: { key: string; value: string; action: 'set' | 'remove' }) => {
    setHeaderList((prev) => [
      ...prev,
      {
        id: `h_${Date.now()}_${Math.random()}`,
        key: preset?.key || '',
        value: preset?.value || '',
        action: preset?.action || 'set',
        enabled: true,
      },
    ]);
  };

  const handleAddParam = () => {
    setParamList((prev) => [
      ...prev,
      {
        id: `p_${Date.now()}_${Math.random()}`,
        key: '',
        value: '',
        enabled: true,
      },
    ]);
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
          matched = targetUrl.toLowerCase() === testPattern.toLowerCase();
          break;
        case 'contains':
          matched = targetUrl.toLowerCase().includes(testPattern.toLowerCase());
          break;
        case 'prefix':
          matched = targetUrl.toLowerCase().startsWith(testPattern.toLowerCase());
          break;
      }
    }

    setSimResult({
      matched,
      output: matched
        ? `Matched URL: ${targetUrl}\nAction: ${actionType.toUpperCase()}\nTarget Stage: ${targetStage.toUpperCase()}\nStatus Override: ${statusCode}\nHeaders Modified: ${headerList.filter(h => h.enabled).length}\nBody Size: ${bodyContent.length} bytes`
        : `URL Pattern did not match target URL.\nPattern: ${testPattern}\nTarget: ${targetUrl}`,
    });
  };

  const handleSave = () => {
    const finalRule = {
      name: ruleName.trim() || 'Custom Interceptor Rule',
      enabled,
      urlPattern: urlPattern.trim(),
      matchType,
      type: ruleType,
      actionType,
      targetStage,
      statusCode,
      redirectUrl,
      delayMs,
      headers: headerList.filter(h => h.enabled && h.key.trim()),
      queryParams: paramList.filter(p => p.enabled && p.key.trim()),
      bodyType,
      body: bodyContent,
      breakpointMethod,
      interceptRequest,
      interceptResponse,
      scriptCode,
    };

    if (onSaveRule) {
      onSaveRule(finalRule);
    }
    toast.success('Rule Created Successfully', ruleName || urlPattern);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans p-4">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: 'var(--md-dialog-bg, var(--md-sys-color-surface))' }}
      >
        {/* Top Header */}
        <div 
          className="h-14 px-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--md-sys-color-divider)', backgroundColor: 'var(--md-sys-color-surface-container, rgba(0,0,0,0.02))' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shadow-2xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Visual GUI Rule Builder &amp; Interceptor
              </h2>
              <p className="text-[11px] text-gray-500">Configure synthetic mocks, mutations, headers, parameters, and delays</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector & Presets Bar */}
        <div 
          className="px-5 py-2 border-b flex items-center justify-between shrink-0 text-xs gap-3 overflow-x-auto no-scrollbar"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                activeTab === 'editor'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              1. General &amp; Body
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                activeTab === 'headers'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span>2. Headers</span>
              {headerList.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {headerList.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('params')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                activeTab === 'params'
                  ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span>3. URL Params</span>
              {paramList.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                  {paramList.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('simulator');
                handleSimulate();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                activeTab === 'simulator'
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>4. Live Simulator</span>
            </button>
          </div>

          {/* Quick Mock Templates */}
          <div className="flex items-center gap-1 overflow-x-auto shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Presets:</span>
            {MOCK_RESPONSE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] font-medium hover:border-blue-500 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col gap-3 text-xs">
          {/* Top Domain Selector Bar */}
          {capturedDomains.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0 flex items-center gap-1">
                <Globe className="w-3 h-3 text-emerald-500" />
                <span>Captured Domains:</span>
              </span>
              {capturedDomains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSelectDomain(d)}
                  className="px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-[10px] font-mono shrink-0 transition-colors cursor-pointer"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'editor' && (
            <>
              {/* Row 1: Rule Name, Action Type & Match Mode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Rule Name:</label>
                    <button
                      type="button"
                      onClick={() => {
                        const d = request?.hostPort?.host || 'api.example.com';
                        setRuleName(generateRuleName(d, request?.path || '/*', ruleType, statusCode));
                      }}
                      className="text-[10px] text-blue-500 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Mock User Profile 200"
                    className="w-full px-2.5 py-1 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Action Type:</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full px-2.5 py-1 rounded-xl border border-gray-300 dark:border-gray-700 font-bold text-xs bg-white dark:bg-gray-800 focus:outline-none cursor-pointer"
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
                    className="w-full px-2.5 py-1 rounded-xl border border-gray-300 dark:border-gray-700 font-bold text-xs bg-white dark:bg-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="wildcard">Wildcard Pattern (*://*.com/*)</option>
                    <option value="exact">Exact Full URL Match</option>
                    <option value="prefix">URL Prefix / Starts With</option>
                    <option value="contains">Contains / Substring</option>
                    <option value="regex">Regular Expression (^https://...$)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Target URL Match Pattern */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 dark:text-gray-300">Target URL Match Pattern:</label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Example: *://api.github.com/users/*
                  </span>
                </div>
                <input
                  type="text"
                  value={urlPattern}
                  onChange={(e) => setUrlPattern(e.target.value)}
                  placeholder="*://api.example.com/v1/*"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Action Specific Fields */}
              {actionType === 'redirect' && (
                <div className="flex flex-col gap-1 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <label className="font-bold text-blue-900 dark:text-blue-200">Redirect Target URL:</label>
                  <input
                    type="text"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    placeholder="https://staging.example.com/v1/$1"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                  />
                </div>
              )}

              {actionType === 'delay' && (
                <div className="flex items-center gap-4 p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                      <span>Simulated Latency Delay:</span>
                      <span className="font-mono">{delayMs} ms</span>
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
                <div className="flex items-center gap-3 p-3 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                  <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold">Silent Connection Dropper:</span>
                    <p className="text-[11px] opacity-80 mt-0.5">Matching requests will be immediately aborted with connection reset simulation.</p>
                  </div>
                </div>
              )}

              {(actionType === 'replace' || actionType === 'update') && (
                <>
                  {/* Status Code & Stage Bar */}
                  <div className="flex flex-col gap-2 p-3 bg-slate-50/70 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Status Code Override:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-500 mr-1">Target Stage:</span>
                        {(['response', 'request', 'both'] as const).map((stage) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => setTargetStage(stage)}
                            className={`px-2 py-0.5 rounded-lg font-bold capitalize transition-all cursor-pointer text-[10px] ${
                              targetStage === stage
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Status Code Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      {STATUS_CODE_PILLS.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => setStatusCode(p.code)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer shrink-0 ${
                            statusCode === p.code
                              ? `${p.color} text-white shadow-xs`
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Type Bar & Payload Editor */}
                  <div className="flex flex-col gap-2 flex-1 min-h-[220px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-700 dark:text-gray-300 mr-1.5">Body Type:</span>
                        {(['json', 'form-urlencoded', 'graphql', 'xml', 'html', 'raw', 'base64'] as const).map((bt) => (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => setBodyType(bt)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleFormatJson}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[10px] font-semibold cursor-pointer"
                          >
                            <Braces className="w-3 h-3 text-blue-500" />
                            <span>Prettify</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleMinifyJson}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[10px] font-semibold cursor-pointer"
                          >
                            <AlignLeft className="w-3 h-3 text-gray-500" />
                            <span>Minify</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {bodyType === 'form-urlencoded' ? (
                      /* Form Key-Value Table */
                      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-2.5 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800">
                          <span className="font-bold text-gray-600 dark:text-gray-300 text-[11px]">Form Key/Values:</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormEntries([
                                ...formEntries,
                                { key: '', value: '', enabled: true },
                              ])
                            }
                            className="flex items-center gap-1 text-emerald-600 font-bold hover:underline cursor-pointer text-[11px]"
                          >
                            <Plus className="w-3 h-3" />
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
                                setFormEntries(next);
                              }}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={fe.key}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx].key = e.target.value;
                                setFormEntries(next);
                              }}
                              placeholder="Parameter Name"
                              className="w-1/3 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-800 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={fe.value}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx].value = e.target.value;
                                setFormEntries(next);
                              }}
                              placeholder="Value"
                              className="flex-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-800 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setFormEntries(formEntries.filter((_, i) => i !== idx))}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Monaco Editor for JSON / GraphQL / XML / Raw */
                      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex-1 min-h-[160px] h-[180px]">
                        <Editor
                          height="100%"
                          language={bodyType === 'graphql' ? 'graphql' : bodyType === 'xml' ? 'xml' : bodyType === 'html' ? 'html' : bodyType === 'json' ? 'json' : 'plaintext'}
                          value={bodyContent}
                          theme={monacoTheme}
                          onChange={(val) => setBodyContent(val || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 11,
                            lineNumbers: 'on',
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Tab 2: Dynamic Headers Builder */}
          {activeTab === 'headers' && (
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              {/* Common Header Preset Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Presets:</span>
                {COMMON_HEADER_PRESETS.map((hp) => (
                  <button
                    key={hp.label}
                    type="button"
                    onClick={() => handleAddHeader(hp)}
                    className="px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-blue-50/40 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[10px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    {hp.label}
                  </button>
                ))}
              </div>

              {/* Headers Table */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-3 bg-gray-50/40 dark:bg-gray-900/40 flex-1 overflow-y-auto flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800 shrink-0">
                  <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">
                    HTTP Headers to Inject / Remove ({headerList.filter(h => h.enabled).length} Active)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddHeader()}
                    className="flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Header</span>
                  </button>
                </div>

                {headerList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-400 text-center">
                    <p className="font-semibold text-xs">No headers configured</p>
                    <p className="text-[11px] mt-0.5">Click &quot;Add Custom Header&quot; or select a preset above.</p>
                  </div>
                ) : (
                  headerList.map((h, idx) => (
                    <div key={h.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => {
                          const next = [...headerList];
                          next[idx].enabled = e.target.checked;
                          setHeaderList(next);
                        }}
                        className="rounded text-blue-600 cursor-pointer ml-1"
                      />
                      <select
                        value={h.action}
                        onChange={(e) => {
                          const next = [...headerList];
                          next[idx].action = e.target.value as any;
                          setHeaderList(next);
                        }}
                        className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-bold text-[10px] uppercase bg-gray-50 dark:bg-gray-900 cursor-pointer"
                      >
                        <option value="set">Set / Override</option>
                        <option value="remove">Remove / Strip</option>
                      </select>
                      <input
                        type="text"
                        value={h.key}
                        onChange={(e) => {
                          const next = [...headerList];
                          next[idx].key = e.target.value;
                          setHeaderList(next);
                        }}
                        placeholder="Header Name (e.g. Authorization)"
                        className="w-1/3 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-900 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={h.value}
                        onChange={(e) => {
                          const next = [...headerList];
                          next[idx].value = e.target.value;
                          setHeaderList(next);
                        }}
                        placeholder="Header Value"
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setHeaderList(headerList.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="Delete header"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 3: URL Parameters Builder */}
          {activeTab === 'params' && (
            <div className="flex flex-col gap-2.5 flex-1 min-h-0">
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-3 bg-gray-50/40 dark:bg-gray-900/40 flex-1 overflow-y-auto flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 border-b border-gray-200 dark:border-gray-800 shrink-0">
                  <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">
                    Query Parameters ({paramList.filter(p => p.enabled).length} Active)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="flex items-center gap-1 text-orange-600 font-bold hover:underline cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Query Parameter</span>
                  </button>
                </div>

                {paramList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-400 text-center">
                    <p className="font-semibold text-xs">No URL query parameters</p>
                    <p className="text-[11px] mt-0.5">Click &quot;Add Query Parameter&quot; to define custom params.</p>
                  </div>
                ) : (
                  paramList.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => {
                          const next = [...paramList];
                          next[idx].enabled = e.target.checked;
                          setParamList(next);
                        }}
                        className="rounded text-orange-600 cursor-pointer ml-1"
                      />
                      <input
                        type="text"
                        value={p.key}
                        onChange={(e) => {
                          const next = [...paramList];
                          next[idx].key = e.target.value;
                          setParamList(next);
                        }}
                        placeholder="Param Name (e.g. limit)"
                        className="w-1/3 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-900 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => {
                          const next = [...paramList];
                          next[idx].value = e.target.value;
                          setParamList(next);
                        }}
                        placeholder="Param Value (e.g. 50)"
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-[11px] bg-white dark:bg-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setParamList(paramList.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="Delete parameter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Live Rule Simulator */}
          {activeTab === 'simulator' && (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Test URL for Pattern Matching:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simUrl}
                    onChange={(e) => setSimUrl(e.target.value)}
                    placeholder="https://api.github.com/users/octocat"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Test</span>
                  </button>
                </div>
              </div>

              {simResult && (
                <div
                  className={`p-3 rounded-2xl border flex flex-col gap-1.5 ${
                    simResult.matched
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {simResult.matched ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Ban className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{simResult.matched ? 'Match Success: Rule Will Intercept' : 'Match Failed: Pattern Did Not Match'}</span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap opacity-90">{simResult.output}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div 
          className="h-14 px-5 border-t flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--md-sys-color-divider)', backgroundColor: 'var(--md-sys-color-surface-container, rgba(0,0,0,0.02))' }}
        >
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">Enable Rule Immediately</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-md transition-all text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Activate Rule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
