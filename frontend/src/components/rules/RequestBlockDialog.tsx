import React, { useState } from 'react';
import { Plus, Trash2, Ban } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { BlockRule } from '../../types';
import { Dialog, FormMonospaceInput } from '../ui/Dialog';

interface RequestBlockDialogProps {
  onClose: () => void;
}

export const RequestBlockDialog: React.FC<RequestBlockDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { blockRules, setBlockRules } = useProxyStore();

  const [rules, setRules] = useState<BlockRule[]>(blockRules || []);
  const [urlPattern, setUrlPattern] = useState('');
  const [statusCode, setStatusCode] = useState('403');

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL Pattern Required', 'Enter URL match pattern to block');
      return;
    }
    const newRule: BlockRule = {
      id: `block-${Date.now()}`,
      urlPattern: urlPattern.trim(),
      statusCode: parseInt(statusCode, 10) || 403,
      enabled: true,
    };
    setRules([...rules, newRule]);
    setUrlPattern('');
  };

  const handleToggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleRemove = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    try {
      if (api.setBlockRules) {
        await api.setBlockRules(rules);
      }
      setBlockRules(rules);
      toast.success(t.saveSuccess || 'Saved', 'Block rules updated');
      onClose();
    } catch (e: any) {
      toast.error(t.fail || 'Error', e?.message);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t.requestBlock || 'Request Blocking (Blacklist)'}
      subtitle="Instantly abort or return error status codes (403/404/500) for matched URLs."
      icon={<Ban className="w-5 h-5 text-rose-500" />}
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
        {/* Input Row */}
        <div className="flex items-center gap-2">
          <FormMonospaceInput
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="api.analytics.com/* or *ads*"
            className="flex-1"
          />
          <select
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            className="input-base w-36 font-mono cursor-pointer"
          >
            <option value="403">403 Forbidden</option>
            <option value="404">404 Not Found</option>
            <option value="500">500 Server Error</option>
            <option value="502">502 Bad Gateway</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="btn-primary py-2 px-3.5 text-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </div>

        {/* Rules List */}
        <div
          className="max-h-60 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1.5 font-mono text-[11px]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-raised)',
          }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-neutral-400 py-6 italic text-xs">
              No URL blocking rules configured.
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule.id)}
                    className="accent-rose-500 cursor-pointer shrink-0"
                  />
                  <span className="font-mono text-rose-400 truncate">{rule.urlPattern}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="badge-status badge-5xx font-mono">
                    {rule.statusCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(rule.id)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-red-400 cursor-pointer transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
};
