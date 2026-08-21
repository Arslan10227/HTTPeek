import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Braces, FileText, Code, Filter, Zap, Settings2, Sparkles, Shield, ArrowRightLeft, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { RewriteRule, UrlMatchType, HttpBodyType, FormDataEntry, HeaderModifier } from '../../../types';
import { useThemeStore } from '../../../store/useThemeStore';
import { useAppConfig } from '../../../theme/useAppConfig';
import { StatusCodePicker } from '../../common/StatusCodePicker';
import { HttpMethodPicker } from '../../common/HttpMethodPicker';
import { VisualMatchBuilder } from '../../common/VisualMatchBuilder';
import Editor from '@monaco-editor/react';

type BuilderTab = 'match' | 'headers' | 'body' | 'status' | 'advanced';

export interface RewriteRuleBuilderProps {
  rule: RewriteRule;
  onChange: (rule: RewriteRule) => void;
}

const matchTypes: { value: UrlMatchType; label: string }[] = [
  { value: 'wildcard', label: 'Wildcard (*://host/*)' },
  { value: 'regex', label: 'Regex Regular Expression' },
  { value: 'exact', label: 'Exact Full URL' },
  { value: 'contains', label: 'Contains Keyword' },
  { value: 'prefix', label: 'URL Prefix' },
];

const bodyTypes: { value: HttpBodyType; label: string }[] = [
  { value: 'json', label: 'JSON Object' },
  { value: 'form-urlencoded', label: 'Form URL-Encoded' },
  { value: 'raw', label: 'Raw Text' },
  { value: 'xml', label: 'XML Document' },
  { value: 'html', label: 'HTML Webpage' },
  { value: 'base64', label: 'Base64 Binary' },
  { value: 'graphql', label: 'GraphQL' },
];

const headerActions: { value: 'set' | 'remove'; label: string }[] = [
  { value: 'set', label: 'Set / Overwrite' },
  { value: 'remove', label: 'Remove / Strip' },
];

const COMMON_HEADER_SUGGESTIONS = [
  { key: 'Access-Control-Allow-Origin', val: '*' },
  { key: 'Access-Control-Allow-Methods', val: 'GET, POST, PUT, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', val: '*' },
  { key: 'Content-Type', val: 'application/json; charset=utf-8' },
  { key: 'Authorization', val: 'Bearer YOUR_TOKEN_HERE' },
  { key: 'User-Agent', val: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  { key: 'Cache-Control', val: 'no-cache, no-store, must-revalidate' },
];

const tabs: { id: BuilderTab; label: string; icon: React.ReactNode }[] = [
  { id: 'match', label: 'Match Target', icon: <Filter className="w-3.5 h-3.5" /> },
  { id: 'headers', label: 'Headers', icon: <Code className="w-3.5 h-3.5" /> },
  { id: 'body', label: 'Body Payload', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'status', label: 'Status Code', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'advanced', label: 'Advanced Settings', icon: <Settings2 className="w-3.5 h-3.5" /> },
];

export const RewriteRuleBuilder: React.FC<RewriteRuleBuilderProps> = ({ rule, onChange }) => {
  const [tab, setTab] = useState<BuilderTab>('match');
  const { monacoTheme } = useThemeStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();
  const inputCls = 'px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full';
  const labelCls = 'font-semibold text-gray-700 dark:text-gray-200 text-xs mb-1.5 block';

  // 1-Click Recipe Presets
  const applyPreset = (recipe: 'cors' | 'mock200' | 'auth' | 'mock500' | 'redirect') => {
    switch (recipe) {
      case 'cors':
        onChange({
          ...rule,
          name: rule.name || 'Bypass CORS Policy',
          action: 'modify_headers',
          stage: 'response',
          headerModifiers: [
            { key: 'Access-Control-Allow-Origin', value: '*', action: 'set' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH', action: 'set' },
            { key: 'Access-Control-Allow-Headers', value: '*', action: 'set' },
            { key: 'Access-Control-Allow-Credentials', value: 'true', action: 'set' },
          ],
        });
        setTab('headers');
        break;
      case 'mock200':
        onChange({
          ...rule,
          name: rule.name || 'Mock 200 Success Response',
          action: 'replace',
          stage: 'response',
          statusCode: 200,
          replaceStatus: 200,
          bodyType: 'json',
          replaceBody: JSON.stringify({ status: 'success', code: 200, message: 'Mocked response from HTTPeek', data: { id: 1, active: true } }, null, 2),
          headerModifiers: [
            { key: 'Content-Type', value: 'application/json; charset=utf-8', action: 'set' },
          ],
        });
        setTab('body');
        break;
      case 'auth':
        onChange({
          ...rule,
          name: rule.name || 'Inject Bearer Auth Token',
          action: 'modify_headers',
          stage: 'request',
          headerModifiers: [
            { key: 'Authorization', value: 'Bearer YOUR_AUTH_TOKEN_HERE', action: 'set' },
          ],
        });
        setTab('headers');
        break;
      case 'mock500':
        onChange({
          ...rule,
          name: rule.name || 'Simulate 500 Internal Error',
          action: 'replace',
          stage: 'response',
          statusCode: 500,
          replaceStatus: 500,
          bodyType: 'json',
          replaceBody: JSON.stringify({ error: 'Internal Server Error', code: 500, detail: 'Simulated fault injection' }, null, 2),
        });
        setTab('status');
        break;
      case 'redirect':
        onChange({
          ...rule,
          name: rule.name || 'Forward to Staging Server',
          action: 'redirect',
          stage: 'request',
          redirectUrl: 'https://staging-api.example.com',
        });
        setTab('match');
        break;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1-Click Recipe Presets Bar */}
      <div className="p-3 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <span>1-Click Recipe Presets (Click to configure rule):</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('cors')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            Bypass CORS
          </button>
          <button
            type="button"
            onClick={() => applyPreset('mock200')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-blue-500/30 hover:border-blue-500 hover:bg-blue-500 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            Mock 200 JSON
          </button>
          <button
            type="button"
            onClick={() => applyPreset('auth')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <Code className="w-3.5 h-3.5 text-purple-500" />
            Inject Bearer Auth
          </button>
          <button
            type="button"
            onClick={() => applyPreset('mock500')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Simulate 500 Error
          </button>
          <button
            type="button"
            onClick={() => applyPreset('redirect')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
            Redirect URL
          </button>
        </div>
      </div>

      {/* Tab Navigation Strip */}
      <div className="flex items-center gap-1 border-b pb-2 border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              tab === t.id
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'match' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rule Name</label>
              <input
                type="text"
                value={rule.name || ''}
                onChange={(e) => onChange({ ...rule, name: e.target.value })}
                placeholder="e.g. Modify User Profile API"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Action Type</label>
              <select
                value={rule.action || 'replace'}
                onChange={(e) => onChange({ ...rule, action: e.target.value as any })}
                className={inputCls}
              >
                <option value="replace">Replace (Headers, Body, Status)</option>
                <option value="modify_headers">Modify Headers Only</option>
                <option value="redirect">Redirect (URL Forward)</option>
                <option value="update">Update (Regex Search &amp; Replace)</option>
                <option value="delay">Delay (Throttle / Latency)</option>
                <option value="drop">Drop (Block Connection)</option>
              </select>
            </div>
          </div>

          {/* Visual Match Builder */}
          <VisualMatchBuilder
            urlPattern={rule.urlPattern}
            onChangeUrlPattern={(p) => onChange({ ...rule, urlPattern: p })}
            method={rule.method || ''}
            onChangeMethod={(m) => onChange({ ...rule, method: m })}
            title="Target Endpoint Condition"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pattern Match Type</label>
              <select
                value={rule.matchType || 'wildcard'}
                onChange={(e) => onChange({ ...rule, matchType: e.target.value as UrlMatchType })}
                className={inputCls}
              >
                {matchTypes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Execution Stage</label>
              <div className="flex items-center gap-1.5">
                {[
                  { value: 'request', label: 'Request (Client -> Server)' },
                  { value: 'response', label: 'Response (Server -> Client)' },
                  { value: 'both', label: 'Both Phases' },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onChange({ ...rule, stage: s.value as any })}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      rule.stage === s.value
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500'
                        : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {rule.action === 'redirect' && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <label className={labelCls}>Redirect Target URL</label>
              <input
                type="text"
                value={rule.redirectUrl || ''}
                onChange={(e) => onChange({ ...rule, redirectUrl: e.target.value })}
                placeholder="https://test.example.com/api"
                className={inputCls}
              />
            </div>
          )}

          {rule.action === 'delay' && (
            <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Injection Delay: {rule.delayMs || 0} ms</label>
                <div className="flex items-center gap-1">
                  {[100, 500, 1000, 2000, 5000].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onChange({ ...rule, delayMs: d })}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {d}ms
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="50"
                value={rule.delayMs || 0}
                onChange={(e) => onChange({ ...rule, delayMs: parseInt(e.target.value, 10) || 0 })}
                className="w-full cursor-pointer accent-emerald-500"
              />
            </div>
          )}
        </div>
      )}

      {tab === 'headers' && (
        <HeadersTab rule={rule} onChange={onChange} labelCls={labelCls} inputCls={inputCls} />
      )}

      {tab === 'body' && (
        <BodyTab rule={rule} onChange={onChange} labelCls={labelCls} monacoTheme={monacoTheme} inputCls={inputCls} />
      )}

      {tab === 'status' && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Override HTTP Status Code</label>
            <StatusCodePicker
              value={rule.statusCode || rule.replaceStatus || 200}
              onChange={(code) => onChange({ ...rule, statusCode: code, replaceStatus: code })}
            />
          </div>
          <div className="text-xs text-gray-500 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            💡 The overridden status code will be returned to the client when this rule matches in the response stage.
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <AdvancedTab rule={rule} onChange={onChange} inputCls={inputCls} labelCls={labelCls} />
      )}
    </div>
  );
};

// ==================== Headers Tab ====================
const HeadersTab: React.FC<{ rule: RewriteRule; onChange: (r: RewriteRule) => void; labelCls: string; inputCls: string }> = ({
  rule,
  onChange,
  labelCls,
  inputCls,
}) => {
  const headers = rule.headerModifiers || [];

  const addHeader = (key = '', value = '', action: 'set' | 'remove' = 'set') => {
    onChange({
      ...rule,
      headerModifiers: [...headers, { key, value, action }],
    });
  };

  const updateHeader = (index: number, updated: Partial<HeaderModifier>) => {
    const list = [...headers];
    list[index] = { ...list[index], ...updated };
    onChange({ ...rule, headerModifiers: list });
  };

  const removeHeader = (index: number) => {
    onChange({ ...rule, headerModifiers: headers.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      {/* Quick Add Suggestions */}
      <div className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 flex flex-col gap-2">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Quick Header Autocomplete:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COMMON_HEADER_SUGGESTIONS.map(({ key, val }, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => addHeader(key, val, 'set')}
              className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-xs"
            >
              + {key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className={labelCls}>Header Modifications ({headers.length})</label>
        <button
          type="button"
          onClick={() => addHeader()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Header
        </button>
      </div>

      {headers.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
          No header modifications defined. Click &quot;Add Header&quot; or select a quick preset above.
        </div>
      ) : (
        <div className="space-y-2">
          {headers.map((h, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <select
                value={h.action || 'set'}
                onChange={(e) => updateHeader(idx, { action: e.target.value as any })}
                className="px-2 py-1.5 rounded-md border text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {headerActions.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={h.key}
                onChange={(e) => updateHeader(idx, { key: e.target.value })}
                placeholder="Header-Name"
                className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono bg-transparent"
              />
              {h.action !== 'remove' && (
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(idx, { value: e.target.value })}
                  placeholder="Header-Value"
                  className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono bg-transparent"
                />
              )}
              <button
                type="button"
                onClick={() => removeHeader(idx)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== Body Tab ====================
const BodyTab: React.FC<{
  rule: RewriteRule;
  onChange: (r: RewriteRule) => void;
  labelCls: string;
  monacoTheme: string;
  inputCls: string;
}> = ({ rule, onChange, labelCls, monacoTheme, inputCls }) => {
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(rule.replaceBody || '{}');
      onChange({ ...rule, replaceBody: JSON.stringify(parsed, null, 2) });
    } catch (_) {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className={labelCls}>Body Content Type</label>
          <select
            value={rule.bodyType || 'json'}
            onChange={(e) => onChange({ ...rule, bodyType: e.target.value as HttpBodyType })}
            className="px-2.5 py-1 rounded-lg border text-xs font-bold bg-white dark:bg-gray-800"
          >
            {bodyTypes.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        {rule.bodyType === 'json' && (
          <button
            type="button"
            onClick={formatJSON}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
          >
            Format JSON
          </button>
        )}
      </div>

      <div className="border rounded-xl overflow-hidden border-gray-200 dark:border-gray-700 h-[260px]">
        <Editor
          height="100%"
          language={rule.bodyType === 'json' ? 'json' : rule.bodyType === 'xml' ? 'xml' : rule.bodyType === 'html' ? 'html' : 'text'}
          theme={monacoTheme}
          value={rule.replaceBody || ''}
          onChange={(val) => onChange({ ...rule, replaceBody: val || '' })}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
};

// ==================== Advanced Tab ====================
const AdvancedTab: React.FC<{
  rule: RewriteRule;
  onChange: (r: RewriteRule) => void;
  inputCls: string;
  labelCls: string;
}> = ({ rule, onChange, inputCls, labelCls }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 space-y-3">
        <label className={labelCls}>Advanced Rewrite Options</label>
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
            />
            <span className="font-semibold">Rule is Enabled and Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
