import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Link2,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PowerOff,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { useAppConfig } from '../../theme/useAppConfig';

interface PhoneConnectDialogProps {
  onClose: () => void;
}

interface ADBDevice {
  serial: string;
  state: string;
  model: string;
  rooted: boolean;
}

export const PhoneConnectDialog: React.FC<PhoneConnectDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { status, connectedMobileDevices, setConnectedMobileDevices } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [tabMode, setTabMode] = useState<'pair' | 'connected' | 'adb' | 'cert'>('pair');

  // ADB Installation State
  const [adbDevices, setAdbDevices] = useState<ADBDevice[]>([]);
  const [isScanningAdb, setIsScanningAdb] = useState(false);
  const [isInstallingAdb, setIsInstallingAdb] = useState(false);
  const [adbInstallLog, setAdbInstallLog] = useState<string[]>([]);

  const isZh = language.startsWith('zh');
  const proxyPort = status.port || 9099;

  useEffect(() => {
    // Fetch local IPs from Go backend
    if ((window as any).go?.main?.App?.GetLocalIPs) {
      (window as any).go.main.App.GetLocalIPs().then((ips: string[]) => {
        if (ips && ips.length > 0) {
          setLocalIps(ips);
          setSelectedIp(ips[0]);
        }
      }).catch(console.error);
    } else {
      setLocalIps(['127.0.0.1', '192.168.1.100']);
      setSelectedIp('192.168.1.100');
    }

    // Default to connected tab if a device is active
    if (connectedMobileDevices.length > 0) {
      setTabMode('connected');
    }

    scanAdbDevices();
  }, []);

  const scanAdbDevices = async () => {
    setIsScanningAdb(true);
    if ((window as any).go?.main?.App?.ListADBDevices) {
      try {
        const devs = await (window as any).go.main.App.ListADBDevices();
        setAdbDevices(devs || []);
      } catch (e) {
        console.error('Failed to list ADB devices', e);
      }
    }
    setIsScanningAdb(false);
  };

  const handleInstallViaAdb = async (serial: string) => {
    setIsInstallingAdb(true);
    setAdbInstallLog([`⚡ [${serial}] Starting 1-Click ADB CA Certificate installation...`]);

    const installFunc = (window as any).go?.main?.App?.InstallCertToAndroid || (window as any).go?.main?.App?.InstallAndroidRootCA;
    if (installFunc) {
      try {
        const res = await installFunc(serial);
        if (res && res.steps) {
          const logs = res.steps.map((s: any) => `• [${s.method}] ${s.message}`);
          setAdbInstallLog((prev) => [...prev, ...logs]);
        }
        if (res?.success) {
          toast.success(
            '👑 (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ CA Installed via ADB!',
            `Installed to ${serial}. ${res.systemInstalled ? 'System root store active!' : 'User credentials store active!'}`
          );
        } else {
          toast.info('ADB Notice', 'Pushed to device Downloads / KeyChain.');
        }
      } catch (e: any) {
        setAdbInstallLog((prev) => [...prev, `💥 Error: ${e.message || e}`]);
        toast.error('ADB Install Failed', e.message || 'Could not install certificate');
      }
    } else {
      setAdbInstallLog((prev) => [...prev, 'ℹ️ ADB installation requires desktop app runtime.']);
    }
    setIsInstallingAdb(false);
  };

  const handleDisconnectMobile = async (deviceId: string) => {
    if ((window as any).go?.main?.App?.DisconnectMobileDevice) {
      await (window as any).go.main.App.DisconnectMobileDevice(deviceId);
    }
    setConnectedMobileDevices(connectedMobileDevices.filter((d) => d.deviceId !== deviceId));
    toast.info('📱 Disconnected', 'Mobile companion disconnected.');
  };

  const certDownloadUrl = `http://${selectedIp || '127.0.0.1'}:${proxyPort}/ssl`;
  const appPairingPayload = `httpeek://connect?host=${selectedIp || '127.0.0.1'}&port=${proxyPort}`;

  const handleCopyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('📋 (¬‿¬) Copied!', 'IP & Port copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
      <div className="w-[520px] max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {isZh ? 'Android 手机连接 & 证书安装' : 'Android App Companion & CA Hub'}
              </h2>
              <p className="text-gray-500 text-xs">Pair mobile app, monitor connection, or install root CA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Grid */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl text-center">
          <button
            type="button"
            onClick={() => setTabMode('pair')}
            className={`py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              tabMode === 'pair'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pair QR</span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode('connected')}
            className={`py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 relative ${
              tabMode === 'connected'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Connected ({connectedMobileDevices.length})</span>
            {connectedMobileDevices.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1 right-1 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabMode('adb')}
            className={`py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              tabMode === 'adb'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>ADB Installer</span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode('cert')}
            className={`py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              tabMode === 'cert'
                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CA URL</span>
          </button>
        </div>

        {/* Tab 1: QR Code Pairing */}
        {tabMode === 'pair' && (
          <div className="flex flex-col gap-3">
            {/* IP Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {isZh ? '选择局域网 Wi-Fi IP 地址:' : 'Select Local Wi-Fi IP Address:'}
              </label>
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-xs font-mono focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {localIps.map((ip) => (
                  <option key={ip} value={ip}>
                    {ip} (Port: {proxyPort})
                  </option>
                ))}
              </select>
            </div>

            {/* QR Box */}
            <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <QRCodeSVG value={appPairingPayload} size={160} level="M" />
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mt-2.5 text-center">
                Scan with HTTPeek Android Camera to pair instantly
              </span>
              <span className="text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-full">
                {appPairingPayload}
              </span>
            </div>

            {/* Quick IP & Port Copy */}
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {selectedIp}:{proxyPort}
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrl(`${selectedIp}:${proxyPort}`)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 cursor-pointer text-[11px] font-bold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy IP:Port'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Connected Mobile Devices */}
        {tabMode === 'connected' && (
          <div className="flex flex-col gap-3">
            {connectedMobileDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <Smartphone className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  No Mobile Devices Connected
                </span>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Scan the QR code in the "Pair QR" tab with the HTTPeek Android app to connect.
                </p>
                <button
                  type="button"
                  onClick={() => setTabMode('pair')}
                  className="mt-3 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Show Pairing QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Active Connected Android Devices ({connectedMobileDevices.length}):
                </span>
                {connectedMobileDevices.map((dev) => (
                  <div
                    key={dev.deviceId}
                    className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            {dev.deviceName || 'Android Phone'}
                          </span>
                          {dev.isRooted ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              ⚡ Rooted
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                              🔒 Non-Root
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                          {dev.remoteIp} • {dev.osVersion || 'Android'} • {dev.packetCount} packets streamed
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDisconnectMobile(dev.deviceId)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer border border-transparent hover:border-red-200"
                      title="Disconnect Device"
                    >
                      <PowerOff className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: ADB 1-Click Installer */}
        {tabMode === 'adb' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Connected ADB Devices (USB / Wi-Fi):
              </span>
              <button
                type="button"
                onClick={scanAdbDevices}
                disabled={isScanningAdb}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isScanningAdb ? 'animate-spin' : ''}`} />
                <span>Rescan ADB</span>
              </button>
            </div>

            {adbDevices.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>No ADB Devices Detected</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                  Connect your phone via USB cable and enable <b>USB Debugging</b> in Developer Options.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {adbDevices.map((dev) => (
                  <div
                    key={dev.serial}
                    className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span>{dev.model || dev.serial}</span>
                        {dev.rooted ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-100 text-amber-700 font-mono">
                            ⚡ Rooted (System CA Store)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-100 text-blue-700 font-mono">
                            🔑 Non-Root (User CA Store)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">{dev.serial}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInstallViaAdb(dev.serial)}
                      disabled={isInstallingAdb}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      <span>{dev.rooted ? 'Install Root CA' : 'Install User CA'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ADB Installation Log Box */}
            {adbInstallLog.length > 0 && (
              <div className="p-2.5 bg-gray-900 text-gray-200 rounded-xl font-mono text-[10px] max-h-28 overflow-y-auto space-y-1">
                {adbInstallLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: CA Certificate URL */}
        {tabMode === 'cert' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <QRCodeSVG value={certDownloadUrl} size={160} level="M" />
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mt-2.5 text-center">
                Scan with mobile browser to download Root CA certificate
              </span>
              <span className="text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-full">
                {certDownloadUrl}
              </span>
            </div>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {certDownloadUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrl(certDownloadUrl)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 cursor-pointer text-[11px] font-bold shrink-0 ml-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy URL</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-1 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold text-xs text-white cursor-pointer shadow-md bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
