import React, { useState } from 'react';
import { Plus, Trash2, Ban, ShieldAlert, Sparkles, Save, X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { BlockRule } from '../../types';
import { VisualMatchBuilder } from '../common/VisualMatchBuilder';

interface RequestBlockDialogProps {
  onClose: () => void;
}

const COMMON_BLOCK_PRESETS = [
  { label: 'Google Analytics', pattern: '*google-analytics.com/*' },
  { label: 'MS Telemetry', pattern: '*events.data.microsoft.com/*' },
  { label: 'Ad Trackers', pattern: '*doubleclick.net/*' },
  { label: 'Crashlytics', pattern: '*crashlytics.com/*' },
  { label: 'Sentry Logs', pattern: '*sentry.io/*' },
];

export const RequestBlockDialog: React.FC<RequestBlockDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { blockRules, setBlockRules } = useProxyStore();

  const [rules, setRules] = useState<BlockRule[]>(blockRules || []);
  const [urlPattern, setUrlPattern] = useState('');
  const [statusCode, setStatusCode] = useState(403);

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL Pattern Required', 'Enter URL match pattern to block');
      return;
    }
    const newRule: BlockRule = {
      id: `block-${Date.now()}`,
      urlPattern: urlPattern.trim(),
      statusCode: statusCode || 403,
      enabled: true,
    };
    setRules([...rules, newRule]);
    setUrlPattern('');
    toast.success('Block Rule Added', `${newRule.urlPattern} -> ${newRule.statusCode}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none p-4 font-sans">
      <div
        className="w-[660px] max-h-[90vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/30">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.requestBlock || 'Request Blocking (Blacklist Studio)'}</h2>
              <p className="text-[11px] text-gray-500">Instantly abort or return error status codes (403/404/500) for matched URLs</p>
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

        {/* 1-Click Noise Presets */}
        <div className="p-3 rounded-xl border bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/20 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
            <Sparkles className="w-4 h-4" />
            <span>1-Click Popular Tracker Block Presets:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COMMON_BLOCK_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setUrlPattern(p.pattern)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-gray-800 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500 hover:text-white text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-xs"
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Match Builder */}
        <VisualMatchBuilder
          urlPattern={urlPattern}
          onChangeUrlPattern={setUrlPattern}
          title="URL Pattern to Block"
        />

        {/* Block Action & Status Code Picker */}
        <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Return HTTP Status Code:</label>
            <div className="flex items-center gap-1.5">
              {[
                { code: 403, label: '403 Forbidden' },
                { code: 404, label: '404 Not Found' },
                { code: 500, label: '500 Error' },
                { code: 502, label: '502 Bad Gateway' },
                { code: 504, label: '504 Timeout' },
              ].map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setStatusCode(code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    statusCode === code
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500 font-extrabold'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Block Rule
          </button>
        </div>

        {/* Active Block Rules List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>Active Blocked Rules ({rules.length})</span>
            <span className="text-[11px] text-gray-400">Toggle switch to enable/disable</span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                No active block rules configured.
              </div>
            ) : (
              rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2.5 font-mono text-xs truncate">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggleRule(r.id)}
                      className="w-4 h-4 rounded text-rose-500 cursor-pointer accent-rose-500"
                    />
                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{r.urlPattern}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      HTTP {r.statusCode || 403}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(r.id)}
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
            Save &amp; Apply Block Rules
          </button>
        </div>
      </div>
    </div>
  );
};
