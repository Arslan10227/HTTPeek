import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Check,
  Moon,
  Sun,
  Monitor,
  Palette,
  Globe,
  Radio,
  Shield,
  Trash2,
  Plus,
  FolderOpen,
  HelpCircle,
  Layers,
  Sliders,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig, ThemeMode } from '../../theme/useAppConfig';
import { ColorMapping } from '../../theme/colors';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { Dialog, FormSection, FormLabel, FormInput, FormMonospaceInput } from '../ui/Dialog';

interface PreferenceDialogProps {
  onClose: () => void;
  initialTab?: 'general' | 'proxy' | 'filter' | 'storage';
}

export const PreferenceDialog: React.FC<PreferenceDialogProps> = ({ onClose, initialTab = 'general' }) => {
  const { t, language, setLanguage } = useTranslation();
  const {
    themeMode,
    setThemeMode,
    themeColor,
    setThemeColor,
    autoStartup,
    setAutoStartup,
    minimizeToTray,
    setMinimizeToTray,
    clearConfirm,
    setClearConfirm,
    enabledHttp2,
    setEnabledHttp2,
    enableSocks5,
    setEnableSocks5,
    proxyPassDomains,
    setProxyPassDomains,
    memoryCleanupThreshold,
    setMemoryCleanupThreshold,
    getActiveColorPreset,
  } = useAppConfig();

  const { status, setStatus, filterConfig, setFilterConfig } = useProxyStore();
  const activeColor = getActiveColorPreset();

  const [activeTab, setActiveTab] = useState<'general' | 'proxy' | 'filter' | 'storage'>(initialTab);
  const [portInput, setPortInput] = useState<string>(String(status.port || 9099));
  const [maxReqInput, setMaxReqInput] = useState(String(useProxyStore.getState().maxRequests || 10000));
  const [isHarAssoc, setIsHarAssoc] = useState(false);

  // Filter rules state
  const [filterMode, setFilterMode] = useState<'blacklist' | 'whitelist'>(
    filterConfig.mode === 'whitelist' ? 'whitelist' : 'blacklist'
  );
  const [filterRules, setFilterRules] = useState<string[]>(filterConfig.rules || []);
  const [newFilterRule, setNewFilterRule] = useState('');

  useEffect(() => {
    if ((window as any).go?.main?.App?.IsHARAssociated) {
      (window as any).go.main.App.IsHARAssociated().then(setIsHarAssoc).catch(() => {});
    }
  }, []);

  const handleToggleHAR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsHarAssoc(checked);
    try {
      if (checked) {
        if ((window as any).go?.main?.App?.RegisterHARAssociation) {
          await (window as any).go.main.App.RegisterHARAssociation();
          toast.success('File Association Active', '.har files will now open in HTTPeek');
        }
      } else {
        if ((window as any).go?.main?.App?.UnregisterHARAssociation) {
          await (window as any).go.main.App.UnregisterHARAssociation();
          toast.info('File Association Removed', '.har files unassociated');
        }
      }
    } catch (err: any) {
      toast.error('File Association Failed', err.message || String(err));
      setIsHarAssoc(!checked);
    }
  };

  const handleUpdatePort = async () => {
    const p = parseInt(portInput, 10);
    if (isNaN(p) || p < 1 || p > 65535) {
      toast.warning('Invalid Port', 'Port must be between 1 and 65535');
      return;
    }
    try {
      await api.setPort(p);
      setStatus({ ...status, port: p });
      toast.success(t.saveSuccess || 'Saved', `Proxy listening port changed to ${p}`);
    } catch (e: any) {
      toast.error('Port Change Failed', e?.message || String(e));
    }
  };

  const handleToggleSystemProxy = async () => {
    try {
      const next = !status.systemProxyEnabled;
      await api.setSystemProxy(next);
      setStatus({ ...status, systemProxyEnabled: next });
      toast.info(`System Proxy ${next ? 'Enabled' : 'Disabled'}`);
    } catch (e: any) {
      toast.error('System Proxy Error', e?.message || String(e));
    }
  };

  const handleAddFilterRule = () => {
    if (!newFilterRule.trim()) return;
    if (filterRules.includes(newFilterRule.trim())) {
      toast.info('Domain Rule Exists', 'This rule is already in the list');
      return;
    }
    const updated = [...filterRules, newFilterRule.trim()];
    setFilterRules(updated);
    setNewFilterRule('');
    saveFilterConfig(filterMode, updated);
  };

  const handleRemoveFilterRule = (idx: number) => {
    const updated = filterRules.filter((_, i) => i !== idx);
    setFilterRules(updated);
    saveFilterConfig(filterMode, updated);
  };

  const handleFilterModeChange = (mode: 'blacklist' | 'whitelist') => {
    setFilterMode(mode);
    saveFilterConfig(mode, filterRules);
  };

  const saveFilterConfig = async (mode: 'blacklist' | 'whitelist', rules: string[]) => {
    try {
      const cfg = { mode, rules };
      await api.setFilterConfig(cfg);
      setFilterConfig(cfg);
    } catch (e: any) {
      toast.error('Filter Save Error', e?.message || String(e));
    }
  };

  const memoryCleanupOptions = [
    { label: t.followSystem || 'Auto (System Default)', value: null },
    { label: '512 MB', value: 512 },
    { label: '1024 MB (1 GB)', value: 1024 },
    { label: '2048 MB (2 GB)', value: 2048 },
    { label: '4096 MB (4 GB)', value: 4096 },
  ];

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Preferences & Settings"
      subtitle="Configure application preferences, proxy runtime, filtering, and storage."
      icon={<SettingsIcon className="w-5 h-5" />}
      maxWidth="max-w-2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
        >
          {t.close || 'Done'}
        </button>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
          {[
            { id: 'general' as const, label: 'Appearance & UI', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'proxy' as const, label: 'Proxy & Network', icon: <Radio className="w-3.5 h-3.5" /> },
            { id: 'filter' as const, label: 'Domain Filter', icon: <Shield className="w-3.5 h-3.5" /> },
            { id: 'storage' as const, label: 'Limits & Logs', icon: <Cpu className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`chip cursor-pointer transition-all ${isActive ? 'chip-active' : ''}`}
                style={isActive ? { background: `${activeColor.hex}18`, color: activeColor.hex, borderColor: `${activeColor.hex}40` } : {}}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: General & Appearance ────────────────────── */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-100">
            {/* Theme Mode Selector */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Theme Mode</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Choose light, dark, or system appearance</div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
                {[
                  { mode: 'system' as ThemeMode, icon: <Monitor className="w-3.5 h-3.5" />, label: 'System' },
                  { mode: 'light' as ThemeMode, icon: <Sun className="w-3.5 h-3.5" />, label: 'Light' },
                  { mode: 'dark' as ThemeMode, icon: <Moon className="w-3.5 h-3.5" />, label: 'Dark' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setThemeMode(item.mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      themeMode === item.mode
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Palette */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Accent Color</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Choose your workspace theme highlight</div>
              </div>
              <div className="flex items-center gap-2">
                {Object.entries(ColorMapping).map(([key, val]) => {
                  const isSelected = themeColor === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setThemeColor(key as any)}
                      className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-xs relative"
                      style={{ backgroundColor: val.hex }}
                      title={key}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{t.language || 'Display Language'}</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Interface locale and translations</div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="input-base w-36 cursor-pointer"
              >
                <option value="en">English</option>
                <option value="zh">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="ja">日本語</option>
              </select>
            </div>

            <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Auto Startup */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{t.autoStartup || 'Launch on Startup'}</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Automatically launch HTTPeek when logging into the OS</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStartup}
                  onChange={(e) => setAutoStartup(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    autoStartup ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            {/* Minimize to tray */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Minimize to System Tray</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Keep background proxy active in notification area on close</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={minimizeToTray}
                  onChange={(e) => setMinimizeToTray(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    minimizeToTray ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            {/* Clear Confirmation */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{t.clearConfirm || 'Confirm on Clear'}</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Show confirmation prompt before clearing captured requests</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearConfirm}
                  onChange={(e) => setClearConfirm(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    clearConfirm ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            {/* HAR File Association */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Associate with .HAR Files</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Open .har HTTP archives directly with HTTPeek</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHarAssoc}
                  onChange={handleToggleHAR}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    isHarAssoc ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>
          </div>
        )}

        {/* ── TAB 2: Proxy & Network ─────────────────────────── */}
        {activeTab === 'proxy' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-100">
            {/* Listening Port */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Proxy Listening Port</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>TCP port for HTTP/CONNECT and SOCKS5 proxy</div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="input-base w-24 text-right font-mono"
                  min={1024}
                  max={65535}
                />
                <button
                  type="button"
                  onClick={handleUpdatePort}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  Save Port
                </button>
              </div>
            </div>

            {/* System Proxy */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>OS System Proxy Routing</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Automatically configure Windows/macOS network proxy settings</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={status.systemProxyEnabled}
                  onChange={handleToggleSystemProxy}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    status.systemProxyEnabled ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            {/* SOCKS5 Support */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>SOCKS5 Protocol Support</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Allow clients to connect via socks5:// protocol on the same port</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSocks5}
                  onChange={(e) => setEnableSocks5(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    enableSocks5 ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            {/* HTTP/2 ALPN */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>HTTP/2 Protocol Support</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Negotiate HTTP/2 framing via ALPN on TLS connections</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledHttp2}
                  onChange={(e) => setEnabledHttp2(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    enabledHttp2 ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                  }`}
                />
              </label>
            </div>

            <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Proxy Ignore / Bypass Domains */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold" style={{ color: 'var(--color-text)' }}>Bypass / Ignore Domains</div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Traffic to these hosts will bypass system proxy (semicolon separated)</div>
                </div>
                <button
                  type="button"
                  onClick={() => setProxyPassDomains('localhost;127.0.0.1;*.local;')}
                  className="text-xs font-semibold text-blue-400 hover:underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
              <FormMonospaceInput
                value={proxyPassDomains}
                onChange={(e) => setProxyPassDomains(e.target.value)}
                placeholder="localhost;127.0.0.1;*.local"
              />
            </div>
          </div>
        )}

        {/* ── TAB 3: Domain Filter (Blacklist / Whitelist) ────── */}
        {activeTab === 'filter' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-100">
            {/* Filter Mode Radio Toggle */}
            <div className="flex items-center gap-4 p-3 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--color-border)' }}>
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="radio"
                  name="filterMode"
                  checked={filterMode === 'blacklist'}
                  onChange={() => handleFilterModeChange('blacklist')}
                  className="accent-emerald-500 cursor-pointer"
                />
                <span>Blacklist (Capture everything EXCEPT these domains)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="radio"
                  name="filterMode"
                  checked={filterMode === 'whitelist'}
                  onChange={() => handleFilterModeChange('whitelist')}
                  className="accent-emerald-500 cursor-pointer"
                />
                <span>Whitelist (Capture ONLY these domains)</span>
              </label>
            </div>

            {/* Add Rule Row */}
            <div className="flex items-center gap-2">
              <FormMonospaceInput
                value={newFilterRule}
                onChange={(e) => setNewFilterRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFilterRule();
                }}
                placeholder="e.g. *.google.com, api.example.com, localhost"
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleAddFilterRule}
                className="btn-primary py-2 px-3.5 text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Domain</span>
              </button>
            </div>

            {/* Rules List */}
            <div
              className="max-h-56 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 font-mono text-[11px]"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-raised)',
              }}
            >
              {filterRules.length === 0 ? (
                <div className="text-center text-neutral-400 py-6 italic text-xs">
                  No domain filter rules active. All traffic is captured.
                </div>
              ) : (
                filterRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <span className="font-mono text-emerald-400">{rule}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFilterRule(idx)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-red-400 cursor-pointer transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: Storage, Memory & Logs ──────────────────── */}
        {activeTab === 'storage' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-100">
            {/* Max Requests Limit */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Max In-Memory Requests</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Oldest captured requests are purged when threshold is reached</div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={maxReqInput}
                  onChange={(e) => setMaxReqInput(e.target.value)}
                  className="input-base w-24 text-right font-mono"
                  min={100}
                  max={100000}
                  step={1000}
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(maxReqInput, 10);
                    if (!isNaN(n) && n >= 100) {
                      useProxyStore.getState().setMaxRequests(n);
                      toast.success(t.saveSuccess || 'Saved', `Max requests set to ${n}`);
                    }
                  }}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Memory Cleanup Threshold */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Memory Retention Cap</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Force garbage collection and SQLite disk flush at target memory</div>
              </div>
              <select
                value={memoryCleanupThreshold === null ? 'null' : String(memoryCleanupThreshold)}
                onChange={(e) => {
                  const v = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                  setMemoryCleanupThreshold(v);
                }}
                className="input-base w-40 cursor-pointer"
              >
                {memoryCleanupOptions.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Diagnostics & Logs Folder */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>Application Log Files</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Open runtime proxy logs and SQLite session databases in File Explorer</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await api.openLogFolder();
                  toast.info('Opening logs folder in Explorer');
                }}
                className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Logs Folder</span>
              </button>
            </div>

            {/* About HTTPeek */}
            <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5 flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="font-bold text-xs" style={{ color: 'var(--color-text)' }}>HTTPeek v1.0.0 (Wails v2 + Go + React)</div>
                <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>High-performance cross-platform HTTP/HTTPS/WebSocket debugging workbench.</div>
              </div>
              <button
                type="button"
                onClick={() => window.open('https://github.com/Arslan10227/HTTPeek', '_blank')}
                className="text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
              >
                GitHub Repo
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
