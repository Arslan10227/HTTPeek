import React, { useState } from 'react';
import { X, Plus, Trash2, Ban } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { BlockRule } from '../../types';

interface RequestBlockDialogProps {
  onClose: () => void;
}

export const RequestBlockDialog: React.FC<RequestBlockDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { blockRules, setBlockRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<BlockRule[]>(blockRules || []);
  const [urlPattern, setUrlPattern] = useState('');
  const [statusCode, setStatusCode] = useState('403');

  const isZh = language.startsWith('zh');

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL pattern required');
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

  const handleSave = async () => {
    try {
      if (api.setBlockRules) {
        await api.setBlockRules(rules);
      }
      setBlockRules(rules);
      toast.success(t.saveSuccess, 'Block rules saved');
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
            <Ban className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold">{t.requestBlock}</h2>
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
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="api.analytics.com/*"
            className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          />
          <select
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            className="px-2 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          >
            <option value="403">403 Forbidden</option>
            <option value="404">404 Not Found</option>
            <option value="500">500 Server Error</option>
            <option value="502">502 Bad Gateway</option>
          </select>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
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
              {isZh ? '暂无请求屏蔽规则' : 'No request block rules'}
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
                  <span className="font-semibold text-red-500 w-64 truncate">
                    {rule.urlPattern}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 text-[10px]">
                    HTTP {rule.statusCode || 403}
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
