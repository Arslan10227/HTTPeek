import React, { useState } from 'react';
import { X, Network, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';

interface ExternalProxyDialogProps {
  onClose: () => void;
}

export const ExternalProxyDialog: React.FC<ExternalProxyDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [enabled, setEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'http' | 'socks5'>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isZh = language.startsWith('zh');

  const handleSave = async () => {
    try {
      if (api.setExternalProxy) {
        await api.setExternalProxy({
          enabled,
          type: proxyType,
          host,
          port: parseInt(port, 10) || 0,
          username,
          password,
        });
      }
      toast.success(t.saveSuccess, 'External upstream proxy saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[500px] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.externalProxy} (Upstream Proxy)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enable Switch */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border">
          <span className="font-semibold text-sm">{t.enable} {t.externalProxy}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
              style={{
                backgroundColor: enabled ? activeColor.hex : undefined,
              }}
            />
          </label>
        </div>

        {/* Proxy Form */}
        <div className="flex flex-col gap-3 font-mono">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium font-sans">
              <input
                type="radio"
                name="extProxyType"
                checked={proxyType === 'http'}
                onChange={() => setProxyType('http')}
              />
              <span>HTTP Proxy</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium font-sans">
              <input
                type="radio"
                name="extProxyType"
                checked={proxyType === 'socks5'}
                onChange={() => setProxyType('socks5')}
              />
              <span>SOCKS5 Proxy</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[11px] text-gray-500 font-sans">Host / IP:</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1"
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
              />
            </div>
            <div className="col-span-1 flex flex-col gap-1">
              <label className="text-[11px] text-gray-500 font-sans">{t.port}:</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="7890"
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500 font-sans">{t.username} (Optional):</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user"
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500 font-sans">{t.password} (Optional):</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
              />
            </div>
          </div>
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
