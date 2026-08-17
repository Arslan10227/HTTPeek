import React, { useState, useRef, useEffect } from 'react';
import { Lock, Unlock, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';
import { useAppConfig } from '../../theme/useAppConfig';

interface SslWidgetProps {
  onOpenPcCert: () => void;
  onOpenMobileCert: (platform: 'ios' | 'android') => void;
}

export const SslWidget: React.FC<SslWidgetProps> = ({
  onOpenPcCert,
  onOpenMobileCert,
}) => {
  const { t, language } = useTranslation();
  const { status, setStatus } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [isCaInstalled, setIsCaInstalled] = useState(status.caInstalled ?? false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');
  const isSslEnabled = status.sslEnabled ?? true;

  const refreshCaStatus = async () => {
    try {
      const installed = await api.checkCaInstalled();
      setIsCaInstalled(installed);
      setStatus({ ...status, caInstalled: installed, isCaInstalled: installed });
    } catch (_) {}
  };

  useEffect(() => {
    refreshCaStatus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      refreshCaStatus();
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleSsl = async () => {
    try {
      const next = !isSslEnabled;
      if (api.setSslEnabled) {
        await api.setSslEnabled(next);
      }
      setStatus({ ...status, sslEnabled: next });
      toast.info(`HTTPS Interception ${next ? 'Enabled' : 'Disabled'}`);
    } catch (e: any) {
      toast.error('SSL Error', e?.message || 'Failed to toggle SSL');
    }
  };

  const handleExportCrt = async () => {
    try {
      if ((window as any).go?.main?.App?.ExportCACert) {
        await (window as any).go.main.App.ExportCACert();
        toast.success(t.exportSuccess, 'ProxyPinCA.crt exported');
      } else {
        const url = `${window.location.origin}/ssl`;
        window.open(url, '_blank');
      }
    } catch (e: any) {
      toast.error(t.exportFailed, e?.message);
    }
    setIsOpen(false);
  };

  const handleExportP12 = async () => {
    const password = window.prompt('Enter export password for .p12 certificate:');
    if (password === null) return;
    try {
      if ((window as any).go?.main?.App?.ExportCAPkcs12) {
        await (window as any).go.main.App.ExportCAPkcs12(password);
        toast.success(t.exportSuccess, 'ProxyPinCA.p12 exported');
      } else {
        toast.info('P12 Export is available in desktop mode');
      }
    } catch (e: any) {
      toast.error(t.exportFailed, e?.message);
    }
    setIsOpen(false);
  };

  const handleGenerateCa = async () => {
    if (window.confirm(`${t.generateCA}?\n${t.generateCADescribe}`)) {
      try {
        if ((window as any).go?.main?.App?.GenerateNewCA) {
          await (window as any).go.main.App.GenerateNewCA();
          toast.success(t.success, 'New Root CA generated');
          await refreshCaStatus();
        } else {
          toast.info('Root CA generated');
        }
      } catch (e: any) {
        toast.error(t.fail, e?.message);
      }
      setIsOpen(false);
    }
  };

  const handleResetDefaultCa = async () => {
    if (window.confirm(`${t.resetDefaultCA}?\n${t.resetDefaultCADescribe}`)) {
      try {
        if ((window as any).go?.main?.App?.ResetDefaultCA) {
          await (window as any).go.main.App.ResetDefaultCA();
          toast.success(t.success, 'Reset to default Root CA');
          await refreshCaStatus();
        } else {
          toast.info('Default Root CA reset');
        }
      } catch (e: any) {
        toast.error(t.fail, e?.message);
      }
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
        title={t.httpsProxy}
      >
        {!isSslEnabled ? (
          <Unlock className="w-5 h-5 text-red-500" />
        ) : isCaInstalled ? (
          <Lock className="w-5 h-5 text-green-500" />
        ) : (
          <>
            <Lock className="w-5 h-5 text-amber-500" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 border border-white dark:border-gray-900" />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-64 rounded-xl shadow-xl py-1.5 border z-50 text-xs flex flex-col animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        >
          {/* HTTPS Toggle Switch */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="font-medium text-xs">{t.httpsProxy}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSslEnabled}
                onChange={handleToggleSsl}
                className="sr-only peer"
              />
              <div
                className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
                style={{
                  backgroundColor: isSslEnabled ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Certificate Install Status Banner */}
          <div
            onClick={() => {
              setIsOpen(false);
              onOpenPcCert();
            }}
            className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-gray-500">Root CA Status:</span>
            {isCaInstalled ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Installed</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Not Installed</span>
              </span>
            )}
          </div>

          {/* Menu Items */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenPcCert();
            }}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            {t.installCaLocal}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenMobileCert('ios');
            }}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            {t.installRootCa} iOS
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenMobileCert('android');
            }}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            {t.installRootCa} Android
          </button>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

          <button
            type="button"
            onClick={handleExportCrt}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            {t.exportCA}
          </button>

          <button
            type="button"
            onClick={handleExportP12}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            {t.exportCaP12}
          </button>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

          <button
            type="button"
            onClick={handleGenerateCa}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            {t.generateCA}
          </button>

          <button
            type="button"
            onClick={handleResetDefaultCa}
            className="px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            {t.resetDefaultCA}
          </button>
        </div>
      )}
    </div>
  );
};
