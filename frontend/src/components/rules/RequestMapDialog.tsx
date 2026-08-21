import React, { useState } from 'react';
import { X, Plus, Trash2, MapPin, FolderOpen, Save, FileCode, ArrowRightLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { MockRule } from '../../types';
import { VisualMatchBuilder } from '../common/VisualMatchBuilder';
import { StatusCodePicker } from '../common/StatusCodePicker';

interface RequestMapDialogProps {
  onClose: () => void;
}

type MapMode = 'local_file' | 'inline_mock' | 'remote_url';

const MIME_TYPES = [
  'application/json; charset=utf-8',
  'text/html; charset=utf-8',
  'text/plain; charset=utf-8',
  'application/xml',
  'image/png',
  'image/svg+xml',
];

export const RequestMapDialog: React.FC<RequestMapDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { mockRules, setMockRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<MockRule[]>(mockRules || []);
  const [mapMode, setMapMode] = useState<MapMode>('local_file');
  const [urlPattern, setUrlPattern] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [mockBody, setMockBody] = useState('{\n  "status": "success",\n  "message": "Mocked by HTTPeek"\n}');
  const [statusCode, setStatusCode] = useState(200);
  const [contentType, setContentType] = useState('application/json; charset=utf-8');

  const handleAdd = () => {
    if (!urlPattern.trim()) {
      toast.warning('URL pattern required');
      return;
    }
    const newRule: MockRule = {
      id: `map-${Date.now()}`,
      urlPattern: urlPattern.trim(),
      filePath: mapMode === 'local_file' ? localPath.trim() : undefined,
      body: mapMode === 'inline_mock' ? mockBody : undefined,
      statusCode: statusCode || 200,
      contentType: contentType || 'application/json',
      enabled: true,
    };
    setRules([...rules, newRule]);
    setUrlPattern('');
    setLocalPath('');
    toast.success('Mock Rule Added', `${newRule.urlPattern}`);
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
      if (api.setMockRules) {
        await api.setMockRules(rules);
      }
      setMockRules(rules);
      toast.success(t.saveSuccess, 'Map Local / Mock rules saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none p-4 font-sans">
      <div
        className="w-[700px] max-h-[90vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500 border border-purple-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.requestMap} (Map Local &amp; Mock Studio)</h2>
              <p className="text-[11px] text-gray-500">Serve local disk files or simulated JSON/HTML responses to replace remote endpoints</p>
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

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMapMode('local_file')}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
              mapMode === 'local_file'
                ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500'
                : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-purple-500" />
            <span>Map Local Disk File</span>
          </button>

          <button
            type="button"
            onClick={() => setMapMode('inline_mock')}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
              mapMode === 'inline_mock'
                ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}
          >
            <FileCode className="w-4 h-4 text-blue-500" />
            <span>Inline JSON / Text Mock</span>
          </button>
        </div>

        {/* Visual Match Builder */}
        <VisualMatchBuilder
          urlPattern={urlPattern}
          onChangeUrlPattern={setUrlPattern}
          title="Remote Endpoint to Intercept &amp; Mock"
        />

        {/* Mapping Target Inputs */}
        <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 space-y-3">
          {mapMode === 'local_file' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Local File Path on Disk:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="C:\mock-data\user.json or /var/www/mock.json"
                  className="flex-1 px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Inline Mock Response Body:</label>
              <textarea
                value={mockBody}
                onChange={(e) => setMockBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Status Code & Content-Type Pickers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Mock Status Code:</label>
              <div className="flex items-center gap-1.5">
                {[200, 201, 204, 400, 404, 500].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setStatusCode(code)}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border transition-all cursor-pointer ${
                      statusCode === code
                        ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">Content-Type:</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-64 px-2.5 py-1.5 rounded-lg border text-xs font-mono bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 cursor-pointer"
              >
                {MIME_TYPES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs bg-purple-600 text-white hover:bg-purple-700 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Map / Mock Rule
          </button>
        </div>

        {/* Active Rules List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>Active Map Local &amp; Mock Rules ({rules.length})</span>
            <span className="text-[11px] text-gray-400">Toggle switches to activate/deactivate</span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                No active Map Local or Mock rules configured.
              </div>
            ) : (
              rules.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2.5 font-mono text-xs truncate">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggle(idx)}
                      className="w-4 h-4 rounded text-purple-500 cursor-pointer accent-purple-500"
                    />
                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{r.urlPattern}</span>
                    <span className="text-gray-400">➔</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold truncate">
                      {r.filePath ? `[File] ${r.filePath}` : `[Inline] ${r.statusCode || 200}`}
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
            Save &amp; Apply Mocks
          </button>
        </div>
      </div>
    </div>
  );
};
