import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, FileCode, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { RewriteRule } from '../../types';

interface RequestRewriteDialogProps {
  onClose: () => void;
  presetRule?: RewriteRule;
}

export const RequestRewriteDialog: React.FC<RequestRewriteDialogProps> = ({
  onClose,
  presetRule,
}) => {
  const { t, language } = useTranslation();
  const { rewriteRules, setRewriteRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<RewriteRule[]>(rewriteRules || []);
  const [editingRule, setEditingRule] = useState<RewriteRule | null>(presetRule || null);

  const isZh = language.startsWith('zh');

  const handleSaveRule = (rule: RewriteRule) => {
    const existing = rules.findIndex((r) => r.id === rule.id);
    if (existing >= 0) {
      const next = [...rules];
      next[existing] = rule;
      setRules(next);
    } else {
      setRules([...rules, rule]);
    }
    setEditingRule(null);
  };

  const handleSaveAll = async () => {
    try {
      if (api.setRewriteRules) {
        await api.setRewriteRules(rules);
      }
      setRewriteRules(rules);
      toast.success(t.saveSuccess, 'Rewrite rules saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[680px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.requestRewrite}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setEditingRule({
                id: `rw-${Date.now()}`,
                name: 'New Rewrite Rule',
                urlPattern: '*',
                action: 'replace',
                enabled: true,
              })
            }
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.add}</span>
          </button>
        </div>

        {/* Rules Table */}
        <div
          className="flex-1 max-h-[340px] overflow-y-auto border rounded-xl overflow-hidden font-mono text-[11px]"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-gray-400 py-12 italic">
              {isZh ? '暂无请求重写规则' : 'No rewrite rules defined'}
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
                  <span className="font-semibold text-blue-600 dark:text-blue-400 w-36 truncate">
                    {rule.name || rule.urlPattern}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 uppercase text-[9px] font-bold">
                    {rule.action}
                  </span>
                  <span className="text-gray-500 w-44 truncate">
                    {rule.urlPattern}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingRule(rule)}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                    className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
            onClick={handleSaveAll}
            className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.save}
          </button>
        </div>
      </div>

      {/* Nested Rule Editor Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 select-none">
          <div
            className="w-[560px] rounded-2xl shadow-2xl p-6 border flex flex-col gap-3.5 text-xs animate-in zoom-in-95 duration-100"
            style={{
              backgroundColor: 'var(--md-dialog-bg)',
              borderColor: 'var(--md-sys-color-divider)',
              color: 'var(--md-sys-color-on-surface)',
            }}
          >
            <h3 className="text-sm font-bold">{t.requestRewriteRule}</h3>

            <div className="flex flex-col gap-1">
              <label className="font-medium">Rule Name:</label>
              <input
                type="text"
                value={editingRule.name || ''}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="My Rule"
                className="px-3 py-1.5 rounded-lg border bg-transparent font-mono text-xs focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium">URL Match Pattern:</label>
              <input
                type="text"
                value={editingRule.urlPattern}
                onChange={(e) => setEditingRule({ ...editingRule, urlPattern: e.target.value })}
                placeholder="api.example.com/v1/*"
                className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium">Action Type:</label>
              <select
                value={editingRule.action}
                onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value as any })}
                className="px-3 py-1.5 rounded-lg border font-medium text-xs bg-transparent focus:outline-none cursor-pointer"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              >
                <option value="replace">Replace (Headers, Body, Status)</option>
                <option value="redirect">Redirect (URL Forward)</option>
                <option value="update">Update (Regex Search & Replace)</option>
              </select>
            </div>

            {editingRule.action === 'redirect' ? (
              <div className="flex flex-col gap-1">
                <label className="font-medium">Redirect Target URL:</label>
                <input
                  type="text"
                  value={editingRule.redirectUrl || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, redirectUrl: e.target.value })}
                  placeholder="https://test.example.com/$1"
                  className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="font-medium">Replace Body (JSON/Text):</label>
                <textarea
                  value={editingRule.replaceBody || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, replaceBody: e.target.value })}
                  rows={4}
                  placeholder='{"code": 0, "msg": "success"}'
                  className="w-full p-2.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none resize-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleSaveRule(editingRule)}
                className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
                style={{ backgroundColor: activeColor.hex }}
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
