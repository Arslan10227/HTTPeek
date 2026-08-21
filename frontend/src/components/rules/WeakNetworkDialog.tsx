import React, { useState } from 'react';
import { X, Gauge, Plus, Trash2, Check, Wifi, WifiOff, Zap, Activity, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { ThrottleConfig, ThrottleProfile } from '../../types';

interface WeakNetworkDialogProps {
  onClose: () => void;
}

export const PRESET_PROFILES: Record<string, ThrottleProfile & { desc: string; iconType: string }> = {
  offline: { name: 'Offline Mode', desc: 'No internet connectivity (0 Kbps, 100% loss)', latencyUpMs: 0, latencyDownMs: 0, kbpsUp: 0, kbpsDown: 0, packetLossRate: 1.0, iconType: 'off' },
  gprs: { name: 'GPRS (Very Slow)', desc: '50 Kbps / 500ms latency', latencyUpMs: 500, latencyDownMs: 500, kbpsUp: 50, kbpsDown: 50, packetLossRate: 0.05, iconType: 'slow' },
  '2g': { name: 'Regular 2G', desc: '250 Kbps / 300ms latency', latencyUpMs: 300, latencyDownMs: 300, kbpsUp: 200, kbpsDown: 250, packetLossRate: 0.02, iconType: '2g' },
  '3g': { name: 'Good 3G', desc: '750 Kbps / 100ms latency', latencyUpMs: 100, latencyDownMs: 100, kbpsUp: 500, kbpsDown: 750, packetLossRate: 0.01, iconType: '3g' },
  '4g': { name: 'Regular 4G LTE', desc: '4 Mbps / 20ms latency', latencyUpMs: 20, latencyDownMs: 20, kbpsUp: 3000, kbpsDown: 4000, packetLossRate: 0, iconType: '4g' },
  '5g': { name: 'Ultra Fast 5G', desc: '20 Mbps / 5ms latency', latencyUpMs: 5, latencyDownMs: 5, kbpsUp: 15000, kbpsDown: 20000, packetLossRate: 0, iconType: '5g' },
  dsl: { name: 'DSL / Broadband', desc: '10 Mbps / 15ms latency', latencyUpMs: 15, latencyDownMs: 15, kbpsUp: 5000, kbpsDown: 10000, packetLossRate: 0, iconType: 'wifi' },
  lossy: { name: 'Unstable / Lossy Network', desc: '300 Kbps / 200ms latency / 15% packet drop', latencyUpMs: 200, latencyDownMs: 200, kbpsUp: 300, kbpsDown: 300, packetLossRate: 0.15, iconType: 'loss' },
};

export const WeakNetworkDialog: React.FC<WeakNetworkDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { throttleConfig, setThrottleConfig } = useProxyStore();

  const [enabled, setEnabled] = useState(throttleConfig?.enabled ?? false);
  const [selectedPreset, setSelectedPreset] = useState<string>('3g');
  const [latencyMs, setLatencyMs] = useState(throttleConfig?.profile?.latencyUpMs || 100);
  const [kbpsDown, setKbpsDown] = useState(throttleConfig?.profile?.kbpsDown || 750);
  const [kbpsUp, setKbpsUp] = useState(throttleConfig?.profile?.kbpsUp || 500);
  const [packetLoss, setPacketLoss] = useState(Math.round((throttleConfig?.profile?.packetLossRate || 0) * 100));

  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const p = PRESET_PROFILES[presetKey];
    if (p) {
      setLatencyMs(p.latencyUpMs ?? 0);
      setKbpsDown(p.kbpsDown ?? 0);
      setKbpsUp(p.kbpsUp ?? 0);
      setPacketLoss(Math.round((p.packetLossRate || 0) * 100));
    }
  };

  const handleSave = async () => {
    try {
      const profile: ThrottleProfile = {
        name: selectedPreset,
        latencyUpMs: latencyMs,
        latencyDownMs: latencyMs,
        kbpsUp,
        kbpsDown,
        packetLossRate: packetLoss / 100,
      };

      const cfg: ThrottleConfig = {
        enabled,
        profile,
      };

      if (api.setThrottleConfig) {
        await api.setThrottleConfig(cfg);
      }
      setThrottleConfig(cfg);
      toast.success(t.saveSuccess, `Network Throttling ${enabled ? 'Enabled' : 'Disabled'}`);
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
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
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.weakNetwork} (Network Throttling Studio)</h2>
              <p className="text-[11px] text-gray-500">Simulate slow connections, 2G/3G/4G/5G mobile profiles, latency, and packet loss</p>
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

        {/* Global Master Switch */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <Activity className={`w-5 h-5 ${enabled ? 'text-amber-500 animate-pulse' : 'text-gray-400'}`} />
            <div>
              <div className="font-bold text-xs">Enable Network Throttling</div>
              <div className="text-[11px] text-gray-500">Shape and restrict bandwidth for all passing traffic</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* 1-Click Profile Cards */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">1-Click Network Profile Presets:</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRESET_PROFILES).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPreset === key
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500 font-bold shadow-xs'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-bold text-xs mb-1">{p.name}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sliders & Granular Controls */}
        <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 space-y-3.5">
          {/* Download Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Downstream Speed:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {kbpsDown >= 1000 ? `${(kbpsDown / 1000).toFixed(1)} Mbps` : `${kbpsDown} Kbps`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="50"
              value={kbpsDown}
              onChange={(e) => setKbpsDown(parseInt(e.target.value, 10) || 0)}
              className="w-full cursor-pointer accent-amber-500"
            />
          </div>

          {/* Upload Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Upstream Speed:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {kbpsUp >= 1000 ? `${(kbpsUp / 1000).toFixed(1)} Mbps` : `${kbpsUp} Kbps`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30000"
              step="50"
              value={kbpsUp}
              onChange={(e) => setKbpsUp(parseInt(e.target.value, 10) || 0)}
              className="w-full cursor-pointer accent-amber-500"
            />
          </div>

          {/* Latency */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Round-Trip Latency (Delay):</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{latencyMs} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="20"
              value={latencyMs}
              onChange={(e) => setLatencyMs(parseInt(e.target.value, 10) || 0)}
              className="w-full cursor-pointer accent-amber-500"
            />
          </div>

          {/* Packet Loss */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Packet Loss Rate:</span>
              <span className="font-mono font-bold text-rose-500">{packetLoss}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={packetLoss}
              onChange={(e) => setPacketLoss(parseInt(e.target.value, 10) || 0)}
              className="w-full cursor-pointer accent-rose-500"
            />
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
            Apply Throttling Profile
          </button>
        </div>
      </div>
    </div>
  );
};
