import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Shield, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';

interface FilterDialogProps {
  onClose: () => void;
}

export const FilterDialog: React.FC<FilterDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { filterConfig, setFilterConfig } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [mode, setMode] = useState<'blacklist' | 'whitelist'>(
    filterConfig.mode === 'whitelist' ? 'whitelist' : 'blacklist'
  );
  const [rules, setRules] = useState<string[]>(filterConfig.rules || []);
  const [newRule, setNewRule] = useState('');

  const isZh = language.startsWith('zh');

  const handleAddRule = () => {
    if (!newRule.trim()) return;
    if (rules.includes(newRule.trim())) {
      toast.info('Rule already exists');
      return;
    }
    setRules([...rules, newRule.trim()]);
    setNewRule('');
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
      toast.success(t.saveSuccess, 'Filter rules updated');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[520px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.domainFilter}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'blacklist'}
              onChange={() => setMode('blacklist')}
            />
            <span>{isZh ? '黑名单 (不抓包)' : 'Blacklist (Skip capture)'}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'whitelist'}
              onChange={() => setMode('whitelist')}
            />
            <span>{isZh ? '白名单 (仅抓包)' : 'Whitelist (Capture only)'}</span>
          </label>
        </div>

        {/* Add Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddRule();
            }}
            placeholder="e.g. *.apple.com, api.test.com"
            className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          />
          <button
            type="button"
            onClick={handleAddRule}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.add}</span>
          </button>
        </div>

        {/* Rules List */}
        <div
          className="flex-1 max-h-[300px] overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 font-mono text-[11px]"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-gray-400 py-8 italic">
              {isZh ? '暂无过滤规则' : 'No filter rules defined'}
            </div>
          ) : (
            rules.map((rule, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 group border border-transparent hover:border-gray-200 dark:hover:border-gray-800"
              >
                <span>{rule}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRule(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 cursor-pointer"
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
