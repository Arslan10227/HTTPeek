import React, { useState } from 'react';
import { X, Plus, Trash2, KeyRound } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { CryptoRule } from '../../types';

interface RequestCryptoDialogProps {
  onClose: () => void;
}

export const RequestCryptoDialog: React.FC<RequestCryptoDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { cryptoRules, setCryptoRules } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [rules, setRules] = useState<CryptoRule[]>(cryptoRules || []);
  const [name, setName] = useState('');
  const [urlPattern, setUrlPattern] = useState('');
  const [algorithm, setAlgorithm] = useState<'AES-CBC' | 'AES-ECB' | 'AES-GCM'>('AES-CBC');
  const [secretKey, setSecretKey] = useState('');
  const [iv, setIv] = useState('');

  const isZh = language.startsWith('zh');

  const handleAdd = () => {
    if (!urlPattern.trim() || !secretKey.trim()) {
      toast.warning('URL pattern and Secret Key required');
      return;
    }
    const newRule: CryptoRule = {
      id: `crypto-${Date.now()}`,
      name: name.trim() || 'Crypto Rule',
      urlPattern: urlPattern.trim(),
      algorithm,
      key: secretKey.trim(),
      iv: iv.trim(),
      target: 'response',
      enabled: true,
    };
    setRules([...rules, newRule]);
    setName('');
    setUrlPattern('');
    setSecretKey('');
    setIv('');
  };

  const handleSave = async () => {
    try {
      if (api.setCryptoRules) {
        await api.setCryptoRules(rules);
      }
      setCryptoRules(rules);
      toast.success(t.saveSuccess, 'Crypto rules saved');
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
            <KeyRound className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.requestCrypto}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule Name"
              className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
            <input
              type="text"
              value={urlPattern}
              onChange={(e) => setUrlPattern(e.target.value)}
              placeholder="URL pattern (e.g. api.test.com/*)"
              className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              className="px-2 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none cursor-pointer"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            >
              <option value="AES-CBC">AES-CBC</option>
              <option value="AES-ECB">AES-ECB</option>
              <option value="AES-GCM">AES-GCM</option>
            </select>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="AES Key (Hex or Base64)"
              className="col-span-2 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
            <input
              type="text"
              value={iv}
              onChange={(e) => setIv(e.target.value)}
              placeholder="IV (Optional for CBC/GCM)"
              className="col-span-2 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
            <button
              type="button"
              onClick={handleAdd}
              className="col-span-1 flex items-center justify-center gap-1 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
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
              {isZh ? '暂无加解密规则' : 'No crypto rules defined'}
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
                      {rule.name} ({rule.algorithm})
                    </span>
                    <span className="text-[10px] text-gray-500 truncate w-72">
                      {rule.urlPattern}
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
