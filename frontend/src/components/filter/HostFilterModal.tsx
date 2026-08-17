import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Check, 
  Filter, 
  Globe, 
  Save,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Download,
  Upload,
  Sparkles
} from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface HostFilterConfig {
  whitelistEnabled: boolean;
  whitelist: string[];
  blacklistEnabled: boolean;
  blacklist: string[];
}

const PRESET_TELEMETRY = {
  apple: {
    name: 'Apple Telemetry',
    domains: ['*.apple.com', '*.icloud.com', '*.mzstatic.com', '*.aaplimg.com', '*.apple-dns.net'],
  },
  google: {
    name: 'Google Analytics & Crashlytics',
    domains: ['*.google-analytics.com', '*.analytics.google.com', '*.crashlytics.com', '*.app-measurement.com', '*.gvt1.com'],
  },
  microsoft: {
    name: 'Microsoft Diagnostics',
    domains: ['*.telemetry.microsoft.com', '*.events.data.microsoft.com', '*.vortex.data.microsoft.com', '*.smartscreen.microsoft.com'],
  },
};

export const HostFilterModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklistEnabled, setBlacklistEnabled] = useState(true);
  const [blacklist, setBlacklist] = useState<string[]>(['*.apple.com', '*.icloud.com']);
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    if (isOpen) {
      if ((window as any).go?.main?.App?.GetHostFilterConfig) {
        (window as any).go.main.App.GetHostFilterConfig().then((cfg: HostFilterConfig) => {
          if (cfg) {
            setWhitelistEnabled(cfg.whitelistEnabled);
            setWhitelist(cfg.whitelist || []);
            setBlacklistEnabled(cfg.blacklistEnabled);
            setBlacklist(cfg.blacklist || []);
          }
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const cfg: HostFilterConfig = {
      whitelistEnabled,
      whitelist,
      blacklistEnabled,
      blacklist,
    };
    if ((window as any).go?.main?.App?.SetHostFilterConfig) {
      await (window as any).go.main.App.SetHostFilterConfig(cfg);
    }
    toast.success('Host filter settings saved');
    onClose();
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase();
    if (activeTab === 'whitelist') {
      if (!whitelist.includes(clean)) setWhitelist([...whitelist, clean]);
    } else {
      if (!blacklist.includes(clean)) setBlacklist([...blacklist, clean]);
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    if (activeTab === 'whitelist') {
      setWhitelist(whitelist.filter((d) => d !== domain));
    } else {
      setBlacklist(blacklist.filter((d) => d !== domain));
    }
  };

  const handleApplyPreset = (domains: string[]) => {
    if (activeTab === 'blacklist') {
      const merged = Array.from(new Set([...blacklist, ...domains]));
      setBlacklist(merged);
      toast.success(`Added ${domains.length} telemetry domains to blacklist`);
    } else {
      const merged = Array.from(new Set([...whitelist, ...domains]));
      setWhitelist(merged);
      toast.success(`Added ${domains.length} domains to whitelist`);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ whitelist, blacklist }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'httpeek_host_filters.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.info('Filters exported to JSON');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.whitelist && Array.isArray(parsed.whitelist)) {
          setWhitelist(Array.from(new Set([...whitelist, ...parsed.whitelist])));
        }
        if (parsed.blacklist && Array.isArray(parsed.blacklist)) {
          setBlacklist(Array.from(new Set([...blacklist, ...parsed.blacklist])));
        }
        toast.success('Successfully imported host filters');
      } catch (_) {
        toast.error('Failed to parse filter file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none font-sans">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">Domain &amp; Host Filter Settings</h2>
              <p className="text-xs text-gray-500">Filter captured network traffic with target whitelist and telemetry blacklists</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection & Enable Switch */}
        <div className="px-6 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('whitelist')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'whitelist'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Whitelist ({whitelist.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blacklist')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'blacklist'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Blacklist ({blacklist.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 dark:text-gray-300">
              {activeTab === 'whitelist' ? 'Enable Whitelist Mode' : 'Enable Blacklist Mode'}:
            </span>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'whitelist') setWhitelistEnabled(!whitelistEnabled);
                else setBlacklistEnabled(!blacklistEnabled);
              }}
              className="cursor-pointer text-blue-600"
            >
              {(activeTab === 'whitelist' ? whitelistEnabled : blacklistEnabled) ? (
                <ToggleRight className="w-7 h-7 text-blue-600" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col min-h-0 text-xs">
          {/* Quick Presets for Blacklist */}
          {activeTab === 'blacklist' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>One-Click Telemetry Filter Presets:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(PRESET_TELEMETRY).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleApplyPreset(item.domains)}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-medium hover:border-blue-500 cursor-pointer transition-colors"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add Domain Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddDomain();
                }}
                placeholder="e.g. *.example.com or api.github.com"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAddDomain}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* List of Domains */}
          <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {(activeTab === 'whitelist' ? whitelist : blacklist).length === 0 ? (
              <div className="py-16 text-center text-gray-400 italic">
                No domains in {activeTab}. Add wildcard or exact domains above.
              </div>
            ) : (
              (activeTab === 'whitelist' ? whitelist : blacklist).map((domain) => (
                <div
                  key={domain}
                  className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                    <span>{domain}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-16 px-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
