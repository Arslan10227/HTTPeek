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
  Shield,
  Sliders,
  Wrench,
  Heart,
  History as HistoryIcon,
  Activity,
  Globe,
  Radio,
  Check,
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
  const { requests, status, setStatus, clearRequests, connectedMobileDevices, activeTab, activeInterceptors, removeActiveInterceptor } = useProxyStore();
  const { clearConfirm, getActiveColorPreset } = useAppConfig();
  const [isPhoneConnectOpen, setIsPhoneConnectOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [togglingSystemProxy, setTogglingSystemProxy] = useState(false);
  const activeColor = getActiveColorPreset();

  const isRunning = Boolean(status.running);
  const proxyPort = status.port || 9099;
  const isSystemProxyEnabled = Boolean(status.systemProxyEnabled);

  const handleStopActiveInterceptor = async (interceptor: typeof activeInterceptors[0]) => {
    try {
      if (interceptor.type === 'adb' && interceptor.deviceSerial) {
        await api.stopADBInterception(interceptor.deviceSerial);
      } else if (interceptor.type === 'frida' && interceptor.runId) {
        await api.stopFrida(interceptor.runId);
      } else {
        await api.stop();
      }
      removeActiveInterceptor(interceptor.id);
      toast.info('Interceptor Stopped', interceptor.name);
    } catch (e: any) {
      toast.error('Failed to stop interceptor', e?.message || String(e));
    }
  };

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

  const handleToggleSystemProxy = async () => {
    setTogglingSystemProxy(true);
    try {
      if (isSystemProxyEnabled) {
        await api.setSystemProxy(false);
        setStatus({ ...status, systemProxyEnabled: false });
        toast.info('System Proxy Disabled', 'OS traffic is no longer routed to HTTPeek');
      } else {
        if (!isRunning) {
          await api.start();
        }
        await api.setSystemProxy(true);
        setStatus({ ...status, running: true, systemProxyEnabled: true });
        toast.success('System Proxy Enabled', `Capturing all OS traffic via 127.0.0.1:${proxyPort}`);
      }
    } catch (e: any) {
      toast.error('System Proxy Error', e?.message || String(e));
    } finally {
      setTogglingSystemProxy(false);
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

  const getPageMeta = () => {
    switch (activeTab) {
      case 'interceptors':
        return {
          title: 'Intercept',
          badge: isSystemProxyEnabled ? 'System Proxy ON' : 'System Proxy OFF',
          badgeActive: isSystemProxyEnabled,
          onClickBadge: handleToggleSystemProxy,
          badgeTitle: 'Click to toggle system-wide OS proxy interception',
        };
      case 'requests':
        return {
          title: 'View Traffic',
          badge: `${requests.length} captured`,
          badgeActive: requests.length > 0,
        };
      case 'rules':
        return {
          title: 'Mock Engine',
          badge: '8 Rule Suites',
          badgeActive: true,
        };
      case 'favorites':
        return {
          title: 'Favorites',
          badge: 'Pinned Items',
          badgeActive: false,
        };
      case 'history':
        return {
          title: 'History',
          badge: 'Sessions',
          badgeActive: false,
        };
      case 'toolbox':
        return {
          title: 'Toolbox',
          badge: '17 Utilities',
          badgeActive: true,
        };
      default:
        return {
          title: 'HTTPeek',
          badge: 'Workbench',
          badgeActive: false,
        };
    }
  };

  const pageMeta = getPageMeta();

  return (
    <>
      <header
        className="flex items-center justify-between px-3 h-14 border-b select-none shrink-0 overflow-visible relative z-30 gap-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* ── LEFT ZONE: Breadcrumb / Page Title + Status Badge ─── */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <span
            className="font-bold text-sm tracking-tight truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {pageMeta.title}
          </span>

          {pageMeta.onClickBadge ? (
            <button
              type="button"
              onClick={pageMeta.onClickBadge}
              disabled={togglingSystemProxy}
              className={`chip font-mono text-[10px] cursor-pointer transition-all ${
                pageMeta.badgeActive ? 'chip-active' : ''
              }`}
              style={
                pageMeta.badgeActive
                  ? {
                      background: 'rgba(0,229,163,0.12)',
                      color: 'var(--color-primary)',
                      borderColor: 'var(--color-primary-border)',
                    }
                  : {
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text-muted)',
                      borderColor: 'var(--color-border)',
                    }
              }
              title={pageMeta.badgeTitle}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  pageMeta.badgeActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                }`}
              />
              <span>{pageMeta.badge}</span>
            </button>
          ) : (
            <span
              className="chip font-mono text-[10px]"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-muted)',
                borderColor: 'var(--color-border)',
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  pageMeta.badgeActive ? 'bg-emerald-400' : 'bg-neutral-500'
                }`}
              />
              <span>{pageMeta.badge}</span>
            </span>
          )}
        </div>

        {/* ── CENTER ZONE: Global Proxy Controls ───────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dynamic Active Interceptor Pill or Start / Stop Toggle Pill */}
          {activeInterceptors.length > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="truncate max-w-[170px]" title={activeInterceptors[0].name}>
                {activeInterceptors[0].name}
              </span>
              <button
                type="button"
                onClick={() => handleStopActiveInterceptor(activeInterceptors[0])}
                className="px-2 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500/35 text-red-400 hover:text-red-300 text-[10px] font-bold cursor-pointer transition-all border border-red-500/30"
                title={`Stop ${activeInterceptors[0].name}`}
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleProxy}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all shrink-0 ${
                isRunning ? 'animate-glow-ring' : ''
              }`}
              style={{
                backgroundColor: isRunning ? '#22c55e' : activeColor.hex,
                color: isRunning ? '#fff' : '#0a2e1e',
                boxShadow: isRunning
                  ? '0 0 0 0 rgba(34,197,94,0.4)'
                  : `0 2px 10px ${activeColor.hex}44`,
              }}
              title={isRunning ? t.stop : t.start}
            >
              {isRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                  <Square className="w-3 h-3 fill-current" />
                  <span>{t.stop}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.start}</span>
                </>
              )}
            </button>
          )}

          {/* Port Badge */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono shrink-0 border"
            style={{
              background: 'var(--color-surface-raised)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
            title="Proxy Port"
          >
            <Radio className="w-3 h-3 text-neutral-400" />
            <span>:{proxyPort}</span>
          </div>

          {/* Request Count Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono shrink-0 border"
            style={{
              background: 'var(--color-surface-raised)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
              }`}
            />
            <span className="font-bold" style={{ color: 'var(--color-text)' }}>
              {requests.length}
            </span>
            <span>reqs</span>
          </div>

          {/* Clear Trash */}
          <button
            type="button"
            onClick={handleClearClick}
            className="btn-icon shrink-0"
            title={t.clear}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* ── RIGHT ZONE: Grouped Utilities ────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Import */}
          <button
            type="button"
            onClick={() => importHarOrJsonFile()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 cursor-pointer transition-all border"
            style={{
              background: 'rgba(0,229,163,0.08)',
              borderColor: 'var(--color-primary-border)',
              color: 'var(--color-primary)',
            }}
            title="Import .HAR or .JSON session"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Import</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all border"
              style={{
                background: 'rgba(59,130,246,0.08)',
                borderColor: 'rgba(59,130,246,0.25)',
                color: '#60a5fa',
              }}
              title="Export captured traffic"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Export</span>
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border p-1.5 flex flex-col gap-0.5 animate-dialog-in"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border-strong)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                onClick={() => setIsExportMenuOpen(false)}
              >
                <span className="section-label px-2.5 py-1.5">Export Traffic</span>
                {[
                  { fmt: 'har' as const, icon: <Layers className="w-3.5 h-3.5 text-blue-500" />, label: 'Export as .HAR' },
                  { fmt: 'json' as const, icon: <FileJson className="w-3.5 h-3.5 text-amber-500" />, label: 'Export as .JSON' },
                  { fmt: 'csv' as const, icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />, label: 'Export as .CSV' },
                  { fmt: 'sh' as const, icon: <Terminal className="w-3.5 h-3.5 text-purple-500" />, label: 'Export as .SH' },
                ].map(({ fmt, icon, label }) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => exportRequests(requests, fmt, 'httpeek_session')}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors"
                    style={{ color: 'var(--color-text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {icon} {label}
                  </button>
                ))}
                <div className="h-px my-1" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-left cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-dim)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Advanced Export Manager…
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px shrink-0 mx-0.5" style={{ background: 'var(--color-border)' }} />

          {/* SSL Lock */}
          <SslWidget onOpenPcCert={onOpenPcCert} onOpenMobileCert={onOpenMobileCert} />

          {/* Environment Switcher */}
          <EnvironmentSwitcher onManageEnvironments={onManageEnvironments} />

          {/* Weak Network */}
          <WeakNetworkIndicator onOpenWeakNetwork={settingTriggers.onOpenWeakNetwork} />

          {/* Mobile Connect */}
          {connectedMobileDevices && connectedMobileDevices.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsPhoneConnectOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border shrink-0 cursor-pointer transition-all"
              style={{
                background: 'rgba(16,185,129,0.10)',
                borderColor: 'rgba(16,185,129,0.3)',
                color: '#34d399',
              }}
              title={`${connectedMobileDevices[0].deviceName || 'Mobile'} connected`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline max-w-[80px] truncate">
                {connectedMobileDevices[0].deviceName || 'Android'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsPhoneConnectOpen(true)}
              className="btn-icon shrink-0"
              title={t.mobileConnect}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}

          {/* Docs */}
          {onOpenDocs && (
            <button
              type="button"
              onClick={onOpenDocs}
              className="btn-icon shrink-0"
              title="Documentation & Guides (F1)"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}

          {/* Settings Menu */}
          <SettingMenu {...settingTriggers} />
        </div>
      </header>

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
