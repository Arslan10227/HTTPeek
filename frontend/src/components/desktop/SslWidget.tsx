import React, { useState, useRef, useEffect } from 'react';
import { Lock, Unlock, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Download, RefreshCw, KeyRound, Smartphone, Monitor } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';
import { confirm } from '../../store/useConfirmDialog';
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
        toast.success(t.exportSuccess || 'Exported', 'ProxyPinCA.crt exported');
      } else {
        const url = `${window.location.origin}/ssl`;
        window.open(url, '_blank');
      }
    } catch (e: any) {
      toast.error(t.exportFailed || 'Export Failed', e?.message);
    }
    setIsOpen(false);
  };

  const handleExportP12 = async () => {
    const password = window.prompt('Enter export password for .p12 certificate:');
    if (password === null) return;
    try {
      if ((window as any).go?.main?.App?.ExportCAPkcs12) {
        await (window as any).go.main.App.ExportCAPkcs12(password);
        toast.success(t.exportSuccess || 'Exported', 'ProxyPinCA.p12 exported');
      } else {
        toast.info('P12 Export is available in desktop mode');
      }
    } catch (e: any) {
      toast.error(t.exportFailed || 'Export Failed', e?.message);
    }
    setIsOpen(false);
  };

  const handleGenerateCa = async () => {
    setIsOpen(false);
    const ok = await confirm({
      title: `${t.generateCA}?`,
      message: t.generateCADescribe || 'This will create a new Root CA keypair and invalidate existing device trust certificates.',
      type: 'warning',
      confirmText: 'Generate New CA',
    });
    if (!ok) return;

    try {
      if ((window as any).go?.main?.App?.GenerateNewCA) {
        await (window as any).go.main.App.GenerateNewCA();
        toast.success(t.success || 'Success', 'New Root CA generated');
        await refreshCaStatus();
      } else {
        toast.info('Root CA generated');
      }
    } catch (e: any) {
      toast.error(t.fail || 'Failed', e?.message);
    }
  };

  const handleResetDefaultCa = async () => {
    setIsOpen(false);
    const ok = await confirm({
      title: `${t.resetDefaultCA}?`,
      message: t.resetDefaultCADescribe || 'This will reset the Root Certificate Authority to default bundled keys.',
      type: 'danger',
      confirmText: 'Reset to Default',
    });
    if (!ok) return;

    try {
      if ((window as any).go?.main?.App?.ResetDefaultCA) {
        await (window as any).go.main.App.ResetDefaultCA();
        toast.success(t.success || 'Success', 'Reset to default Root CA');
        await refreshCaStatus();
      } else {
        toast.info('Default Root CA reset');
      }
    } catch (e: any) {
      toast.error(t.fail || 'Failed', e?.message);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon relative shrink-0"
        title="HTTPS Interception & Root CA"
      >
        {!isSslEnabled ? (
          <Unlock className="w-4 h-4 text-red-500" />
        ) : isCaInstalled ? (
          <Lock className="w-4 h-4 text-emerald-400" />
        ) : (
          <>
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl border p-2 flex flex-col gap-1 z-50 text-xs shadow-xl animate-dialog-in"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border-strong)',
            color: 'var(--color-text)',
          }}
        >
          {/* Header Status Strip */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs">HTTPS Decryption</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSslEnabled}
                onChange={handleToggleSsl}
                className="sr-only peer"
              />
              <div
                className={`w-8 h-4.5 rounded-full transition-colors peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all ${
                  isSslEnabled ? 'bg-emerald-500 after:translate-x-full' : 'bg-neutral-600'
                }`}
              />
            </label>
          </div>

          {/* Root CA Status Banner */}
          <div
            onClick={() => {
              setIsOpen(false);
              onOpenPcCert();
            }}
            className="flex items-center justify-between px-2.5 py-2 rounded-xl border border-dashed cursor-pointer transition-colors"
            style={{
              borderColor: isCaInstalled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
              backgroundColor: isCaInstalled ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
            }}
          >
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Root CA Status:</span>
            {isCaInstalled ? (
              <span className="badge-status badge-2xx">
                <CheckCircle2 className="w-3 h-3" />
                <span>Installed</span>
              </span>
            ) : (
              <span className="badge-status badge-3xx">
                <AlertTriangle className="w-3 h-3" />
                <span>Not Installed</span>
              </span>
            )}
          </div>

          {/* Action List */}
          <div className="flex flex-col gap-0.5 mt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenPcCert();
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span>Install CA on PC / System</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenMobileCert('ios');
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              <span>Install CA on iOS Device</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenMobileCert('android');
              }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-400" />
              <span>Install CA on Android Device</span>
            </button>
          </div>

          <div className="h-px my-1" style={{ backgroundColor: 'var(--color-border)' }} />

          {/* Certificate Exports & Reset */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={handleExportCrt}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export Root Certificate (.crt)</span>
            </button>

            <button
              type="button"
              onClick={handleExportP12}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export PKCS#12 Keystore (.p12)</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateCa}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-amber-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate New Root CA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
