import React, { useState } from 'react';
import { X, Gauge, Plus, Trash2, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { ThrottleConfig, ThrottleProfile } from '../../types';

interface WeakNetworkDialogProps {
  onClose: () => void;
}

export const PRESET_PROFILES: Record<string, ThrottleProfile> = {
  offline: { name: 'Offline', latencyUpMs: 0, latencyDownMs: 0, kbpsUp: 0, kbpsDown: 0, packetLossRate: 1.0 },
  '2g': { name: '2G', latencyUpMs: 300, latencyDownMs: 300, kbpsUp: 200, kbpsDown: 250, packetLossRate: 0.05 },
  '3g': { name: '3G', latencyUpMs: 100, latencyDownMs: 100, kbpsUp: 500, kbpsDown: 750, packetLossRate: 0.01 },
  '4g': { name: '4G', latencyUpMs: 20, latencyDownMs: 20, kbpsUp: 3000, kbpsDown: 4000, packetLossRate: 0 },
  '5g': { name: '5G', latencyUpMs: 5, latencyDownMs: 5, kbpsUp: 15000, kbpsDown: 20000, packetLossRate: 0 },
  wifi: { name: 'Wi-Fi', latencyUpMs: 2, latencyDownMs: 2, kbpsUp: 30000, kbpsDown: 50000, packetLossRate: 0 },
  slow: { name: 'Slow Network', latencyUpMs: 500, latencyDownMs: 500, kbpsUp: 100, kbpsDown: 100, packetLossRate: 0 },
  weak: { name: 'Weak Network', latencyUpMs: 200, latencyDownMs: 200, kbpsUp: 300, kbpsDown: 300, packetLossRate: 0.15 },
};

export const WeakNetworkDialog: React.FC<WeakNetworkDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { throttleConfig, setThrottleConfig } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [enabled, setEnabled] = useState(throttleConfig?.enabled ?? false);
  const [selectedPreset, setSelectedPreset] = useState<string>('weak');
  const [latencyMs, setLatencyMs] = useState(
    String(throttleConfig?.profile?.latencyUpMs || 200)
  );
  const [kbps, setKbps] = useState(
    String(throttleConfig?.profile?.kbpsUp || 300)
  );
  const [packetLoss, setPacketLoss] = useState(
    String((throttleConfig?.profile?.packetLossRate || 0) * 100)
  );

  const isZh = language.startsWith('zh');

  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const p = PRESET_PROFILES[presetKey];
    if (p) {
      setLatencyMs(String(p.latencyUpMs));
      setKbps(String(p.kbpsUp));
      setPacketLoss(String((p.packetLossRate || 0) * 100));
    }
  };

  const handleSave = async () => {
    try {
      const lat = parseInt(latencyMs, 10) || 0;
      const speed = parseInt(kbps, 10) || 0;
      const loss = (parseFloat(packetLoss) || 0) / 100;

      const profile: ThrottleProfile = {
        name: selectedPreset,
        latencyUpMs: lat,
        latencyDownMs: lat,
        kbpsUp: speed,
        kbpsDown: speed,
        packetLossRate: loss,
      };

      const cfg: ThrottleConfig = {
        enabled,
        profile,
      };

      if (api.setThrottleConfig) {
        await api.setThrottleConfig(cfg);
      }
      setThrottleConfig(cfg);
      toast.success(t.saveSuccess, `Throttling ${enabled ? 'Enabled' : 'Disabled'}`);
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[540px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.weakNetwork} (Network Throttling)</h2>
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
          <div>
            <div className="font-semibold text-sm">{t.enable} {t.weakNetwork}</div>
            <div className="text-[11px] text-gray-500">Simulate network delay, bandwidth limits, and packet loss</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
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

        {/* Presets Wrap */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {t.weakNetworkPreset}:
          </span>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRESET_PROFILES).map(([key, p]) => {
              const isSelected = selectedPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`py-2 px-1 rounded-xl border text-center font-semibold cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Values */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl border font-mono">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Latency (ms):</label>
            <input
              type="number"
              value={latencyMs}
              onChange={(e) => setLatencyMs(e.target.value)}
              className="px-2 py-1 border rounded bg-transparent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Bandwidth (kbps):</label>
            <input
              type="number"
              value={kbps}
              onChange={(e) => setKbps(e.target.value)}
              className="px-2 py-1 border rounded bg-transparent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Packet Loss (%):</label>
            <input
              type="number"
              value={packetLoss}
              onChange={(e) => setPacketLoss(e.target.value)}
              className="px-2 py-1 border rounded bg-transparent focus:outline-none"
            />
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
