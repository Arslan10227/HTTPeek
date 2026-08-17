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
  ArrowRight
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { HttpRequest } from '../../types';

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

  // Pre-fill data when dialog opens or request changes
  useEffect(() => {
    setRuleType(initialType);
    if (request) {
      const url = request.url || '';
      const domain = request.hostPort?.host || '';
      const path = request.path || '';
      
      // Auto wildcard pattern
      const defaultPattern = domain ? `*://${domain}${path || '/*'}` : url;
      setUrlPattern(defaultPattern);
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
 * JavaScript Rule for ${domain || 'Custom Request'}
 * Modify requests and responses dynamically!
 */

function onRequest(context, request) {
    console.log("[Script] Intercepted Request:", request.method, request.url);
    // Custom logic:
    // request.headers['X-Custom-Auth'] = 'Bearer token_123';
    return request;
}

function onResponse(context, request, response) {
    console.log("[Script] Intercepted Response for:", request.url);
    // Custom logic:
    // response.statusCode = 200;
    return response;
}`);
    }
  }, [isOpen, initialType, request]);

  if (!isOpen) return null;

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
    onClose();
  };

  return (
    <div className="htk-modal-overlay">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans select-none">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            {ruleType === 'rewrite' && <Sliders className="w-5 h-5 text-emerald-600" />}
            {ruleType === 'mock' && <Globe className="w-5 h-5 text-sky-600" />}
            {ruleType === 'breakpoint' && <PauseCircle className="w-5 h-5 text-amber-500" />}
            {ruleType === 'script' && <Code2 className="w-5 h-5 text-purple-600" />}
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {ruleType === 'rewrite' && 'Create Request / Response Rewrite Rule'}
                {ruleType === 'mock' && 'Create Request Map (Mock) Rule'}
                {ruleType === 'breakpoint' && 'Create Breakpoint Interception Rule'}
                {ruleType === 'script' && 'Create JavaScript Dynamic Script Rule'}
              </h2>
              <p className="text-[11px] text-slate-400">Configure mutation parameters directly from this request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {/* General Properties */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-500 font-semibold mb-1">Rule Name</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
                placeholder="e.g. Mock Staging Auth"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Status</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-full py-1.5 px-3 rounded-lg border font-bold text-center cursor-pointer transition-colors ${
                  enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {enabled ? 'Enabled (Active)' : 'Disabled'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">URL Match Pattern (supports wildcard * and regex:)</label>
            <input
              type="text"
              value={urlPattern}
              onChange={(e) => setUrlPattern(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-500 font-medium text-slate-800"
              placeholder="*://api.example.com/*"
            />
          </div>

          {/* ===================== TAB 1: REWRITE SPECIFIC ===================== */}
          {ruleType === 'rewrite' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-500 font-semibold mb-1.5">Rewrite Action Type</label>
                <div className="grid grid-cols-5 gap-1.5 bg-slate-100 p-1 rounded-lg text-center font-medium">
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
                        rewriteType === t.id ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {rewriteType === 'redirect' ? (
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Target Redirect URL</label>
                  <input
                    type="text"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="https://127.0.0.1:8080/*"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Status Code</label>
                      <input
                        type="number"
                        value={statusCode}
                        onChange={(e) => setStatusCode(parseInt(e.target.value) || 200)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Body Replacements */}
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Body Mutation / Replacement</label>
                    <div className="h-44 border border-slate-200 rounded-lg overflow-hidden">
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

          {/* ===================== TAB 2: MOCK SPECIFIC ===================== */}
          {ruleType === 'mock' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">HTTP Status</label>
                  <input
                    type="number"
                    value={mockStatusCode}
                    onChange={(e) => setMockStatusCode(parseInt(e.target.value) || 200)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Content-Type</label>
                  <input
                    type="text"
                    value={mockContentType}
                    onChange={(e) => setMockContentType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Mock Response Body</label>
                <div className="h-52 border border-slate-200 rounded-lg overflow-hidden">
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

          {/* ===================== TAB 3: BREAKPOINT SPECIFIC ===================== */}
          {ruleType === 'breakpoint' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Method Filter (Leave blank for ANY)</label>
                <input
                  type="text"
                  value={breakpointMethod}
                  onChange={(e) => setBreakpointMethod(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-amber-500"
                  placeholder="GET, POST, PUT..."
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={interceptRequest}
                    onChange={(e) => setInterceptRequest(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Pause on Request (before sending upstream)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={interceptResponse}
                    onChange={(e) => setInterceptResponse(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Pause on Response (before sending to client)</span>
                </label>
              </div>
            </div>
          )}

          {/* ===================== TAB 4: SCRIPT SPECIFIC ===================== */}
          {ruleType === 'script' && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">JavaScript Logic</label>
                <div className="h-64 border border-slate-200 rounded-lg overflow-hidden">
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-slate-200 px-5 flex items-center justify-end gap-2 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save & Apply Rule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
