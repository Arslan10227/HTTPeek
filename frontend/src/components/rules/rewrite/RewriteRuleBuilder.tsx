import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Braces, FileText, Code, Filter, Zap, Settings2 } from 'lucide-react';
import { RewriteRule, UrlMatchType, HttpBodyType, FormDataEntry, HeaderModifier } from '../../../types';
import { useThemeStore } from '../../../store/useThemeStore';
import { useAppConfig } from '../../../theme/useAppConfig';
import { StatusCodePicker } from '../../common/StatusCodePicker';
import { HeaderKeyCombobox, HeaderValueCombobox } from '../../common/HeaderCombobox';
import Editor from '@monaco-editor/react';

type BuilderTab = 'match' | 'headers' | 'body' | 'status' | 'advanced';

export interface RewriteRuleBuilderProps {
  rule: RewriteRule;
  onChange: (rule: RewriteRule) => void;
}

const matchTypes: { value: UrlMatchType; label: string }[] = [
  { value: 'wildcard', label: 'Wildcard (*://host/*)' },
  { value: 'regex', label: 'Regex' },
  { value: 'exact', label: 'Exact' },
  { value: 'contains', label: 'Contains' },
  { value: 'prefix', label: 'Prefix' },
];

const bodyTypes: { value: HttpBodyType; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'form-urlencoded', label: 'Form URL-Encoded' },
  { value: 'raw', label: 'Raw Text' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'base64', label: 'Base64' },
  { value: 'graphql', label: 'GraphQL' },
];

const httpMethods = ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT'];

const stages: { value: 'request' | 'response' | 'both'; label: string }[] = [
  { value: 'request', label: 'Request' },
  { value: 'response', label: 'Response' },
  { value: 'both', label: 'Both' },
];

const headerActions: { value: 'set' | 'remove'; label: string }[] = [
  { value: 'set', label: 'Set' },
  { value: 'remove', label: 'Remove' },
];

const tabs: { id: BuilderTab; label: string; icon: React.ReactNode }[] = [
  { id: 'match', label: 'Match', icon: <Filter className="w-3.5 h-3.5" /> },
  { id: 'headers', label: 'Headers', icon: <Code className="w-3.5 h-3.5" /> },
  { id: 'body', label: 'Body', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'status', label: 'Status', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings2 className="w-3.5 h-3.5" /> },
];

export const RewriteRuleBuilder: React.FC<RewriteRuleBuilderProps> = ({ rule, onChange }) => {
  const [tab, setTab] = useState<BuilderTab>('match');
  const { monacoTheme } = useThemeStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();
  const inputCls = 'px-3 py-1.5 rounded-lg border bg-transparent font-mono text-xs focus:outline-none w-full';
  const inputStyle = { borderColor: 'var(--md-sys-color-outline)' };
  const labelCls = 'font-semibold text-gray-600 dark:text-gray-300 text-[11px] mb-1 block';

  return (
    <div className="flex flex-col gap-3">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b pb-2" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: tab === t.id ? `${activeColor.hex}20` : 'transparent',
              color: tab === t.id ? activeColor.hex : 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'match' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rule Name</label>
              <input
                type="text"
                value={rule.name || ''}
                onChange={(e) => onChange({ ...rule, name: e.target.value })}
                placeholder="e.g. Inject Bearer Auth"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Action Type</label>
              <select
                value={rule.action || 'replace'}
                onChange={(e) => onChange({ ...rule, action: e.target.value as any })}
                className={inputCls}
                style={inputStyle}
              >
                <option value="replace">Replace (Headers, Body, Status)</option>
                <option value="redirect">Redirect (URL Forward)</option>
                <option value="update">Update (Regex Search &amp; Replace)</option>
                <option value="modify_headers">Modify Headers</option>
                <option value="drop">Drop (Block)</option>
                <option value="delay">Delay (Throttle)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>URL Match Pattern</label>
              <input
                type="text"
                value={rule.urlPattern}
                onChange={(e) => onChange({ ...rule, urlPattern: e.target.value })}
                placeholder="*://api.example.com/*"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Match Type</label>
              <select
                value={rule.matchType || 'wildcard'}
                onChange={(e) => onChange({ ...rule, matchType: e.target.value as UrlMatchType })}
                className={inputCls}
                style={inputStyle}
              >
                {matchTypes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>HTTP Method</label>
              <select
                value={rule.method || 'ANY'}
                onChange={(e) => onChange({ ...rule, method: e.target.value })}
                className={inputCls}
                style={inputStyle}
              >
                {httpMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Stage</label>
              <select
                value={rule.stage || 'response'}
                onChange={(e) => onChange({ ...rule, stage: e.target.value as any })}
                className={inputCls}
                style={inputStyle}
              >
                {stages.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {rule.action === 'redirect' && (
            <div>
              <label className={labelCls}>Redirect Target URL</label>
              <input
                type="text"
                value={rule.redirectUrl || ''}
                onChange={(e) => onChange({ ...rule, redirectUrl: e.target.value })}
                placeholder="https://test.example.com/$1"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}

          {rule.action === 'delay' && (
            <div>
              <label className={labelCls}>Delay (ms)</label>
              <input
                type="number"
                value={rule.delayMs || 0}
                onChange={(e) => onChange({ ...rule, delayMs: parseInt(e.target.value, 10) || 0 })}
                placeholder="1000"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}

          {/* Live regex tester */}
          {rule.matchType === 'regex' && (
            <RegexTester pattern={rule.urlPattern} />
          )}
        </div>
      )}

      {tab === 'headers' && (
        <HeadersTab rule={rule} onChange={onChange} labelCls={labelCls} />
      )}

      {tab === 'body' && (
        <BodyTab rule={rule} onChange={onChange} labelCls={labelCls} monacoTheme={monacoTheme} inputCls={inputCls} inputStyle={inputStyle} />
      )}

      {tab === 'status' && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Override Status Code</label>
            <StatusCodePicker
              value={rule.statusCode || rule.replaceStatus || 200}
              onChange={(code) => onChange({ ...rule, statusCode: code, replaceStatus: code })}
            />
          </div>
          <div className="text-[11px] text-gray-500 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}>
            The status code is applied when the rule action is <code>replace</code> or <code>update</code> and the stage includes <code>response</code>.
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <AdvancedTab rule={rule} onChange={onChange} monacoTheme={monacoTheme} />
      )}
    </div>
  );
};

// ==================== Match Tab: Regex Tester ====================
const RegexTester: React.FC<{ pattern: string }> = ({ pattern }) => {
  const [testUrl, setTestUrl] = useState('');
  const result = useMemo(() => {
    if (!pattern || !testUrl) return null;
    try {
      const re = new RegExp(pattern);
      return { match: re.test(testUrl), error: null };
    } catch (e: any) {
      return { match: false, error: e?.message || 'Invalid regex' };
    }
  }, [pattern, testUrl]);

  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--md-sys-color-divider)', backgroundColor: 'var(--md-sys-color-surface-variant)' }}>
      <div className="text-[11px] font-bold mb-2 flex items-center gap-1.5">
        <Braces className="w-3.5 h-3.5" /> Regex Tester
      </div>
      <input
        type="text"
        value={testUrl}
        onChange={(e) => setTestUrl(e.target.value)}
        placeholder="https://api.example.com/v1/users"
        className="px-3 py-1.5 rounded-lg border bg-transparent font-mono text-xs focus:outline-none w-full mb-2"
        style={{ borderColor: 'var(--md-sys-color-outline)' }}
      />
      {result?.error ? (
        <div className="text-[11px] text-red-500 font-mono">Error: {result.error}</div>
      ) : result ? (
        <div className={`text-[11px] font-mono font-bold ${result.match ? 'text-green-600' : 'text-gray-500'}`}>
          {result.match ? 'MATCH' : 'NO MATCH'}
        </div>
      ) : (
        <div className="text-[11px] text-gray-400">Enter a test URL to check the pattern</div>
      )}
    </div>
  );
};

// ==================== Headers Tab ====================
const HeadersTab: React.FC<{
  rule: RewriteRule;
  onChange: (r: RewriteRule) => void;
  labelCls: string;
}> = ({ rule, onChange, labelCls }) => {
  // Use headerModifiers (structured) if present, otherwise derive from replaceHeaders (legacy).
  const modifiers: HeaderModifier[] = rule.headerModifiers || [];
  const legacyHeaders = rule.replaceHeaders || {};

  const updateModifier = (idx: number, patch: Partial<HeaderModifier>) => {
    const next = [...modifiers];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...rule, headerModifiers: next });
  };
  const removeModifier = (idx: number) => {
    onChange({ ...rule, headerModifiers: modifiers.filter((_, i) => i !== idx) });
  };
  const addModifier = () => {
    const stage: HeaderModifier['stage'] = rule.stage === 'both' ? 'request' : (rule.stage || 'request');
    onChange({
      ...rule,
      headerModifiers: [...modifiers, { action: 'set', key: '', value: '', stage }],
    });
  };

  // Legacy header sync: keep replaceHeaders in sync with the first 'set' modifier
  // for backwards compatibility with backends that only read replaceHeaders.
  const syncLegacy = () => {
    const legacy: Record<string, string> = {};
    modifiers.forEach((m) => {
      if (m.action === 'set' && m.key) {
        legacy[m.key] = m.value;
      }
    });
    onChange({ ...rule, replaceHeaders: legacy });
  };

  return (
    <div className="space-y-2">
      <label className={labelCls}>Header Modifiers</label>
      {modifiers.length === 0 && Object.keys(legacyHeaders).length === 0 && (
        <div className="text-[11px] text-gray-400 italic py-2">No header modifiers. Click &quot;Add Header&quot; to create one.</div>
      )}
      {modifiers.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={m.action}
            onChange={(e) => updateModifier(i, { action: e.target.value as any })}
            className="px-2 py-1.5 rounded-lg border bg-transparent text-xs font-bold focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)', minWidth: '70px' }}
          >
            {headerActions.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <div className="flex-1">
            <HeaderKeyCombobox
              value={m.key}
              onChange={(k) => { updateModifier(i, { key: k }); setTimeout(syncLegacy, 0); }}
            />
          </div>
          {m.action === 'set' && (
            <div className="flex-1">
              <HeaderValueCombobox
                headerKey={m.key}
                value={m.value}
                onChange={(v) => { updateModifier(i, { value: v }); setTimeout(syncLegacy, 0); }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => removeModifier(i)}
            className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addModifier}
        className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium cursor-pointer"
        style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
      >
        <Plus className="w-3 h-3" /> Add Header
      </button>

      {/* Legacy headers display (read-only summary) */}
      {Object.keys(legacyHeaders).length > 0 && modifiers.length === 0 && (
        <div className="mt-3 p-2.5 rounded-lg border" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
          <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Legacy replaceHeaders (migrate to modifiers above)</div>
          {Object.entries(legacyHeaders).map(([k, v]) => (
            <div key={k} className="text-[11px] font-mono flex justify-between">
              <span className="font-bold">{k}:</span>
              <span className="truncate ml-2">{v}</span>
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
  inputStyle: React.CSSProperties;
}> = ({ rule, onChange, labelCls, monacoTheme, inputCls, inputStyle }) => {
  const bodyType = rule.bodyType || 'json';
  const setBodyType = (t: HttpBodyType) => onChange({ ...rule, bodyType: t });

  const formatJson = () => {
    try {
      const parsed = JSON.parse(rule.replaceBody || '');
      onChange({ ...rule, replaceBody: JSON.stringify(parsed, null, 2) });
    } catch {
      // ignore invalid JSON
    }
  };

  const formData: FormDataEntry[] = rule.formData || [];
  const updateFormEntry = (idx: number, patch: Partial<FormDataEntry>) => {
    const next = [...formData];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...rule, formData: next });
  };
  const addFormEntry = () => {
    onChange({ ...rule, formData: [...formData, { key: '', value: '', enabled: true }] });
  };
  const removeFormEntry = (idx: number) => {
    onChange({ ...rule, formData: formData.filter((_, i) => i !== idx) });
  };

  const monacoLanguage = useMemo(() => {
    switch (bodyType) {
      case 'json': return 'json';
      case 'xml': return 'xml';
      case 'html': return 'html';
      case 'graphql': return 'graphql';
      case 'base64': return 'plaintext';
      default: return 'plaintext';
    }
  }, [bodyType]);

  const isFormType = bodyType === 'form-urlencoded';
  const isMonacoType = !isFormType;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Body Type</label>
        <select
          value={bodyType}
          onChange={(e) => setBodyType(e.target.value as HttpBodyType)}
          className={inputCls}
          style={inputStyle}
        >
          {bodyTypes.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>

      {isMonacoType && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Replace Body</label>
            {bodyType === 'json' && (
              <button
                type="button"
                onClick={formatJson}
                className="text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
              >
                Format JSON
              </button>
            )}
          </div>
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--md-sys-color-divider)', height: '240px' }}>
            <Editor
              height="100%"
              language={monacoLanguage}
              theme={monacoTheme}
              value={rule.replaceBody || ''}
              onChange={(val) => onChange({ ...rule, replaceBody: val || '' })}
              options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on' }}
            />
          </div>
        </div>
      )}

      {isFormType && (
        <div className="space-y-2">
          <label className={labelCls}>Form Data Entries</label>
          {formData.length === 0 && (
            <div className="text-[11px] text-gray-400 italic py-2">No form data entries. Click &quot;Add Field&quot; to create one.</div>
          )}
          {formData.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={(e) => updateFormEntry(i, { enabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateFormEntry(i, { key: e.target.value })}
                placeholder="key"
                className="flex-1 px-2 py-1.5 rounded-lg border bg-transparent font-mono text-xs focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateFormEntry(i, { value: e.target.value })}
                placeholder="value"
                className="flex-1 px-2 py-1.5 rounded-lg border bg-transparent font-mono text-xs focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
              <button
                type="button"
                onClick={() => removeFormEntry(i)}
                className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFormEntry}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
          >
            <Plus className="w-3 h-3" /> Add Field
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== Advanced Tab (raw JSON) ====================
const AdvancedTab: React.FC<{
  rule: RewriteRule;
  onChange: (r: RewriteRule) => void;
  monacoTheme: string;
}> = ({ rule, onChange, monacoTheme }) => {
  const [jsonText, setJsonText] = useState(() => {
    try {
      return JSON.stringify(rule, null, 2);
    } catch {
      return '{}';
    }
  });
  const [error, setError] = useState<string | null>(null);

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Preserve the id and enabled flag from the original rule if missing.
      if (!parsed.id) parsed.id = rule.id;
      if (parsed.enabled === undefined) parsed.enabled = rule.enabled;
      onChange(parsed as RewriteRule);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-gray-600 dark:text-gray-300 text-[11px]">Raw Rule JSON (power users)</label>
        <button
          type="button"
          onClick={applyJson}
          className="text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--md-sys-color-surface-variant)' }}
        >
          Apply JSON
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--md-sys-color-divider)', height: '280px' }}>
        <Editor
          height="100%"
          language="json"
          theme={monacoTheme}
          value={jsonText}
          onChange={(val) => setJsonText(val || '')}
          options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on' }}
        />
      </div>
      {error && (
        <div className="text-[11px] text-red-500 font-mono">{error}</div>
      )}
      <div className="text-[10px] text-gray-500">
        Edit the full rule object as JSON. Click &quot;Apply JSON&quot; to load it into the builder. The id and enabled fields are preserved if missing.
      </div>
    </div>
  );
};
