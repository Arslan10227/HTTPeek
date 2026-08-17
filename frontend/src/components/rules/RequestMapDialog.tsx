import React, { useState } from 'react';
import { X, Plus, Trash2, MapPin, FolderOpen } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { MockRule } from '../../types';

interface RequestMapDialogProps {
  onClose: () => void;
}

export const RequestMapDialog: React.FC<RequestMapDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { mockRules, setMockRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<MockRule[]>(mockRules || []);
  const [urlPattern, setUrlPattern] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [statusCode, setStatusCode] = useState('200');

  const isZh = language.startsWith('zh');

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL pattern required');
      return;
    }
    const newRule: MockRule = {
      id: `map-${Date.now()}`,
      urlPattern: urlPattern.trim(),
      filePath: localPath.trim(),
      statusCode: parseInt(statusCode, 10) || 200,
      contentType: 'application/json',
      enabled: true,
    };
    setRules([...rules, newRule]);
    setUrlPattern('');
    setLocalPath('');
  };

  const handleSave = async () => {
    try {
      if (api.setMockRules) {
        await api.setMockRules(rules);
      }
      setMockRules(rules);
      toast.success(t.saveSuccess, 'Map rules saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[620px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.requestMap} (Map Local & Remote)</h2>
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
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={urlPattern}
              onChange={(e) => setUrlPattern(e.target.value)}
              placeholder="URL pattern (e.g. api.test.com/data.json)"
              className="col-span-2 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
            <select
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              className="col-span-1 px-2 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none cursor-pointer"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            >
              <option value="200">200 OK</option>
              <option value="201">201 Created</option>
              <option value="400">400 Bad Request</option>
              <option value="404">404 Not Found</option>
              <option value="500">500 Server Error</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="Local file path or remote destination URL (e.g. C:/mock/data.json)"
              className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
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
        </div>

        {/* Rules Table */}
        <div
          className="flex-1 max-h-[300px] overflow-y-auto border rounded-xl overflow-hidden font-mono text-[11px]"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          {rules.length === 0 ? (
            <div className="text-center text-gray-400 py-12 italic">
              {isZh ? '暂无映射规则' : 'No map local/remote rules'}
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
                  <div className="flex flex-col">
                    <span className="font-semibold text-blue-600 dark:text-blue-400 truncate w-72">
                      {rule.urlPattern}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate w-72">
                      → {rule.filePath || rule.responseBody || 'Custom Mock'}
                    </span>
                  </div>
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
