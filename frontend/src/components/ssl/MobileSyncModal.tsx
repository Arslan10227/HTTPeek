import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Copy, Check, ShieldCheck, QrCode, Wifi, Smartphone,
  Monitor, Download, RefreshCw, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { ADBDeviceInfo, AndroidInstallResult, InstallStepResult } from '../../types/androidCert';

interface MobileSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const stepStatusStyle = (status: InstallStepResult['status']) => {
  switch (status) {
    case 'success':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'failed':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'running':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'skipped':
      return 'text-slate-600 bg-slate-50 border-slate-200';
    default:
      return 'text-amber-700 bg-amber-50 border-amber-200';
  }
};

const StepIcon: React.FC<{ status: InstallStepResult['status'] }> = ({ status }) => {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 shrink-0" />;
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />;
  return <ShieldCheck className="w-3.5 h-3.5 shrink-0 opacity-60" />;
};

export const MobileSyncModal: React.FC<MobileSyncModalProps> = ({ isOpen, onClose }) => {
  const { status } = useProxyStore();
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [caDetails, setCaDetails] = useState<any>(null);
  const [installingDesktop, setInstallingDesktop] = useState(false);
  const [adbDevices, setAdbDevices] = useState<ADBDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [androidResult, setAndroidResult] = useState<AndroidInstallResult | null>(null);
  const [installingAndroid, setInstallingAndroid] = useState(false);
  const [refreshingDevices, setRefreshingDevices] = useState(false);

  const refreshCA = useCallback(() => {
    api.getCADetails().then(setCaDetails).catch(console.error);
  }, []);

  const refreshDevices = useCallback(async () => {
    setRefreshingDevices(true);
    try {
      const devices = await api.listADBDevices();
      setAdbDevices(devices);
      if (devices.length > 0 && !selectedDevice) {
        setSelectedDevice(devices[0].serial);
      }
    } finally {
      setRefreshingDevices(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (!isOpen) return;
    if ((window as any).go?.main?.App?.GetLocalIPs) {
      (window as any).go.main.App.GetLocalIPs().then((ips: string[]) => {
        setLocalIps(ips);
        if (ips.length > 0) setSelectedIp(ips[0]);
      });
    } else {
      setLocalIps(['127.0.0.1']);
      setSelectedIp('127.0.0.1');
    }
    refreshCA();
    refreshDevices();
    setAndroidResult(null);
  }, [isOpen, refreshCA, refreshDevices]);

  if (!isOpen) return null;

  const pairingPayload = JSON.stringify({
    scheme: 'httpeek',
    version: '1.0',
    host: selectedIp,
    port: status.port,
    enableSsl: status.enableSsl,
    caUrl: `http://${selectedIp}:${status.port}/api/ca/export`,
    wsUrl: `ws://${selectedIp}:${status.port}/ws/events`,
  });

  const certUrl = `http://${selectedIp}:${status.port}/api/ca/export`;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleInstallDesktopCA = async () => {
    setInstallingDesktop(true);
    try {
      await api.installDesktopRootCA();
      toast.success('Root CA installed in Windows trust store');
      refreshCA();
    } catch (e: any) {
      toast.error('Desktop CA install failed', e.message || String(e));
    } finally {
      setInstallingDesktop(false);
    }
  };

  const handleExportCA = async () => {
    try {
      const pem = await api.exportRootCA();
      const blob = new Blob([pem], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = caDetails?.androidCertFile || 'httpeek-root-ca.crt';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate exported');
    } catch (e: any) {
      toast.error('Export failed', e.message || String(e));
    }
  };

  const handleInstallAndroidCA = async () => {
    setInstallingAndroid(true);
    setAndroidResult(null);
    try {
      const result = await api.installAndroidRootCA(selectedDevice);
      setAndroidResult(result);
      if (result.success) {
        toast.success('Android certificate install initiated — confirm on device if prompted');
      } else {
        toast.warning('Automatic install incomplete — check fallback steps below');
      }
    } catch (e: any) {
      toast.error('Android install failed', e.message || String(e));
    } finally {
      setInstallingAndroid(false);
    }
  };

  const handleInAppInstall = async () => {
    try {
      const pem = await api.exportRootCA();
      if ((window as any).AndroidBridge?.installRootCA) {
        (window as any).AndroidBridge.installRootCA(pem);
        toast.info('Opening Android certificate installer…');
      } else {
        window.open(certUrl, '_blank');
        toast.info('Open the certificate URL on your Android device');
      }
    } catch (e: any) {
      toast.error('Install failed', e.message || String(e));
    }
  };

  return (
    <div className="htk-modal-overlay font-sans animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[92vh]">
        <div className="h-14 border-b border-slate-100 px-6 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Smartphone className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Mobile Connect & HTTPS Trust</h2>
              <p className="text-[11px] text-slate-400">Pair Android, install Root CA on desktop and device</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs overflow-y-auto">
          {/* QR Pairing */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> 1. Pair Android App
            </h3>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-md shrink-0">
                <QRCodeSVG value={pairingPayload} size={140} level="M" includeMargin={false} />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                  <Wifi className="w-3 h-3" /><span>Same Wi-Fi required</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Scan with the HTTPeek Android app. Pairing includes proxy host, WebSocket URL, and CA download URL.
                </p>
                <div className="flex items-center gap-2">
                  <select value={selectedIp} onChange={(e) => setSelectedIp(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-800 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer">
                    {localIps.map((ip) => <option key={ip} value={ip}>{ip}</option>)}
                  </select>
                  <span className="font-mono text-slate-500">:{status.port}</span>
                  <button onClick={() => copyText(pairingPayload, 'QR payload')} className="p-1 border border-slate-200 rounded-lg cursor-pointer">
                    {copied === 'QR payload' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Desktop CA */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> 2. Desktop HTTPS Trust (Windows)
            </h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">{caDetails?.subject || 'HTTPeek Root CA'}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                    {caDetails?.fingerprint ? `SHA-256: ${caDetails.fingerprint.slice(0, 24)}…` : 'Loading…'}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                  caDetails?.installed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  {caDetails?.installed ? 'Installed' : 'Not Installed'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleInstallDesktopCA} disabled={installingDesktop || caDetails?.installed}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {installingDesktop ? 'Installing…' : 'Install on Windows'}
                </button>
                <button onClick={handleExportCA}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export .crt
                </button>
              </div>
            </div>
          </section>

          {/* Android CA */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> 3. Android HTTPS Trust
            </h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              {caDetails?.androidCertFile && (
                <p className="text-[10px] text-slate-500">
                  System store filename (rooted): <span className="font-mono font-bold text-emerald-700">{caDetails.androidCertFile}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleInAppInstall}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Install on This Device
                </button>
                <button onClick={() => copyText(certUrl, 'CA URL')}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer">
                  Copy CA URL
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">ADB Install (USB device)</span>
                  <button onClick={refreshDevices} disabled={refreshingDevices}
                    className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingDevices ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {adbDevices.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No ADB devices detected. Connect via USB with debugging enabled, or use QR pairing in the app.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}
                      className="bg-white border border-slate-200 text-xs font-mono rounded-lg px-2 py-1.5 cursor-pointer">
                      {adbDevices.map((d) => (
                        <option key={d.serial} value={d.serial}>
                          {d.model || d.serial}{d.rooted ? ' (rooted)' : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={handleInstallAndroidCA} disabled={installingAndroid}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5">
                      {installingAndroid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {installingAndroid ? 'Installing…' : 'Install via ADB'}
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-slate-400">
                  Fallback order: rooted system store → push to Downloads → open CA URL → launch cert installer intent.
                </p>

                {androidResult?.steps && androidResult.steps.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {androidResult.steps.map((step, i) => (
                      <div key={`${step.method}-${i}`}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] ${stepStatusStyle(step.status)}`}>
                        <StepIcon status={step.status} />
                        <div className="min-w-0">
                          <span className="font-bold capitalize">{step.method.replace(/_/g, ' ')}</span>
                          <span className="mx-1 opacity-50">·</span>
                          <span className="opacity-90">{step.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
