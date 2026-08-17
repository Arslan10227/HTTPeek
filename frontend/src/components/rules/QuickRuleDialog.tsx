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
  Copy
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { HttpRequest } from '../../types';
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
  const [enabled, setEnabled] = useState(true);

  // Rewrite Rule State
  const [rewriteType, setRewriteType] = useState<'requestReplace' | 'requestUpdate' | 'responseReplace' | 'responseUpdate' | 'redirect'>('responseUpdate');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [statusCode, setStatusCode] = useState(200);
  const [headers, setHeaders] = useState<{ key: string; value: string; action: string }[]>([]);
  const [bodyReplacement, setBodyReplacement] = useState('');
  const [bodySearch, setBodySearch] = useState('');

  // Mock Rule State
  const [mockStatusCode, setMockStatusCode] = useState(200);
  const [mockContentType, setMockContentType] = useState('application/json; charset=utf-8');
  const [mockBody, setMockBody] = useState('{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}');

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

      // Pre-fill Rewrite
      setStatusCode(request.response?.statusCode || 200);
      const reqHeaders = Object.entries(request.headers || {}).slice(0, 3).map(([k, v]) => ({
        key: k,
        value: Array.isArray(v) ? v[0] : String(v),
        action: 'set',
      }));
      setHeaders(reqHeaders);
      setBodyReplacement(request.response?.bodyString || request.response?.body || '');
      setBodySearch('');

      // Pre-fill Mock
      setMockStatusCode(request.response?.statusCode || 200);
      setMockContentType(request.response?.contentType || 'application/json; charset=utf-8');
      setMockBody(request.response?.bodyString || request.response?.body || '{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}');

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
    setMockStatusCode(tmpl.statusCode);
    setMockContentType(tmpl.contentType);
    setMockBody(tmpl.body);
    toast.info(`Applied template: ${tmpl.name}`);
  };

  const handleSimulate = () => {
    let matched = false;
    const testPattern = urlPattern.trim();
    if (!testPattern) {
      matched = true;
    } else if (testPattern.includes('*')) {
      const escaped = testPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const re = new RegExp(`^${escaped}$`, 'i');
      matched = re.test(simUrl);
    } else {
      matched = simUrl.toLowerCase().includes(testPattern.toLowerCase());
    }

    if (ruleType === 'breakpoint' && breakpointMethod && breakpointMethod !== 'ALL') {
      if (simMethod.toUpperCase() !== breakpointMethod.toUpperCase()) {
        matched = false;
      }
    }

    let output = '';
    if (matched) {
      if (ruleType === 'mock') {
        output = `Status: ${mockStatusCode}\nContent-Type: ${mockContentType}\n\n${mockBody}`;
      } else if (ruleType === 'rewrite') {
        output = `Status: ${statusCode}\nModified Headers: ${headers.length}\nBody: ${bodyReplacement || '(Pass-through)'}`;
      } else if (ruleType === 'breakpoint') {
        output = `Intercept Triggered: ${interceptRequest ? '[Request]' : ''} ${interceptResponse ? '[Response]' : ''}\nTraffic paused for inspection.`;
      } else {
        output = `Script Evaluated: onResponse / onRequest pipeline executed.`;
      }
    }

    setSimResult({ matched, output });
  };

  const handleSave = () => {
    const payload = {
      type: ruleType,
      name: ruleName,
      urlPattern,
      enabled,
      rewrite: ruleType === 'rewrite' ? {
        rewriteType,
        redirectUrl,
        statusCode,
        headers,
        bodySearch,
        bodyReplacement,
      } : undefined,
      mock: ruleType === 'mock' ? {
        statusCode: mockStatusCode,
        contentType: mockContentType,
        body: mockBody,
      } : undefined,
      breakpoint: ruleType === 'breakpoint' ? {
        method: breakpointMethod,
        interceptRequest,
        interceptResponse,
      } : undefined,
      script: ruleType === 'script' ? {
        code: scriptCode,
      } : undefined,
    };

    if (onSaveRule) {
      onSaveRule(payload);
    }
    toast.success('Rule saved successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none font-sans">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 dark:border-gray-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-gray-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            {ruleType === 'rewrite' && <Sliders className="w-5 h-5 text-emerald-600" />}
            {ruleType === 'mock' && <Globe className="w-5 h-5 text-sky-600" />}
            {ruleType === 'breakpoint' && <PauseCircle className="w-5 h-5 text-amber-500" />}
            {ruleType === 'script' && <Code2 className="w-5 h-5 text-purple-600" />}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {ruleType === 'rewrite' && 'GUI Request / Response Rewrite Rule'}
                {ruleType === 'mock' && 'GUI Mock & Response Generator'}
                {ruleType === 'breakpoint' && 'GUI Breakpoint Rule'}
                {ruleType === 'script' && 'JavaScript Sandbox Rule'}
              </h2>
              <p className="text-[11px] text-slate-400">Interactive visual rule builder with prefilled templates</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'editor' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Rule Editor
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('simulator');
                  handleSimulate();
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'simulator' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Live Simulator
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'simulator' ? (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20">
                <span className="font-bold text-blue-900 dark:text-blue-300">Rule Simulator &amp; Tester</span>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Verify whether your URL and method criteria match before saving.
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-gray-700 dark:text-gray-300">Test Request Method &amp; URL</label>
                <div className="flex items-center gap-2">
                  <HttpMethodPicker value={simMethod} onChange={setSimMethod} allowAll={false} />
                  <input
                    type="text"
                    value={simUrl}
                    onChange={(e) => setSimUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-xs bg-white dark:bg-gray-800"
                    placeholder="https://api.example.com/v1/user/123"
                  />
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Test</span>
                  </button>
                </div>
              </div>

              {simResult && (
                <div className={`p-4 rounded-xl border ${
                  simResult.matched
                    ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                    : 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-2">
                    {simResult.matched ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />}
                    <span>{simResult.matched ? 'MATCH SUCCESS: Rule applies to this request' : 'NO MATCH: URL does not satisfy match condition'}</span>
                  </div>
                  {simResult.matched && simResult.output && (
                    <pre className="p-3 bg-gray-900 text-gray-100 font-mono text-[11px] rounded-lg overflow-x-auto mt-2">
                      {simResult.output}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* General Properties */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. Mock Auth & Inject Headers"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Status</label>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`w-full py-1.5 px-3 rounded-lg border font-bold text-center cursor-pointer transition-colors ${
                      enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {enabled ? 'Active (Enabled)' : 'Disabled'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">URL Match Criteria (Supports Wildcard * and Regex)</label>
                <input
                  type="text"
                  value={urlPattern}
                  onChange={(e) => setUrlPattern(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-gray-800"
                  placeholder="*://api.example.com/*"
                />
              </div>

              {/* TAB 1: REWRITE SPECIFIC */}
              {ruleType === 'rewrite' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-gray-800">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1.5">Rewrite Action Type</label>
                    <div className="grid grid-cols-5 gap-1.5 bg-slate-100 dark:bg-gray-800 p-1 rounded-lg text-center font-medium">
                      {[
                        { id: 'responseUpdate', label: 'Update Resp' },
                        { id: 'responseReplace', label: 'Replace Resp' },
                        { id: 'requestUpdate', label: 'Update Req' },
                        { id: 'requestReplace', label: 'Replace Req' },
                        { id: 'redirect', label: 'Redirect' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setRewriteType(t.id as any)}
                          className={`py-1 rounded-md text-[11px] cursor-pointer transition-all ${
                            rewriteType === t.id ? 'bg-white dark:bg-gray-700 shadow-xs text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-gray-400'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {rewriteType === 'redirect' ? (
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Target Redirect URL</label>
                      <input
                        type="text"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg font-mono focus:outline-none focus:border-emerald-500 bg-white dark:bg-gray-800"
                        placeholder="https://127.0.0.1:8080/*"
                      />
                    </div>
                  ) : (
                    <>
                      {/* Status Code with Picker */}
                      <div>
                        <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Override Status Code</label>
                        <StatusCodePicker value={statusCode} onChange={setStatusCode} />
                      </div>

                      {/* Header Modifiers */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-slate-500 dark:text-slate-400 font-semibold">Header Mutations</label>
                          <button
                            type="button"
                            onClick={() => setHeaders([...headers, { key: '', value: '', action: 'set' }])}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
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
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Body Replacements */}
                      <div>
                        <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Body Mutation / Replacement</label>
                        <div className="h-44 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          <Editor
                            height="100%"
                            theme="vs"
                            language="json"
                            value={bodyReplacement}
                            onChange={(v) => setBodyReplacement(v || '')}
                            options={{
                              fontSize: 12,
                              fontFamily: 'JetBrains Mono, monospace',
                              minimap: { enabled: false },
                              wordWrap: 'on',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: MOCK SPECIFIC */}
              {ruleType === 'mock' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-gray-800">
                  {/* Preset Templates */}
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Quick Response Templates</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {MOCK_RESPONSE_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.name}
                          type="button"
                          onClick={() => handleApplyTemplate(tmpl)}
                          className="px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium text-[11px] whitespace-nowrap hover:bg-sky-100 cursor-pointer transition-colors"
                        >
                          {tmpl.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">HTTP Status Code</label>
                      <StatusCodePicker value={mockStatusCode} onChange={setMockStatusCode} />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Content-Type</label>
                      <HeaderValueCombobox
                        headerKey="Content-Type"
                        value={mockContentType}
                        onChange={setMockContentType}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Mock Body Content</label>
                    <div className="h-44 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <Editor
                        height="100%"
                        theme="vs"
                        language="json"
                        value={mockBody}
                        onChange={(v) => setMockBody(v || '')}
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
              )}

              {/* TAB 3: BREAKPOINT SPECIFIC */}
              {ruleType === 'breakpoint' && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-gray-800">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Filter by HTTP Method</label>
                    <HttpMethodPicker value={breakpointMethod} onChange={setBreakpointMethod} />
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                    <span className="font-bold text-amber-800 dark:text-amber-300">Interception Phases</span>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={interceptRequest}
                          onChange={(e) => setInterceptRequest(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Pause Request (Before Sending)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={interceptResponse}
                          onChange={(e) => setInterceptResponse(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Pause Response (Before Returning)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SCRIPT SPECIFIC */}
              {ruleType === 'script' && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-500 dark:text-slate-400 font-semibold">ECMAScript Execution Sandbox</label>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Goja VM runtime</span>
                  </div>
                  <div className="h-60 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <Editor
                      height="100%"
                      theme="vs"
                      language="javascript"
                      value={scriptCode}
                      onChange={(v) => setScriptCode(v || '')}
                      options={{
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                        minimap: { enabled: false },
                        wordWrap: 'on',
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-14 border-t border-slate-200 dark:border-gray-800 px-5 flex items-center justify-between bg-slate-50 dark:bg-gray-800/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save &amp; Apply Rule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
