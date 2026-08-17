import React, { useState, useEffect } from 'react';
import { X, Smartphone, QrCode, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
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
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');
  const proxyPort = status.port || 9099;
  const webPort = 9099; // Proxy web server port

  useEffect(() => {
    // Fetch local IPs
    if ((window as any).go?.main?.App?.GetLocalIPs) {
      (window as any).go.main.App.GetLocalIPs().then((ips: string[]) => {
        if (ips && ips.length > 0) {
          setLocalIps(ips);
          setSelectedIp(ips[0]);
        }
      }).catch(console.error);
    } else {
      // Browser fallback
      setLocalIps(['127.0.0.1', '192.168.1.100']);
      setSelectedIp('192.168.1.100');
    }
  }, []);

  const certDownloadUrl = `http://${selectedIp || '127.0.0.1'}:${proxyPort}/ssl`;
  const qrConnectPayload = JSON.stringify({
    ip: selectedIp,
    port: proxyPort,
    type: 'proxypin',
  });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(certDownloadUrl);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-base font-semibold">{t.mobileConnect}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* IP Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            {isZh ? '选择局域网 IP 地址:' : 'Select Local Network IP:'}
          </label>
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-transparent text-xs font-mono focus:outline-none cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          >
            {localIps.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>

        {/* QR Code and Quick Connect */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
          <QRCodeSVG value={certDownloadUrl} size={170} level="M" />
          <span className="text-[11px] text-gray-500 mt-2 text-center">
            {isZh
              ? '使用手机浏览器扫描二维码下载并安装 CA 根证书'
              : 'Scan with mobile browser to download and install Root CA'}
          </span>
        </div>

        {/* Instructions */}
        <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
          <div className="font-semibold text-gray-700 dark:text-gray-300">
            {isZh ? '手动连接设置步骤:' : 'Manual Connection Steps:'}
          </div>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 text-[11px]">
            <li>
              {isZh ? '手机和电脑连接至同一 Wi-Fi 局域网' : 'Connect mobile and PC to same Wi-Fi'}
            </li>
            <li>
              {isZh ? '打开手机 Wi-Fi 设置 -> 配置代理 -> 手动' : 'Open Wi-Fi Settings -> Configure Proxy -> Manual'}
            </li>
            <li>
              {isZh ? `服务器: ${selectedIp}  |  端口: ${proxyPort}` : `Server: ${selectedIp}  |  Port: ${proxyPort}`}
            </li>
            <li>
              {isZh ? '打开手机浏览器访问以下地址安装证书:' : 'Open mobile browser and visit to install CA:'}
            </li>
          </ol>
          <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 mt-1">
            <span className="font-mono text-[11px] select-all truncate text-blue-600 dark:text-blue-400">
              {certDownloadUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white cursor-pointer"
              title="Copy"
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
            className="px-5 py-2 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
