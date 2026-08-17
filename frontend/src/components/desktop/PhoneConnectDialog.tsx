import React, { useState, useEffect } from 'react';
import { X, Smartphone, QrCode, Copy, Check, ShieldCheck, Link2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { useAppConfig } from '../../theme/useAppConfig';

interface PhoneConnectDialogProps {
  onClose: () => void;
}

export const PhoneConnectDialog: React.FC<PhoneConnectDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { status } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<'app' | 'cert'>('app');
  const activeColor = getActiveColorPreset();

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
  }, []);

  const certDownloadUrl = `http://${selectedIp || '127.0.0.1'}:${proxyPort}/ssl`;
  const appPairingPayload = `httpeek://connect?host=${selectedIp || '127.0.0.1'}&port=${proxyPort}`;

  const currentQrValue = qrMode === 'app' ? appPairingPayload : certDownloadUrl;

  const handleCopyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
      <div
        className="w-[480px] max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {isZh ? '手机移动端连接 & 证书安装' : 'Android App Pairing & SSL Certificate'}
              </h2>
              <p className="text-gray-500 text-xs">Pair HTTPeek Android app or install root CA</p>
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

        {/* IP Selector */}
        <div className="flex flex-col gap-1.5">
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

        {/* Tab Toggle: App Pairing vs CA Download */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl">
          <button
            type="button"
            onClick={() => setQrMode('app')}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              qrMode === 'app'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>1. Pair Android App</span>
          </button>
          <button
            type="button"
            onClick={() => setQrMode('cert')}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              qrMode === 'cert'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. CA Certificate URL</span>
          </button>
        </div>

        {/* QR Code and Quick Connect */}
        <div className="flex flex-col items-center justify-center p-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <QRCodeSVG value={currentQrValue} size={170} level="M" />
          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mt-2.5 text-center">
            {qrMode === 'app'
              ? 'Scan with HTTPeek Android Camera to pair instantly'
              : 'Scan with mobile browser to download Root CA certificate'}
          </span>
          <span className="text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-full">
            {currentQrValue}
          </span>
        </div>

        {/* Instructions */}
        <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-xs">
          <div className="font-bold text-gray-800 dark:text-gray-200">
            {qrMode === 'app' ? '📱 How to connect Android App:' : '🔐 How to install Root CA:'}
          </div>
          {qrMode === 'app' ? (
            <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 text-[11px]">
              <li>Make sure your phone and PC are connected to the same Wi-Fi.</li>
              <li>Open the <b>HTTPeek Android App</b>.</li>
              <li>Tap the <b>Scan QR</b> button in the top bar and point your camera here.</li>
              <li>Traffic will begin streaming to this desktop screen in real time!</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 text-[11px]">
              <li>Open mobile Chrome/browser and navigate to:</li>
              <li className="font-mono text-blue-600 dark:text-blue-400">{certDownloadUrl}</li>
              <li>Install downloaded file in phone Settings &gt; Security &gt; CA Certificate.</li>
            </ol>
          )}

          <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 mt-1">
            <span className="font-mono text-[11px] select-all truncate text-blue-600 dark:text-blue-400">
              {selectedIp}:{proxyPort}
            </span>
            <button
              type="button"
              onClick={() => handleCopyUrl(`${selectedIp}:${proxyPort}`)}
              className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white cursor-pointer"
              title="Copy IP:Port"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
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
