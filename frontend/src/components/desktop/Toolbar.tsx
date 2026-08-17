import React, { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Smartphone,
  BookOpen,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';
import { confirm } from '../../store/useConfirmDialog';
import { useAppConfig } from '../../theme/useAppConfig';
import { SslWidget } from './SslWidget';
import { SettingMenu, SettingDialogTriggers } from './SettingMenu';
import { WeakNetworkIndicator } from './WeakNetworkIndicator';
import { EnvironmentSwitcher } from './EnvironmentSwitcher';
import { PhoneConnectDialog } from './PhoneConnectDialog';

interface ToolbarProps extends SettingDialogTriggers {
  onClear: () => void;
  onOpenPcCert: () => void;
  onOpenMobileCert: (platform: 'ios' | 'android') => void;
  onManageEnvironments: () => void;
  onOpenDocs?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onClear,
  onOpenPcCert,
  onOpenMobileCert,
  onManageEnvironments,
  onOpenDocs,
  ...settingTriggers
}) => {
  const { t } = useTranslation();
  const { requests, status, setStatus, clearRequests } = useProxyStore();
  const { clearConfirm, getActiveColorPreset } = useAppConfig();
  const [isPhoneConnectOpen, setIsPhoneConnectOpen] = useState(false);
  const activeColor = getActiveColorPreset();

  const isRunning = Boolean(status.running);
  const proxyPort = status.port || 9099;

  const handleToggleProxy = async () => {
    try {
      if (isRunning) {
        await api.stop();
        setStatus({ ...status, running: false });
        toast.info(t.stop, 'Proxy server stopped');
      } else {
        await api.start();
        const updated = await api.getStatus().catch(() => null);
        setStatus({ ...status, ...(updated || {}), running: true });
        toast.success(t.start, `Proxy server listening on port ${proxyPort}`);
      }
    } catch (e: any) {
      toast.error('Proxy Control Error', e?.message || 'Failed to toggle proxy capture');
    }
  };

  const handleClearClick = async () => {
    if (clearConfirm) {
      const ok = await confirm({
        title: `${t.clearConfirm}?`,
        message: t.clearConfirmSubtitle || 'All captured traffic in this session will be cleared.',
        type: 'warning',
        confirmText: t.clear || 'Clear All',
      });
      if (ok) {
        clearRequests();
        onClear();
      }
    } else {
      clearRequests();
      onClear();
    }
  };

  return (
    <>
      <header
        className="flex items-center gap-3 px-3 h-[46px] border-b select-none shrink-0"
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        {/* SocketLaunch: Start/Stop toggle button */}
        <button
          type="button"
          onClick={handleToggleProxy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all shadow-xs hover:opacity-90"
          style={{
            backgroundColor: isRunning ? '#4caf50' : '#f44336',
            color: '#ffffff',
          }}
          title={isRunning ? t.stop : t.start}
        >
          {isRunning ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t.stop} ({proxyPort})</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t.start} ({proxyPort})</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono" style={{ backgroundColor: 'var(--md-sys-color-surface-variant, rgba(0,0,0,0.05))' }}>
          <div className={`w-1.5 h-1.5 rounded-full ${status?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-bold">{requests.length}</span>
          <span className="text-gray-400">reqs</span>
        </div>

        {/* Clear Button */}
        <button
          type="button"
          onClick={handleClearClick}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
          title={t.clear}
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* SSL Lock Menu */}
        <SslWidget
          onOpenPcCert={onOpenPcCert}
          onOpenMobileCert={onOpenMobileCert}
        />

        {/* Settings Menu */}
        <SettingMenu {...settingTriggers} />

        {/* Weak Network Indicator (conditionally shown) */}
        <WeakNetworkIndicator onOpenWeakNetwork={settingTriggers.onOpenWeakNetwork} />

        {/* Mobile Connect */}
        <button
          type="button"
          onClick={() => setIsPhoneConnectOpen(true)}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
          title={t.mobileConnect}
        >
          <Smartphone className="w-5 h-5" />
        </button>

        {/* Documentation / In-App Guides Modal */}
        {onOpenDocs && (
          <button
            type="button"
            onClick={onOpenDocs}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-blue-600 dark:text-blue-400 transition-colors"
            title="In-App Documentation & Guides (F1)"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        )}

        {/* Environment Switcher */}
        <EnvironmentSwitcher onManageEnvironments={onManageEnvironments} />

        <div className="flex-1" />
      </header>

      {isPhoneConnectOpen && (
        <PhoneConnectDialog onClose={() => setIsPhoneConnectOpen(false)} />
      )}
    </>
  );
};
