import React, { useState } from 'react';
import { Plus, Trash2, Shield } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { Dialog, FormMonospaceInput } from '../ui/Dialog';

interface FilterDialogProps {
  onClose: () => void;
}

export const FilterDialog: React.FC<FilterDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { filterConfig, setFilterConfig } = useProxyStore();

  const [mode, setMode] = useState<'blacklist' | 'whitelist'>(
    filterConfig.mode === 'whitelist' ? 'whitelist' : 'blacklist'
  );
  const [rules, setRules] = useState<string[]>(filterConfig.rules || []);
  const [newRule, setNewRule] = useState('');

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
      toast.success(t.saveSuccess || 'Saved', 'Domain filter rules updated');
      onClose();
    } catch (e: any) {
      toast.error(t.fail || 'Error', e?.message);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t.domainFilter || 'Domain Filter'}
      subtitle="Filter traffic by domain names using Blacklist (skip) or Whitelist (capture only) modes."
      icon={<Shield className="w-5 h-5" />}
      maxWidth="max-w-xl"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            {t.cancel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary"
          >
            {t.save || 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Mode Selector */}
        <div className="flex items-center gap-4 p-3 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--color-border)' }}>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'blacklist'}
              onChange={() => setMode('blacklist')}
              className="accent-emerald-500 cursor-pointer"
            />
            <span>Blacklist (Skip capture for these domains)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="radio"
              name="filterMode"
              checked={mode === 'whitelist'}
              onChange={() => setMode('whitelist')}
              className="accent-emerald-500 cursor-pointer"
            />
            <span>Whitelist (Capture ONLY these domains)</span>
          </label>
        </div>

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
            onClick={handleAddRule}
            className="btn-primary py-2 px-3.5 text-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Domain</span>
          </button>
        </div>

        {/* Rules List */}
        <div
          className="max-h-60 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 font-mono text-[11px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-raised)',
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
