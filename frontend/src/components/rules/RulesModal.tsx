import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  Globe, 
  Sliders, 
  Code2, 
  Lock, 
  ShieldAlert, 
  FileText, 
  Gauge,
  FolderOpen,
  FileCode,
  Save,
  Play,
  RotateCcw,
  Edit2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useProxyStore } from '../../store/useProxyStore';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { logger } from '../../store/useLogStore';
import { ColorfulIcon } from '../common/ColorfulIcon';
import { LottiePlayer } from '../common/LottiePlayer';
import { 
  COMMON_REQUEST_HEADERS, 
  COMMON_RESPONSE_HEADERS, 
  COMMON_HEADER_VALUES, 
  COMMON_STATUS_CODES, 
  MOCK_RESPONSE_TEMPLATES 
} from '../../constants/httpTemplates';

export const RulesModal: React.FC<{ isOpen: boolean; isEmbedded?: boolean; onClose: () => void }> = ({ 
  isOpen, 
  isEmbedded = false, 
  onClose 
}) => {
  const { renderTemplate } = useProxyStore();
  const { monacoTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'mock' | 'rewrite' | 'breakpoint' | 'script' | 'hosts' | 'throttle' | 'block' | 'crypto'>('mock');

  // ==================== 1. MOCK RULES STATE ====================
  const [mockRules, setMockRules] = useState<any[]>([
    {
      id: 'mock-1',
      name: 'Mock User Profile API',
      enabled: true,
      urlPattern: '*://api.example.com/v1/user/*',
      type: 'staticMock',
      statusCode: 200,
      contentType: 'application/json',
      headers: { 'Content-Type': 'application/json', 'X-Mocked-By': 'HTTPeek' },
      body: JSON.stringify({ id: 101, username: 'admin', role: 'developer', mocked: true }, null, 2),
    },
  ]);
  const [editingMock, setEditingMock] = useState<any | null>(null);

  // ==================== 2. REWRITE RULES STATE ====================
  const [rewriteRules, setRewriteRules] = useState<any[]>([
    {
      id: 'rw-1',
      name: 'Inject Auth Token & Custom Status',
      enabled: true,
      urlPattern: '*://api.example.com/*',
      type: 'requestUpdate',
      redirectUrl: '',
      items: [
        { id: 'item-1', type: 'addHeader', enabled: true, key: 'Authorization', value: 'Bearer {{token}}' },
        { id: 'item-2', type: 'replaceStatus', enabled: true, statusCode: 200 },
      ],
    },
  ]);
  const [editingRewrite, setEditingRewrite] = useState<any | null>(null);

  // ==================== 3. BREAKPOINT RULES STATE ====================
  const [breakpointRules, setBreakpointRules] = useState<any[]>([
    { id: 'bp-1', name: 'Pause Login Requests', enabled: true, urlPattern: '*://*/auth/login', method: 'POST', interceptRequest: true, interceptResponse: true },
  ]);
  const [editingBreakpoint, setEditingBreakpoint] = useState<any | null>(null);

  // ==================== 4. HOSTS RULES STATE ====================
  const [hostsRules, setHostsRules] = useState<any[]>([
    { id: 'host-1', name: 'Local Test API', enabled: true, pattern: 'api.test.local', targetIp: '127.0.0.1' },
    { id: 'host-2', name: 'Mock Staging Cluster', enabled: true, pattern: '*.staging.internal', targetIp: '192.168.1.100' },
  ]);
  const [editingHost, setEditingHost] = useState<any | null>(null);

  // ==================== 5. SCRIPT RULES STATE ====================
  const [scriptRules, setScriptRules] = useState<any[]>([
    {
      id: 'script-1',
      name: 'Default Transformation Script',
      enabled: true,
      urlPattern: '*://*/*',
      scriptCode: `/**
 * HTTPeek Go Scripting Engine
 * Transform requests and responses dynamically with JavaScript!
 */

function onRequest(context, request) {
    // Example: Inject custom header
    request.headers['X-HTTPeek-Script'] = 'Active';
    return request;
}

function onResponse(context, request, response) {
    // Example: Mutate JSON response body
    if (request.url.includes('/api/data')) {
        response.statusCode = 200;
        response.body = JSON.stringify({ injected: true, timestamp: Date.now() });
    }
    return response;
}`,
    },
  ]);
  const [editingScript, setEditingScript] = useState<any | null>(null);

  // ==================== 6. THROTTLE PROFILES STATE ====================
  const [throttleProfiles, setThrottleProfiles] = useState<any[]>([
    { id: 'th-1', name: '3G Profile', enabled: false, urlPattern: '', downstreamKbps: 750, upstreamKbps: 250, latencyMs: 100, dropRate: 0.5 },
  ]);

  // ==================== 7. BLOCK RULES STATE ====================
  const [blockRules, setBlockRules] = useState<any[]>([]);

  // ==================== 8. CRYPTO RULES STATE ====================
  const [cryptoRules, setCryptoRules] = useState<any[]>([]);

  // Load rules on modal open
  useEffect(() => {
    if (isOpen) {
      if ((window as any).go?.main?.App?.GetMockRules) {
        (window as any).go.main.App.GetMockRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setMockRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetRewriteRules) {
        (window as any).go.main.App.GetRewriteRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setRewriteRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetBreakpointRules) {
        (window as any).go.main.App.GetBreakpointRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setBreakpointRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetHostsRules) {
        (window as any).go.main.App.GetHostsRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setHostsRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetScriptRules) {
        (window as any).go.main.App.GetScriptRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setScriptRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetThrottleProfiles) {
        (window as any).go.main.App.GetThrottleProfiles().then((profiles: any[]) => {
          if (profiles && profiles.length > 0) setThrottleProfiles(profiles);
        });
      }
      if ((window as any).go?.main?.App?.GetBlockRules) {
        (window as any).go.main.App.GetBlockRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setBlockRules(rules);
        });
      }
      if ((window as any).go?.main?.App?.GetCryptoRules) {
        (window as any).go.main.App.GetCryptoRules().then((rules: any[]) => {
          if (rules && rules.length > 0) setCryptoRules(rules);
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Backend Synchronizers
  const syncMocks = async (rules: any[]) => {
    setMockRules(rules);
    if ((window as any).go?.main?.App?.SetMockRules) {
      await (window as any).go.main.App.SetMockRules(rules);
    }
  };

  const syncRewrites = async (rules: any[]) => {
    setRewriteRules(rules);
    if ((window as any).go?.main?.App?.SetRewriteRules) {
      await (window as any).go.main.App.SetRewriteRules(rules);
    }
  };

  const syncBreakpoints = async (rules: any[]) => {
    setBreakpointRules(rules);
    if ((window as any).go?.main?.App?.SetBreakpointRules) {
      await (window as any).go.main.App.SetBreakpointRules(rules);
    }
  };

  const syncHosts = async (rules: any[]) => {
    setHostsRules(rules);
    if ((window as any).go?.main?.App?.SetHostsRules) {
      await (window as any).go.main.App.SetHostsRules(rules);
    }
  };

  const syncScripts = async (rules: any[]) => {
    setScriptRules(rules);
    if ((window as any).go?.main?.App?.SetScriptRules) {
      await (window as any).go.main.App.SetScriptRules(rules);
    }
  };

  const syncThrottle = async (profiles: any[]) => {
    setThrottleProfiles(profiles);
    if ((window as any).go?.main?.App?.SetThrottleProfiles) {
      await (window as any).go.main.App.SetThrottleProfiles(profiles);
      toast.success('Throttle profiles saved');
    }
  };

  const syncBlock = async (rules: any[]) => {
    setBlockRules(rules);
    if ((window as any).go?.main?.App?.SetBlockRules) {
      await (window as any).go.main.App.SetBlockRules(rules);
      toast.success('Block rules saved');
    }
  };

  const syncCrypto = async (rules: any[]) => {
    setCryptoRules(rules);
    if ((window as any).go?.main?.App?.SetCryptoRules) {
      await (window as any).go.main.App.SetCryptoRules(rules);
      toast.success('Crypto rules saved');
    }
  };

  const content = (
    <div className={`font-sans select-none ${isEmbedded ? 'flex-1 flex flex-col h-full bg-[var(--htk-panel)]' : 'border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[86vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 bg-white dark:bg-gray-900'}`}>
      {!isEmbedded && (
      <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-2.5">
          <ColorfulIcon name="rules" size={22} />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Rule & Mutation Manager</h2>
            <p className="text-[11px] text-slate-400">Configure synthetic mocks, rewrite mutations, scripts, and breakpoints</p>
          </div>
        </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
      </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className={`${isEmbedded ? 'htk-subnav w-52' : 'w-56 bg-slate-50 border-r border-slate-200 p-2.5 space-y-1.5 shrink-0'}`}>
          {[
            { id: 'mock', label: 'Request Map (Mock)', iconName: 'composer', count: mockRules.length },
            { id: 'rewrite', label: 'Request Rewrite', iconName: 'rules', count: rewriteRules.length },
            { id: 'breakpoint', label: 'Breakpoints', iconName: 'stop', count: breakpointRules.length },
            { id: 'script', label: 'JavaScript Scripts', iconName: 'logs', count: scriptRules.length },
            { id: 'hosts', label: 'Hosts (DNS Map)', iconName: 'cloud', count: hostsRules.length },
            { id: 'block', label: 'Request Block', iconName: 'stop', count: blockRules.length },
            { id: 'crypto', label: 'Auto Decrypt', iconName: 'ssl', count: cryptoRules.length },
            { id: 'throttle', label: 'Network Throttle', iconName: 'speed', count: throttleProfiles.length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setEditingMock(null);
                  setEditingRewrite(null);
                  setEditingBreakpoint(null);
                  setEditingHost(null);
                  setEditingScript(null);
                }}
                className={isEmbedded
                  ? `htk-subnav-item ${isActive ? 'htk-subnav-item-active' : ''}`
                  : `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-emerald-950 font-bold border border-slate-200 shadow-sm translate-x-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:translate-x-0.5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ColorfulIcon name={tab.iconName as any} size={16} />
                  <span className="truncate">{tab.label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ml-1 ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className={`flex-1 p-6 overflow-y-auto flex flex-col ${isEmbedded ? 'bg-[var(--htk-bg)]' : 'bg-white'}`}>
          {/* ===================== 1. MOCK / REQUEST MAP TAB ===================== */}
          {activeTab === 'mock' && (
            <div className="flex-1 flex flex-col space-y-4">
              {editingMock ? (
                /* Mock Rule Editor Form */
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingMock.id.startsWith('new-') ? 'Create New Mock Rule' : 'Edit Mock Rule'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingMock(null)}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const exists = mockRules.some((r) => r.id === editingMock.id);
                          const updated = exists
                            ? mockRules.map((r) => (r.id === editingMock.id ? editingMock : r))
                            : [editingMock, ...mockRules];
                          syncMocks(updated);
                          setEditingMock(null);
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Mock Rule</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Rule Name</label>
                      <input
                        type="text"
                        value={editingMock.name}
                        onChange={(e) => setEditingMock({ ...editingMock, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">URL Match Pattern (Wildcard or Regex)</label>
                      <input
                        type="text"
                        value={editingMock.urlPattern}
                        onChange={(e) => setEditingMock({ ...editingMock, urlPattern: e.target.value })}
                        placeholder="*://api.example.com/v1/users/*"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-emerald-700 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mock Type</label>
                      <select
                        value={editingMock.type}
                        onChange={(e) => setEditingMock({ ...editingMock, type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white font-medium"
                      >
                        <option value="staticMock">Static Mock (Inline Body & Headers)</option>
                        <option value="localFile">Local File Map (Serve file from disk)</option>
                        <option value="localDir">Local Directory Map (Serve directory)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">HTTP Status Code</label>
                        <div className="flex items-center gap-1">
                          {[200, 201, 400, 401, 404, 500].map((code) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => setEditingMock({ ...editingMock, statusCode: code })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                editingMock.statusCode === code
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="number"
                        value={editingMock.statusCode || 200}
                        onChange={(e) => setEditingMock({ ...editingMock, statusCode: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {editingMock.type === 'staticMock' && (
                    <div className="flex-1 flex flex-col min-h-[260px]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 text-xs">
                          Synthetic Mock Response Body (JSON / XML / HTML)
                        </label>
                        <select
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const tmpl = MOCK_RESPONSE_TEMPLATES.find((t) => t.name === e.target.value);
                            if (tmpl) {
                              setEditingMock({
                                ...editingMock,
                                statusCode: tmpl.statusCode,
                                contentType: tmpl.contentType,
                                body: tmpl.body,
                              });
                              toast.info(`Applied template: ${tmpl.name}`);
                            }
                            e.target.value = '';
                          }}
                          className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold rounded-lg px-2 py-1 cursor-pointer focus:outline-none"
                        >
                          <option value="">⚡ Load Response Template...</option>
                          {MOCK_RESPONSE_TEMPLATES.map((tmpl) => (
                            <option key={tmpl.name} value={tmpl.name}>
                              {tmpl.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <Editor
                          height="100%"
                          language="json"
                          theme={monacoTheme}
                          value={editingMock.body || ''}
                          onChange={(val) => setEditingMock({ ...editingMock, body: val || '' })}
                          options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on' }}
                        />
                      </div>
                    </div>
                  )}

                  {editingMock.type === 'localFile' && (
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">Target Local File Path</label>
                      <input
                        type="text"
                        value={editingMock.targetFile || ''}
                        onChange={(e) => setEditingMock({ ...editingMock, targetFile: e.target.value })}
                        placeholder="C:\Mocks\response.json"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {editingMock.type === 'localDir' && (
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">Target Local Directory Path</label>
                      <input
                        type="text"
                        value={editingMock.targetDir || ''}
                        onChange={(e) => setEditingMock({ ...editingMock, targetDir: e.target.value })}
                        placeholder="C:\Mocks\static_assets"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Mock Rules List */
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Request Mapping & Synthetic Mocks</h3>
                      <p className="text-xs text-slate-500">Short-circuit remote network calls by returning synthetic responses or local files directly.</p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingMock({
                          id: 'new-' + Date.now(),
                          name: 'New Mock Rule',
                          enabled: true,
                          urlPattern: '*://api.example.com/*',
                          type: 'staticMock',
                          statusCode: 200,
                          contentType: 'application/json',
                          body: JSON.stringify({ message: 'Synthetic mock response', success: true }, null, 2),
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Mock Rule</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {mockRules.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        <Globe className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600 text-xs">No Mock Rules Configured</p>
                        <p className="text-[11px] mt-0.5">Click New Mock Rule to return synthetic mock payloads</p>
                      </div>
                    ) : (
                      mockRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition-colors shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => {
                                const updated = mockRules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                                syncMocks(updated);
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800 text-xs">{rule.name}</p>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {rule.statusCode || 200}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/60 text-slate-600">
                                  {rule.type}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">{rule.urlPattern}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingMock(rule)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                              title="Edit Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const updated = mockRules.filter((r) => r.id !== rule.id);
                                syncMocks(updated);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== 2. REWRITE TAB ===================== */}
          {activeTab === 'rewrite' && (
            <div className="flex-1 flex flex-col space-y-4">
              {editingRewrite ? (
                /* Rewrite Rule Editor Form */
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingRewrite.id.startsWith('new-') ? 'Create New Rewrite Rule' : 'Edit Rewrite Rule'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingRewrite(null)}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const exists = rewriteRules.some((r) => r.id === editingRewrite.id);
                          const updated = exists
                            ? rewriteRules.map((r) => (r.id === editingRewrite.id ? editingRewrite : r))
                            : [editingRewrite, ...rewriteRules];
                          syncRewrites(updated);
                          setEditingRewrite(null);
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Rewrite Rule</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Rule Name</label>
                      <input
                        type="text"
                        value={editingRewrite.name}
                        onChange={(e) => setEditingRewrite({ ...editingRewrite, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">URL Match Pattern</label>
                      <input
                        type="text"
                        value={editingRewrite.urlPattern}
                        onChange={(e) => setEditingRewrite({ ...editingRewrite, urlPattern: e.target.value })}
                        placeholder="*://api.example.com/*"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-emerald-700 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Rewrite Rule Type</label>
                      <select
                        value={editingRewrite.type}
                        onChange={(e) => setEditingRewrite({ ...editingRewrite, type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white font-medium"
                      >
                        <option value="requestUpdate">Request Update (Headers / Query / Path)</option>
                        <option value="responseUpdate">Response Update (Headers / Status / Body)</option>
                        <option value="redirect">Redirect (Route traffic to different URL)</option>
                      </select>
                    </div>
                    {editingRewrite.type === 'redirect' && (
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Target Redirect URL</label>
                        <input
                          type="text"
                          value={editingRewrite.redirectUrl || ''}
                          onChange={(e) => setEditingRewrite({ ...editingRewrite, redirectUrl: e.target.value })}
                          placeholder="https://new-api.example.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-sky-700"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rewrite Items / Actions Table */}
                  <div className="space-y-2 flex-1 flex flex-col font-mono text-xs">
                    <div className="flex justify-between items-center font-sans">
                      <label className="font-bold text-slate-700">Mutation Actions</label>
                      <button
                        onClick={() => {
                          const items = editingRewrite.items || [];
                          setEditingRewrite({
                            ...editingRewrite,
                            items: [
                              ...items,
                              { id: 'act-' + Date.now(), type: 'addHeader', enabled: true, key: '', value: '' },
                            ],
                          });
                        }}
                        className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Action</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(editingRewrite.items || []).map((item: any, idx: number) => (
                        <div key={item.id || idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <select
                            value={item.type}
                            onChange={(e) => {
                              const items = [...editingRewrite.items];
                              items[idx].type = e.target.value;
                              setEditingRewrite({ ...editingRewrite, items });
                            }}
                            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none font-medium w-40 shrink-0"
                          >
                            <option value="addHeader">Add Header</option>
                            <option value="updateHeader">Update Header</option>
                            <option value="removeHeader">Remove Header</option>
                            <option value="addQueryParam">Add Query Param</option>
                            <option value="updateQueryParam">Update Query Param</option>
                            <option value="replaceStatus">Replace Status</option>
                            <option value="updateBody">Regex Update Body</option>
                          </select>

                          {item.type === 'replaceStatus' ? (
                            <input
                              type="number"
                              placeholder="200"
                              value={item.statusCode || ''}
                              onChange={(e) => {
                                const items = [...editingRewrite.items];
                                items[idx].statusCode = Number(e.target.value);
                                setEditingRewrite({ ...editingRewrite, items });
                              }}
                              className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none font-mono font-bold"
                            />
                          ) : (
                            <>
                              <input
                                type="text"
                                placeholder="Key / Regex"
                                value={item.key || ''}
                                onChange={(e) => {
                                  const items = [...editingRewrite.items];
                                  items[idx].key = e.target.value;
                                  setEditingRewrite({ ...editingRewrite, items });
                                }}
                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none font-bold"
                              />
                              {item.type !== 'removeHeader' && (
                                <input
                                  type="text"
                                  placeholder="Value / Replace Template"
                                  value={item.value || ''}
                                  onChange={(e) => {
                                    const items = [...editingRewrite.items];
                                    items[idx].value = e.target.value;
                                    setEditingRewrite({ ...editingRewrite, items });
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                                />
                              )}
                            </>
                          )}

                          <button
                            onClick={() => {
                              const items = editingRewrite.items.filter((_: any, i: number) => i !== idx);
                              setEditingRewrite({ ...editingRewrite, items });
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Rewrite Rules List */
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Request & Response Rewrite</h3>
                      <p className="text-xs text-slate-500">Mutate headers, query params, path, status codes, and regex payload replace.</p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingRewrite({
                          id: 'new-' + Date.now(),
                          name: 'New Rewrite Rule',
                          enabled: true,
                          urlPattern: '*://api.example.com/*',
                          type: 'requestUpdate',
                          redirectUrl: '',
                          items: [{ id: 'item-1', type: 'addHeader', enabled: true, key: 'X-Custom-Header', value: 'HTTPeek' }],
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Rewrite Rule</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rewriteRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => {
                              const updated = rewriteRules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                              syncRewrites(updated);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800 text-xs">{rule.name}</p>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200">
                                {rule.type}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({rule.items?.length || 0} actions)
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">{rule.urlPattern}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingRewrite(rule)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="Edit Rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const updated = rewriteRules.filter((r) => r.id !== rule.id);
                              syncRewrites(updated);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== 3. BREAKPOINTS TAB ===================== */}
          {activeTab === 'breakpoint' && (
            <div className="flex-1 flex flex-col space-y-4">
              {editingBreakpoint ? (
                /* Breakpoint Editor Form */
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingBreakpoint.id.startsWith('new-') ? 'Create New Breakpoint Rule' : 'Edit Breakpoint Rule'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingBreakpoint(null)}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const exists = breakpointRules.some((r) => r.id === editingBreakpoint.id);
                          const updated = exists
                            ? breakpointRules.map((r) => (r.id === editingBreakpoint.id ? editingBreakpoint : r))
                            : [editingBreakpoint, ...breakpointRules];
                          syncBreakpoints(updated);
                          setEditingBreakpoint(null);
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Breakpoint</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Breakpoint Name</label>
                      <input
                        type="text"
                        value={editingBreakpoint.name}
                        onChange={(e) => setEditingBreakpoint({ ...editingBreakpoint, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">URL Match Pattern</label>
                      <input
                        type="text"
                        value={editingBreakpoint.urlPattern}
                        onChange={(e) => setEditingBreakpoint({ ...editingBreakpoint, urlPattern: e.target.value })}
                        placeholder="*://api.example.com/*"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-emerald-700 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">HTTP Method Filter</label>
                      <select
                        value={editingBreakpoint.method || ''}
                        onChange={(e) => setEditingBreakpoint({ ...editingBreakpoint, method: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white font-medium"
                      >
                        <option value="">All Methods (GET, POST, PUT, DELETE...)</option>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-6 pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingBreakpoint.interceptRequest}
                          onChange={(e) => setEditingBreakpoint({ ...editingBreakpoint, interceptRequest: e.target.checked })}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-0"
                        />
                        <span>Intercept Request</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingBreakpoint.interceptResponse}
                          onChange={(e) => setEditingBreakpoint({ ...editingBreakpoint, interceptResponse: e.target.checked })}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-0"
                        />
                        <span>Intercept Response</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Breakpoints List */
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Traffic Breakpoints</h3>
                      <p className="text-xs text-slate-500">Pause matching requests or responses for live inspection and inline modification.</p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingBreakpoint({
                          id: 'new-' + Date.now(),
                          name: 'New Breakpoint Rule',
                          enabled: true,
                          urlPattern: '*://api.example.com/*',
                          method: '',
                          interceptRequest: true,
                          interceptResponse: true,
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Breakpoint</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {breakpointRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => {
                              const updated = breakpointRules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                              syncBreakpoints(updated);
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800 text-xs">{rule.name}</p>
                              {rule.method && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                  {rule.method}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">{rule.urlPattern}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {rule.interceptRequest && <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 border border-sky-200 font-medium">Req</span>}
                            {rule.interceptResponse && <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">Resp</span>}
                          </div>
                          <button
                            onClick={() => setEditingBreakpoint(rule)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="Edit Rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const updated = breakpointRules.filter((r) => r.id !== rule.id);
                              syncBreakpoints(updated);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== 4. SCRIPT TAB ===================== */}
          {activeTab === 'script' && (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">JavaScript Scripting Engine</h3>
                  <p className="text-xs text-slate-500">Programmatically intercept, inspect, and transform requests & responses with JavaScript.</p>
                </div>
                <button
                  onClick={() => {
                    syncScripts(scriptRules);
                    toast.success('JavaScript scripts applied to proxy engine');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Scripts</span>
                </button>
              </div>

              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-xs min-h-[380px]">
                <Editor
                  height="100%"
                  theme={monacoTheme}
                  defaultLanguage="javascript"
                  value={scriptRules[0]?.scriptCode || ''}
                  onChange={(val) => {
                    const updated = [...scriptRules];
                    if (updated.length > 0) {
                      updated[0].scriptCode = val || '';
                      setScriptRules(updated);
                    }
                  }}
                  options={{
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                  }}
                />
              </div>
            </div>
          )}

          {/* ===================== 5. HOSTS TAB ===================== */}
          {activeTab === 'hosts' && (
            <div className="flex-1 flex flex-col space-y-4">
              {editingHost ? (
                /* Host Editor Form */
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingHost.id.startsWith('new-') ? 'Add New Host Mapping Rule' : 'Edit Host Mapping Rule'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingHost(null)}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const exists = hostsRules.some((r) => r.id === editingHost.id);
                          const updated = exists
                            ? hostsRules.map((r) => (r.id === editingHost.id ? editingHost : r))
                            : [editingHost, ...hostsRules];
                          syncHosts(updated);
                          setEditingHost(null);
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Host Rule</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Rule Name</label>
                      <input
                        type="text"
                        value={editingHost.name}
                        onChange={(e) => setEditingHost({ ...editingHost, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Domain Pattern (e.g. *.example.com)</label>
                      <input
                        type="text"
                        value={editingHost.pattern}
                        onChange={(e) => setEditingHost({ ...editingHost, pattern: e.target.value })}
                        placeholder="api.test.local"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-emerald-700 font-medium"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Target Destination IP</label>
                      <input
                        type="text"
                        value={editingHost.targetIp}
                        onChange={(e) => setEditingHost({ ...editingHost, targetIp: e.target.value })}
                        placeholder="127.0.0.1"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-sky-700 font-medium"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Hosts List */
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Hosts DNS Redirection Mapping</h3>
                      <p className="text-xs text-slate-500">Map specific domains or wildcards directly to target IP addresses.</p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingHost({
                          id: 'new-' + Date.now(),
                          name: 'New Host Mapping',
                          pattern: 'api.test.local',
                          targetIp: '127.0.0.1',
                          enabled: true,
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Host Rule</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-sans">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Active</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Domain Pattern</th>
                          <th className="py-2.5 px-3">Target IP</th>
                          <th className="py-2.5 px-3 w-20 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hostsRules.map((rule) => (
                          <tr key={rule.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={() => {
                                  const updated = hostsRules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                                  syncHosts(updated);
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-sans font-semibold">{rule.name}</td>
                            <td className="py-2 px-3 text-emerald-700 font-bold">{rule.pattern}</td>
                            <td className="py-2 px-3 text-sky-700">{rule.targetIp}</td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setEditingHost(rule)}
                                  className="p-1 text-slate-400 hover:text-emerald-700 cursor-pointer"
                                  title="Edit Rule"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const updated = hostsRules.filter((r) => r.id !== rule.id);
                                    syncHosts(updated);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete Rule"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== 6. THROTTLE TAB ===================== */}
          {activeTab === 'throttle' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Network Condition & Throttling</h3>
                  <p className="text-xs text-slate-500">Simulate 2G, 3G, 4G, DSL, packet loss, and high latency network conditions.</p>
                </div>
                <button
                  onClick={() => syncThrottle(throttleProfiles)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Save Profiles
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'th-2g', name: '2G (GPRS)', downstreamKbps: 50, upstreamKbps: 20, latencyMs: 500, dropRate: 2 },
                  { id: 'th-3g', name: '3G (HSPA)', downstreamKbps: 750, upstreamKbps: 250, latencyMs: 100, dropRate: 0.5 },
                  { id: 'th-4g', name: '4G (LTE)', downstreamKbps: 4000, upstreamKbps: 1500, latencyMs: 30, dropRate: 0 },
                  { id: 'th-dsl', name: 'DSL', downstreamKbps: 2000, upstreamKbps: 512, latencyMs: 40, dropRate: 0 },
                ].map((preset) => (
                  <div key={preset.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-slate-800 text-xs">{preset.name}</p>
                      <button
                        onClick={() => {
                          const next = throttleProfiles.map((p) => ({ ...p, enabled: p.id === preset.id }));
                          const exists = throttleProfiles.some((p) => p.id === preset.id);
                          const profile = { ...preset, enabled: true, urlPattern: '' };
                          syncThrottle(exists ? next : [...throttleProfiles.map((p) => ({ ...p, enabled: false })), profile]);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        Activate Preset
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                      <span>Download: {preset.downstreamKbps} KB/s</span>
                      <span>Upload: {preset.upstreamKbps} KB/s</span>
                      <span>Latency: {preset.latencyMs} ms</span>
                      <span>Loss: {preset.dropRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================== 7. BLOCK TAB ===================== */}
          {activeTab === 'block' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Request Block Rules</h3>
                <button
                  onClick={() => syncBlock([...blockRules, {
                    id: `block-${Date.now()}`,
                    name: 'New Block Rule',
                    enabled: true,
                    urlPattern: '*://*/*',
                    action: '403',
                  }])}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Add Rule
                </button>
              </div>
              {blockRules.length === 0 ? (
                <p className="text-xs text-slate-500">No block rules configured.</p>
              ) : (
                blockRules.map((rule, idx) => (
                  <div key={rule.id} className="p-3 border border-slate-200 rounded-xl space-y-2">
                    <input
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1"
                      value={rule.name}
                      onChange={(e) => {
                        const next = [...blockRules];
                        next[idx] = { ...rule, name: e.target.value };
                        setBlockRules(next);
                      }}
                    />
                    <input
                      className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2 py-1"
                      value={rule.urlPattern}
                      onChange={(e) => {
                        const next = [...blockRules];
                        next[idx] = { ...rule, urlPattern: e.target.value };
                        setBlockRules(next);
                      }}
                    />
                    <div className="flex gap-2">
                      <select
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                        value={rule.action || '403'}
                        onChange={(e) => {
                          const next = [...blockRules];
                          next[idx] = { ...rule, action: e.target.value };
                          setBlockRules(next);
                        }}
                      >
                        <option value="403">403 Forbidden</option>
                        <option value="drop">Drop Connection</option>
                      </select>
                      <button onClick={() => syncBlock(blockRules)} className="text-xs px-2 py-1 bg-slate-100 rounded-lg cursor-pointer">Save</button>
                      <button onClick={() => syncBlock(blockRules.filter((r) => r.id !== rule.id))} className="text-xs px-2 py-1 text-rose-600 cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ===================== 8. CRYPTO TAB ===================== */}
          {activeTab === 'crypto' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Auto Decryption Rules</h3>
                <button
                  onClick={() => syncCrypto([...cryptoRules, {
                    id: `crypto-${Date.now()}`,
                    name: 'New Crypto Rule',
                    enabled: true,
                    urlPattern: '*://*/*',
                    algorithm: 'AES_CBC',
                    encoding: 'base64',
                    key: '',
                    iv: '',
                    decryptReq: true,
                    decryptRes: true,
                  }])}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Add Rule
                </button>
              </div>
              {cryptoRules.length === 0 ? (
                <p className="text-xs text-slate-500">No crypto decryption rules configured.</p>
              ) : (
                cryptoRules.map((rule, idx) => (
                  <div key={rule.id} className="p-3 border border-slate-200 rounded-xl space-y-2">
                    <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1" value={rule.name} onChange={(e) => {
                      const next = [...cryptoRules]; next[idx] = { ...rule, name: e.target.value }; setCryptoRules(next);
                    }} />
                    <input className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2 py-1" placeholder="URL pattern" value={rule.urlPattern} onChange={(e) => {
                      const next = [...cryptoRules]; next[idx] = { ...rule, urlPattern: e.target.value }; setCryptoRules(next);
                    }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="text-xs border border-slate-200 rounded-lg px-2 py-1" placeholder="Key" value={rule.key || ''} onChange={(e) => {
                        const next = [...cryptoRules]; next[idx] = { ...rule, key: e.target.value }; setCryptoRules(next);
                      }} />
                      <input className="text-xs border border-slate-200 rounded-lg px-2 py-1" placeholder="IV" value={rule.iv || ''} onChange={(e) => {
                        const next = [...cryptoRules]; next[idx] = { ...rule, iv: e.target.value }; setCryptoRules(next);
                      }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => syncCrypto(cryptoRules)} className="text-xs px-2 py-1 bg-slate-100 rounded-lg cursor-pointer">Save</button>
                      <button onClick={() => syncCrypto(cryptoRules.filter((r) => r.id !== rule.id))} className="text-xs px-2 py-1 text-rose-600 cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="htk-modal-overlay select-none font-sans">
      {content}
    </div>
  );
};
