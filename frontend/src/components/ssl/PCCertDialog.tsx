import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Download, CheckCircle2, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';

interface PCCertDialogProps {
  onClose: () => void;
}

export const PCCertDialog: React.FC<PCCertDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const { status, setStatus } = useProxyStore();
  const activeColor = getActiveColorPreset();
  const [installing, setInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(status.caInstalled ?? null);
  const [caDetails, setCaDetails] = useState<any>(null);

  const isZh = language.startsWith('zh');

  const refreshStatus = async () => {
    try {
      const installed = await api.checkCaInstalled();
      setIsInstalled(installed);
      setStatus({ ...status, caInstalled: installed, isCaInstalled: installed });
      const details = await api.getCADetails();
      setCaDetails(details);
    } catch (e) {
      console.warn('CA check error:', e);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleInstallLocal = async () => {
    setInstalling(true);
    try {
      if (api.installCA) {
        await api.installCA();
        toast.success(t.success, isZh ? '根证书已成功安装并信任至系统' : 'Root CA installed to system trust store');
        await refreshStatus();
      } else {
        toast.info('Root CA installation is available in desktop app');
      }
    } catch (e: any) {
      toast.error(t.fail, e?.message || 'Failed to install Root CA');
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstallLocal = async () => {
    if (!window.confirm(isZh ? '确认从系统证书区卸载 ProxyPin 根证书？' : 'Are you sure you want to remove Root CA from system trust store?')) {
      return;
    }
    setInstalling(true);
    try {
      if ((window as any).go?.main?.App?.UninstallRootCA) {
        await (window as any).go.main.App.UninstallRootCA();
        toast.success(t.success, isZh ? '根证书已从系统卸载' : 'Root CA removed from trust store');
        await refreshStatus();
      } else {
        toast.info('Uninstall is available in desktop app');
      }
    } catch (e: any) {
      toast.error(t.fail, e?.message || 'Failed to uninstall Root CA');
    } finally {
      setInstalling(false);
    }
  };

  const handleDownloadCert = () => {
    window.open('http://127.0.0.1:9099/ssl', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[540px] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold">{t.installCaLocal} (PC Root CA)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Card */}
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border ${
            isInstalled
              ? 'bg-green-50/90 dark:bg-green-950/40 border-green-200 dark:border-green-800/60 text-green-950 dark:text-green-200'
              : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isInstalled ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-xs">
                {isInstalled
                  ? isZh
                    ? '证书状态: 已安装并信任 (Installed & Trusted)'
                    : 'Status: Installed & Trusted'
                  : isZh
                  ? '证书状态: 未安装 (Not Installed)'
                  : 'Status: Not Installed in System Trust Store'}
              </span>
              <span className="text-[11px] opacity-80 mt-0.5">
                {caDetails?.subject ? `Subject: ${caDetails.subject} | Valid to: ${caDetails.validTo}` : 'ProxyPin Root CA Certificate'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshStatus}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Info Box */}
        <div className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
          {isZh
            ? '为了解密 HTTPS 流量，需要将 ProxyPin 的根证书安装并信任到本机的系统受信任根证书颁发机构存储区。'
            : 'To decrypt HTTPS traffic, ProxyPin requires installing and trusting the Root Certificate Authority (CA) into your operating system trust store.'}
        </div>

        {/* Step Guide */}
        <div className="flex flex-col gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="font-semibold text-gray-800 dark:text-gray-200">
            {isZh ? '操作选项:' : 'Installation Options:'}
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              {isZh ? '1. 一键自动安装至系统受信任区:' : '1. Automatic one-click system trust:'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallLocal}
                disabled={installing}
                className="px-4 py-1.5 rounded-lg font-medium text-white shadow-xs cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: isInstalled ? '#16a34a' : activeColor.hex }}
              >
                {installing ? 'Processing...' : isInstalled ? (isZh ? '重新安装证书' : 'Reinstall Cert') : (isZh ? '一键安装证书' : 'Install Certificate')}
              </button>
              {isInstalled && (
                <button
                  type="button"
                  onClick={handleUninstallLocal}
                  disabled={installing}
                  className="px-3 py-1.5 rounded-lg font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer text-[11px]"
                >
                  {isZh ? '卸载' : 'Uninstall'}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-gray-200 dark:border-gray-800 pt-2.5">
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              {isZh ? '2. 手动下载证书文件 (.crt):' : '2. Download certificate file manually:'}
            </span>
            <button
              type="button"
              onClick={handleDownloadCert}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZh ? '下载证书 (.crt)' : 'Download CRT'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
