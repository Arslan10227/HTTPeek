import React, { useState } from 'react';
import { X, Plus, Trash2, Globe, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { HostRule } from '../../types';

interface HostsDialogProps {
  onClose: () => void;
}

export const HostsDialog: React.FC<HostsDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { hostRules, setHostRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<HostRule[]>(hostRules || []);
  const [domain, setDomain] = useState('');
  const [targetIp, setTargetIp] = useState('');

  const isZh = language.startsWith('zh');

  const handleAdd = () => {
    if (!domain.trim() || !targetIp.trim()) {
      toast.warning('Domain and IP required');
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
    setTargetIp('');
  };

  const handleSave = async () => {
    try {
      if (api.setHostsRules) {
        await api.setHostsRules(rules);
      }
      setHostRules(rules);
      toast.success(t.saveSuccess, 'Hosts mappings saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[580px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.hosts} DNS Mapping</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-5 gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="api.example.local"
            className="col-span-2 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          />
          <input
            type="text"
            value={targetIp}
            onChange={(e) => setTargetIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="127.0.0.1"
            className="col-span-2 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="col-span-1 flex items-center justify-center gap-1 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.add}</span>
          </button>
        </div>

        {/* Rules Table */}
        <div
          className="flex-1 max-h-[320px] overflow-y-auto border rounded-xl overflow-hidden font-mono text-[11px]"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-gray-400 py-12 italic">
              {isZh ? '暂无 Hosts 映射规则' : 'No DNS host mappings'}
            </div>
          ) : (
            rules.map((rule, idx) => (
              <div
                key={rule.id || idx}
                className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx].enabled = e.target.checked;
                      setRules(next);
                    }}
                    className="rounded"
                  />
                  <span className="font-semibold text-blue-600 dark:text-blue-400 w-44 truncate">
                    {rule.domain}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-600 dark:text-green-400 font-mono">
                    {rule.target}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                  className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};
