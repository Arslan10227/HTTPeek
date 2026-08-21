import React, { useState } from 'react';
import { X, Plus, Trash2, PauseCircle, Save, ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { HttpRequest, BreakpointRule } from '../../types';
import { VisualMatchBuilder } from '../common/VisualMatchBuilder';
import { MethodBadge } from '../common/MethodBadge';

interface BreakpointDialogProps {
  onClose: () => void;
  initialRequest?: HttpRequest | null;
}

export const BreakpointDialog: React.FC<BreakpointDialogProps> = ({ onClose, initialRequest }) => {
  const { t } = useTranslation();
  const { breakpointRules, setBreakpointRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<BreakpointRule[]>(breakpointRules || []);
  const [urlPattern, setUrlPattern] = useState(() => {
    if (initialRequest) {
      const domain = initialRequest.hostPort?.host || '';
      const path = initialRequest.path || '/*';
      return domain ? `*://${domain}${path}` : initialRequest.url || '';
    }
    return '';
  });
  const [method, setMethod] = useState(() => initialRequest?.method || '');
  const [breakType, setBreakType] = useState<'both' | 'request' | 'response'>('both');

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL pattern required');
      return;
    }
    const newRule: BreakpointRule = {
      id: `break-${Date.now()}`,
      urlPattern: urlPattern.trim(),
      method: method || undefined,
      breakType,
      enabled: true,
    };
    setRules([...rules, newRule]);
    setUrlPattern('');
    toast.success('Breakpoint added', `Holding traffic on ${newRule.urlPattern}`);
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
      if (api.setBreakpointRules) {
        await api.setBreakpointRules(rules);
      }
      setBreakpointRules(rules);
      toast.success(t.saveSuccess, 'Breakpoint rules saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none font-sans p-4">
      <div
        className="w-[680px] max-h-[90vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-500 border border-orange-500/30">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.breakpoint} (Live Traffic Breakpoint Studio)</h2>
              <p className="text-[11px] text-gray-500">Hold incoming/outgoing traffic to inspect, modify, and replay on the fly</p>
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

        {/* Visual Match Builder */}
        <div className="space-y-3">
          <VisualMatchBuilder
            urlPattern={urlPattern}
            onChangeUrlPattern={setUrlPattern}
            method={method}
            onChangeMethod={setMethod}
            title="Breakpoint Target Endpoint"
          />

          {/* Visual Stage Selector Cards */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Breakpoint Interception Stage:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBreakType('request')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  breakType === 'request'
                    ? 'bg-orange-500/15 border-orange-500 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 mb-1 text-orange-500" />
                <span className="font-bold text-xs">Request Phase</span>
                <span className="text-[10px] text-gray-400">Pause before server</span>
              </button>

              <button
                type="button"
                onClick={() => setBreakType('response')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  breakType === 'response'
                    ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 mb-1 text-blue-500" />
                <span className="font-bold text-xs">Response Phase</span>
                <span className="text-[10px] text-gray-400">Pause before client</span>
              </button>

              <button
                type="button"
                onClick={() => setBreakType('both')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  breakType === 'both'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                <RefreshCw className="w-4 h-4 mb-1 text-emerald-500" />
                <span className="font-bold text-xs">Both Phases</span>
                <span className="text-[10px] text-gray-400">Pause in both ways</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs bg-orange-500 text-white hover:bg-orange-600 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Breakpoint Rule
          </button>
        </div>

        {/* Active Rules List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>Configured Breakpoints ({rules.length})</span>
            <span className="text-[11px] text-gray-400">Toggle switches to enable/disable</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                No active breakpoints. Add a URL pattern above to pause traffic live.
              </div>
            ) : (
              rules.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggle(idx)}
                      className="w-4 h-4 rounded text-orange-500 cursor-pointer accent-orange-500"
                    />
                    <MethodBadge method={r.method || 'ALL'} size="sm" />
                    <span className="font-mono text-xs font-bold truncate">{r.urlPattern}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {r.breakType || 'both'}
                    </span>
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
            Save &amp; Apply Breakpoints
          </button>
        </div>
      </div>
    </div>
  );
};
