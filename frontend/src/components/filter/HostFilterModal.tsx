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
  ToggleRight
} from 'lucide-react';

interface HostFilterConfig {
  whitelistEnabled: boolean;
  whitelist: string[];
  blacklistEnabled: boolean;
  blacklist: string[];
}

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

  return (
    <div className="htk-modal-overlay font-sans select-none">
      <div className="htk-modal htk-modal-lg" style={{ height: '560px' }}>
        <div className="htk-modal-header">
          <div className="flex items-center gap-2.5">
            <Filter className="w-5 h-5" style={{ color: 'var(--htk-accent)' }} />
            <div>
              <h2 className="htk-modal-title">Domain & Host Filter Settings</h2>
              <p className="htk-modal-subtitle">Match ProxyPin domain capture whitelist & blacklist rules</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="htk-btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="htk-modal-tabs justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('whitelist')}
              className={`htk-chip ${activeTab === 'whitelist' ? 'htk-chip-active' : ''}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Whitelist ({whitelist.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blacklist')}
              className={`htk-chip ${activeTab === 'blacklist' ? 'htk-chip-active' : ''}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Blacklist ({blacklist.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--htk-text-secondary)' }}>
              {activeTab === 'whitelist' ? 'Enable Whitelist' : 'Enable Blacklist'}:
            </span>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'whitelist') setWhitelistEnabled(!whitelistEnabled);
                else setBlacklistEnabled(!blacklistEnabled);
              }}
              className="htk-btn-icon cursor-pointer"
            >
              {(activeTab === 'whitelist' ? whitelistEnabled : blacklistEnabled) ? (
                <ToggleRight className="w-7 h-7" style={{ color: 'var(--htk-accent)' }} />
              ) : (
                <ToggleLeft className="w-7 h-7" style={{ color: 'var(--htk-text-muted)' }} />
              )}
            </button>
          </div>
        </div>

        <div className="htk-modal-body space-y-4">
          <div className={`htk-alert ${activeTab === 'whitelist' ? 'htk-alert-success' : ''}`} style={activeTab === 'blacklist' ? { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' } : undefined}>
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {activeTab === 'whitelist' ? 'Whitelist Mode' : 'Blacklist Mode'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {activeTab === 'whitelist'
                  ? 'When enabled, the proxy server will ONLY capture and decrypt traffic for matching domains. All other domains pass through directly.'
                  : 'When enabled, the proxy server will IGNORE/BYPASS traffic for matching domains (e.g. system background telemetry, iCloud, Windows Update).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="htk-input-wrap flex-1">
              <Globe className="htk-input-icon" />
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                placeholder="e.g. *.example.com or api.github.com"
                className="htk-input"
              />
            </div>
            <button type="button" onClick={handleAddDomain} className="htk-btn htk-btn-primary">
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="htk-context-menu-label px-0">
              {activeTab === 'whitelist' ? 'Whitelisted Domain Rules' : 'Blacklisted Domain Rules'}
            </span>

            {(activeTab === 'whitelist' ? whitelist : blacklist).length === 0 ? (
              <div className="htk-empty h-32 border border-dashed border-[var(--htk-panel-border)] rounded-lg">
                <Globe className="w-6 h-6 mb-1" style={{ color: 'var(--htk-text-muted)' }} />
                <p className="htk-empty-title">No Domains Listed</p>
                <p className="text-[11px]">Add wildcard patterns above (e.g. *.test.com)</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(activeTab === 'whitelist' ? whitelist : blacklist).map((domain) => (
                  <div
                    key={domain}
                    className="htk-field flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2 font-mono font-semibold text-xs">
                      <Globe className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-muted)' }} />
                      <span>{domain}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveDomain(domain)} className="htk-btn-icon" style={{ color: 'var(--htk-danger)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="htk-modal-footer">
          <button type="button" onClick={onClose} className="htk-btn">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="htk-btn htk-btn-primary">
            <Save className="w-4 h-4" />
            <span>Save & Apply Filter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
