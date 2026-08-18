import React, { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Smartphone,
  BookOpen,
  Upload,
  Download,
  Layers,
  FileJson,
  FileSpreadsheet,
  Terminal,
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
import { ExportModal } from '../common/ExportModal';
import { exportRequests, importHarOrJsonFile } from '../../utils/exportHelper';

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
  const { requests, status, setStatus, clearRequests, connectedMobileDevices } = useProxyStore();
  const { clearConfirm, getActiveColorPreset } = useAppConfig();
  const [isPhoneConnectOpen, setIsPhoneConnectOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

        {/* Prominent Import HAR / JSON Button */}
        <button
          type="button"
          onClick={() => importHarOrJsonFile()}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 cursor-pointer shadow-2xs transition-colors"
          title="Import .HAR or .JSON session"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import HAR</span>
        </button>

        {/* Prominent Export Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 cursor-pointer shadow-2xs transition-colors"
            title="Export captured network traffic"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export HAR</span>
          </button>

          {isExportMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-1.5 text-xs font-sans flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
              onClick={() => setIsExportMenuOpen(false)}
            >
              <span className="px-2.5 py-1 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                Export Session Traffic
              </span>
              <button
                type="button"
                onClick={() => exportRequests(requests, 'har', 'httpeek_session')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Export All as .HAR</span>
              </button>
              <button
                type="button"
                onClick={() => exportRequests(requests, 'json', 'httpeek_session')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-500" />
                <span>Export All as .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => exportRequests(requests, 'csv', 'httpeek_session')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export All as .CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportRequests(requests, 'sh', 'httpeek_session')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-500" />
                <span>Export as .SH Script</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 text-left font-bold cursor-pointer"
              >
                <span>Advanced Export Manager...</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

        {/* SSL Lock Menu */}
        <SslWidget
          onOpenPcCert={onOpenPcCert}
          onOpenMobileCert={onOpenMobileCert}
        />

        {/* Settings Menu */}
        <SettingMenu {...settingTriggers} />

        {/* Weak Network Indicator (conditionally shown) */}
        <WeakNetworkIndicator onOpenWeakNetwork={settingTriggers.onOpenWeakNetwork} />

        {/* Mobile Connect / Active Connected Android Device Badge */}
        {connectedMobileDevices && connectedMobileDevices.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsPhoneConnectOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer shadow-2xs transition-all animate-pulse"
            title={`Android Connected: ${connectedMobileDevices[0].deviceName || 'Mobile Device'} (${connectedMobileDevices[0].remoteIp}) - Click to manage`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Smartphone className="w-3.5 h-3.5" />
            <span>
              📱 {connectedMobileDevices[0].deviceName || 'Android'} ({connectedMobileDevices[0].packetCount} reqs)
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPhoneConnectOpen(true)}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
            title={t.mobileConnect}
          >
            <Smartphone className="w-5 h-5" />
          </button>
        )}

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

      {/* Advanced Export Modal */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          allRequests={requests}
        />
      )}

      {isPhoneConnectOpen && (
        <PhoneConnectDialog onClose={() => setIsPhoneConnectOpen(false)} />
      )}
    </>
  );
};
