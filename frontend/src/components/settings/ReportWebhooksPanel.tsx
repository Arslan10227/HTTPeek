import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Globe } from 'lucide-react';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';

interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  enabled: boolean;
  method?: string;
}

export const ReportWebhooksPanel: React.FC = () => {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const list = await api.getReportConfigs();
      setConfigs(list || []);
    } catch (e) {
      console.error('Fetch report configs error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleAdd = () => {
    setConfigs([...configs, { name: 'New Webhook', url: '', enabled: true, method: 'POST' }]);
  };

  const handleRemove = async (idx: number) => {
    const next = configs.filter((_, i) => i !== idx);
    setConfigs(next);
    await api.setReportConfigs(next);
    toast.success('Saved', 'Webhook removed');
  };

  const handleChange = (idx: number, field: keyof WebhookConfig, value: any) => {
    const next = configs.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setConfigs(next);
  };

  const handleSave = async () => {
    try {
      await api.setReportConfigs(configs);
      toast.success('Saved', 'Webhook configurations saved');
    } catch (e: any) {
      toast.error('Save failed', e?.message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Report Webhooks</h3>
        <div className="flex gap-2">
          <button type="button" onClick={fetchConfigs} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer" style={{ backgroundColor: 'var(--md-primary)' }}>
            <Plus className="w-3.5 h-3.5" /> Add Webhook
          </button>
        </div>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No webhooks configured</p>
          <p className="mt-1 text-[10px]">Add webhooks to forward captured requests to external servers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg, idx) => (
            <div key={idx} className="border rounded-xl p-3 flex flex-col gap-2" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
              <div className="flex items-center justify-between">
                <input
                  value={cfg.name}
                  onChange={(e) => handleChange(idx, 'name', e.target.value)}
                  placeholder="Webhook name"
                  className="text-xs font-bold bg-transparent border-b border-transparent focus:border-gray-300 outline-none flex-1"
                />
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={cfg.enabled} onChange={(e) => handleChange(idx, 'enabled', e.target.checked)} />
                    <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" style={{ backgroundColor: cfg.enabled ? 'var(--md-primary)' : undefined }} />
                  </label>
                  <button type="button" onClick={() => handleRemove(idx)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <input
                value={cfg.url}
                onChange={(e) => handleChange(idx, 'url', e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="text-xs font-mono border rounded-lg px-2 py-1.5 bg-transparent w-full"
                style={{ borderColor: 'var(--md-sys-color-divider)' }}
              />
              <select
                value={cfg.method || 'POST'}
                onChange={(e) => handleChange(idx, 'method', e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-transparent cursor-pointer w-24"
                style={{ borderColor: 'var(--md-sys-color-divider)' }}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {configs.length > 0 && (
        <button
          type="button"
          onClick={handleSave}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--md-primary)' }}
        >
          Save Webhooks
        </button>
      )}
    </div>
  );
};
