import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Shield, Sparkles, Check, Search, Globe, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { Dialog, FormMonospaceInput } from '../ui/Dialog';

interface FilterDialogProps {
  onClose: () => void;
}

const SMART_PRESETS = [
  {
    name: 'Ad & Analytics Trackers',
    domains: [
      '*.google-analytics.com',
      '*.analytics.google.com',
      '*.mixpanel.com',
      '*.segment.io',
      '*.appsflyer.com',
      '*.doubleclick.net',
      '*.crashlytics.com',
    ],
  },
  {
    name: 'Apple System Telemetry',
    domains: [
      '*.apple-cloudkit.com',
      '*.push.apple.com',
      '*.configuration.apple.com',
    ],
  },
  {
    name: 'Windows OS Telemetry',
    domains: [
      '*.telemetry.microsoft.com',
      '*.vortex.data.microsoft.com',
      '*.windowsupdate.com',
    ],
  },
];

export const FilterDialog: React.FC<FilterDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { filterConfig, setFilterConfig, requests } = useProxyStore();

  const [mode, setMode] = useState<'blacklist' | 'whitelist'>(
    filterConfig.mode === 'whitelist' ? 'whitelist' : 'blacklist'
  );
  const [rules, setRules] = useState<string[]>(filterConfig.rules || []);
  const [newRule, setNewRule] = useState('');
  const [testDomain, setTestDomain] = useState('');

  // Extract top domains from captured session
  const activeDomains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const req of requests) {
      if (req.hostPort?.host) {
        const h = req.hostPort.host;
        counts.set(h, (counts.get(h) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([domain]) => domain);
  }, [requests]);

  const handleAddRule = (val?: string) => {
    const target = (val || newRule).trim();
    if (!target) return;
    if (rules.includes(target)) {
      toast.info('Rule already exists');
      return;
    }
    setRules([...rules, target]);
    if (!val) setNewRule('');
  };

  const handleAddPreset = (presetDomains: string[]) => {
    const newItems = presetDomains.filter((d) => !rules.includes(d));
    if (newItems.length === 0) {
      toast.info('All preset domains already added');
      return;
    }
    setRules([...rules, ...newItems]);
    toast.success('Preset Applied', `Added ${newItems.length} domains`);
  };

  const handleRemoveRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    try {
      const cfg = { mode, rules };
      if (api.setFilterConfig) {
        await api.setFilterConfig(cfg);
      }
      setFilterConfig(cfg);
      toast.success(t.saveSuccess || 'Saved', 'Domain filter rules updated');
      onClose();
    } catch (e: any) {
      toast.error(t.fail || 'Error', e?.message);
    }
  };

  // Live pattern test matching
  const testMatchResult = useMemo(() => {
    if (!testDomain.trim()) return null;
    const test = testDomain.trim().toLowerCase();
    for (const r of rules) {
      const pattern = r.trim().toLowerCase();
      if (pattern === test) return { matched: true, rule: r };
      if (pattern.startsWith('*.')) {
        const suffix = pattern.substring(2);
        if (test.endsWith(suffix) || test === suffix) {
          return { matched: true, rule: r };
        }
      }
      if (pattern.endsWith('*')) {
        const prefix = pattern.substring(0, pattern.length - 1);
        if (test.startsWith(prefix)) {
          return { matched: true, rule: r };
        }
      }
      if (test.includes(pattern)) {
        return { matched: true, rule: r };
      }
    }
    return { matched: false, rule: null };
  }, [testDomain, rules]);

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t.domainFilter || 'Domain Filter (Whitelist / Blacklist)'}
      subtitle="Filter traffic by domain names using Blacklist (skip non-essential) or Whitelist (capture ONLY) modes."
      icon={<Shield className="w-5 h-5 text-emerald-400" />}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button type="button" onClick={onClose} className="btn-ghost">
            {t.cancel || 'Cancel'}
          </button>
          <button type="button" onClick={handleSave} className="btn-primary">
            {t.save || 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-xs select-none">
        {/* Mode Selector */}
        <div
          className="flex items-center gap-4 p-3 rounded-xl border"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-raised)',
          }}
        >
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'blacklist'}
              onChange={() => setMode('blacklist')}
              className="accent-emerald-500 cursor-pointer"
            />
            <span>Blacklist (Skip / ignore matched domains)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'whitelist'}
              onChange={() => setMode('whitelist')}
              className="accent-emerald-500 cursor-pointer"
            />
            <span>Whitelist (Capture ONLY matched domains)</span>
          </label>
        </div>

        {/* Smart Noise Presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Quick Presets
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {SMART_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleAddPreset(preset.domains)}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                + {preset.name} ({preset.domains.length})
              </button>
            ))}
          </div>
        </div>

        {/* Suggestions from Active Session */}
        {activeDomains.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Active Traffic Domains
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => handleAddRule(`*.${domain}`)}
                  className="px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  + *.{domain}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Input */}
        <div className="flex items-center gap-2">
          <FormMonospaceInput
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddRule();
            }}
            placeholder="e.g. *.apple.com, api.test.com, localhost"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => handleAddRule()}
            className="btn-primary py-2 px-3.5 text-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Domain</span>
          </button>
        </div>

        {/* Live Match Tester */}
        <div
          className="p-3 rounded-xl border flex flex-col gap-2"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-raised)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              Live Filter Match Tester
            </span>
            {testMatchResult && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  testMatchResult.matched
                    ? mode === 'whitelist'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                    : mode === 'whitelist'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {testMatchResult.matched
                  ? `${mode === 'whitelist' ? 'CAPTURED' : 'BLOCKED/SKIPPED'} by ${testMatchResult.rule}`
                  : `${mode === 'whitelist' ? 'DROPPED (Not in whitelist)' : 'CAPTURED (Not blacklisted)'}`}
              </span>
            )}
          </div>
          <input
            type="text"
            value={testDomain}
            onChange={(e) => setTestDomain(e.target.value)}
            placeholder="Type sample domain e.g. api.apple.com to test matching..."
            className="w-full px-3 py-1.5 rounded-lg border bg-black/10 dark:bg-black/30 font-mono text-xs focus:outline-none"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* Rules List */}
        <div
          className="max-h-52 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 font-mono text-[11px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-neutral-400 py-6 italic text-xs">
              No filter rules defined. All traffic is captured.
            </div>
          ) : (
            rules.map((rule, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="font-mono text-emerald-400">{rule}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRule(idx)}
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
    </Dialog>
  );
};
