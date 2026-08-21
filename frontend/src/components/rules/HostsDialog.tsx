import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Globe, Check, Server, Laptop, Smartphone, Save, ListFilter } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { HostRule } from '../../types';

interface HostsDialogProps {
  onClose: () => void;
}

const IP_PRESETS = [
  { ip: '127.0.0.1', label: '127.0.0.1 (Localhost)', icon: <Laptop className="w-3.5 h-3.5 text-emerald-500" /> },
  { ip: '10.0.2.2', label: '10.0.2.2 (Android Host)', icon: <Smartphone className="w-3.5 h-3.5 text-blue-500" /> },
  { ip: '::1', label: '::1 (IPv6 Local)', icon: <Server className="w-3.5 h-3.5 text-purple-500" /> },
  { ip: '0.0.0.0', label: '0.0.0.0 (Sinkhole / Block)', icon: <X className="w-3.5 h-3.5 text-rose-500" /> },
];

export const HostsDialog: React.FC<HostsDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { hostRules, setHostRules, requests } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<HostRule[]>(hostRules || []);
  const [domain, setDomain] = useState('');
  const [targetIp, setTargetIp] = useState('127.0.0.1');
  const [showDomainPicker, setShowDomainPicker] = useState(false);

  // Extract unique active hosts from recent traffic
  const recentDomains = useMemo(() => {
    const set = new Set<string>();
    for (let i = requests.length - 1; i >= 0 && set.size < 20; i--) {
      const host = requests[i].hostPort?.host;
      if (host && !host.includes('127.0.0.1') && !host.includes('localhost')) {
        set.add(host);
      }
    }
    return Array.from(set);
  }, [requests]);

  const handleAdd = () => {
    if (!domain.trim() || !targetIp.trim()) {
      toast.warning('Domain and target IP required');
      return;
    }
    const newRule: HostRule = {
      id: `host-${Date.now()}`,
      domain: domain.trim(),
      target: targetIp.trim(),
      enabled: true,
    };
    setRules([...rules, newRule]);
    setDomain('');
    toast.success('Host Mapping Added', `${newRule.domain} -> ${newRule.target}`);
  };

  const handleToggle = (index: number) => {
    const updated = [...rules];
    updated[index].enabled = !updated[index].enabled;
    setRules(updated);
  };

  const handleDelete = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      if (api.setHostsRules) {
        await api.setHostsRules(rules);
      }
      setHostRules(rules);
      toast.success(t.saveSuccess, 'Hosts DNS mappings saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none p-4 font-sans">
      <div
        className="w-[640px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.hosts} (DNS &amp; Host Mapping Studio)</h2>
              <p className="text-[11px] text-gray-500">Redirect remote domains directly to local dev servers or IP addresses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input & Presets Studio */}
        <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 space-y-3">
          {/* Target IP 1-Click Presets */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1.5">
              1-Click Target IP Presets:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {IP_PRESETS.map((p) => (
                <button
                  key={p.ip}
                  type="button"
                  onClick={() => setTargetIp(p.ip)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    targetIp === p.ip
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500 font-bold'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {p.icon}
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Domain & IP Inputs */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-500">Domain Name:</label>
                {recentDomains.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDomainPicker(!showDomainPicker)}
                    className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <ListFilter className="w-3 h-3" />
                    Pick ({recentDomains.length})
                  </button>
                )}
              </div>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="api.example.com or *.dev.local"
                className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="col-span-4 space-y-1">
              <label className="text-[11px] font-semibold text-gray-500">Target IP / Host:</label>
              <input
                type="text"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="127.0.0.1"
                className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="col-span-2">
              <button
                type="button"
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-1 py-2 rounded-lg font-bold text-xs bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Active Domains Dropdown */}
          {showDomainPicker && (
            <div className="p-2 rounded-lg border border-emerald-500/30 bg-white dark:bg-gray-900 max-h-32 overflow-y-auto flex flex-wrap gap-1 shadow-md animate-in fade-in duration-100">
              {recentDomains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDomain(d);
                    setShowDomainPicker(false);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-mono bg-gray-100 dark:bg-gray-800 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer text-gray-700 dark:text-gray-300"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Configured Hosts Table */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>Configured DNS Mappings ({rules.length})</span>
            <span className="text-[11px] text-gray-400">Checkbox enables/disables redirection</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                No custom DNS host mappings configured.
              </div>
            ) : (
              rules.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2.5 font-mono text-xs truncate">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggle(idx)}
                      className="w-4 h-4 rounded text-emerald-500 cursor-pointer accent-emerald-500"
                    />
                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{r.domain}</span>
                    <span className="text-gray-400">➔</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{r.target}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-md transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save &amp; Apply DNS Mappings
          </button>
        </div>
      </div>
    </div>
  );
};
