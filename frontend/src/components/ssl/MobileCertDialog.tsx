import React, { useState, useEffect } from 'react';
import { X, Smartphone, QrCode, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';

interface MobileCertDialogProps {
  platform: 'ios' | 'android';
  onClose: () => void;
}

export const MobileCertDialog: React.FC<MobileCertDialogProps> = ({
  platform,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const { status } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [localIps, setLocalIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('127.0.0.1');
  const [copied, setCopied] = useState(false);

  const isZh = language.startsWith('zh');
  const proxyPort = status.port || 9099;

  useEffect(() => {
    if ((window as any).go?.main?.App?.GetLocalIPs) {
      (window as any).go.main.App.GetLocalIPs().then((ips: string[]) => {
        if (ips && ips.length > 0) {
          setLocalIps(ips);
          setSelectedIp(ips[0]);
        }
      }).catch(console.error);
    } else {
      setLocalIps(['192.168.1.100', '127.0.0.1']);
      setSelectedIp('192.168.1.100');
    }
  }, []);

  const downloadUrl = `http://${selectedIp}:${proxyPort}/ssl`;

  const handleCopy = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[500px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
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
            <h2 className="text-sm font-semibold">
              {t.installRootCa} ({platform.toUpperCase()})
            </h2>
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
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">IP Address:</span>
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-outline)' }}
          >
            {localIps.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
          <QRCodeSVG value={downloadUrl} size={160} level="M" />
          <span className="text-[11px] text-gray-500 mt-2 text-center">
            {isZh
              ? '使用 Safari 或手机自带浏览器扫描下载证书'
              : 'Scan with mobile browser (Safari/Chrome) to download CA'}
          </span>
        </div>

        {/* Step Guide */}
        <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 text-[11px]">
          <div className="font-semibold text-gray-800 dark:text-gray-200">
            {platform === 'ios'
              ? isZh
                ? 'iOS 证书安装与信任步骤:'
                : 'iOS Certificate Trust Steps:'
              : isZh
              ? 'Android 证书安装步骤:'
              : 'Android Certificate Install Steps:'}
          </div>
          {platform === 'ios' ? (
            <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>{isZh ? '使用 Safari 打开下载链接，允许下载描述文件' : 'Open link in Safari, tap Allow to download profile'}</li>
              <li>{isZh ? '打开设置 -> 已下载的描述文件 -> 点击安装' : 'Open Settings -> Profile Downloaded -> Tap Install'}</li>
              <li>{isZh ? '打开设置 -> 通用 -> 关于本机 -> 证书信任设置 -> 开启 ProxyPin CA 根证书完全信任' : 'Open Settings -> General -> About -> Certificate Trust Settings -> Enable Full Trust for ProxyPin CA'}</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>{isZh ? '手机浏览器访问下载证书文件' : 'Download the CA certificate file from browser'}</li>
              <li>{isZh ? '打开手机设置 -> 安全 / 加密与凭据 -> 从存储设备安装证书' : 'Open Settings -> Security -> Install from storage -> CA Certificate'}</li>
              <li>{isZh ? '选择下载的 ProxyPinCA.crt 并确认安装' : 'Select ProxyPinCA.crt and confirm installation'}</li>
            </ol>
          )}

          <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 mt-1 font-mono">
            <span className="text-[10px] select-all truncate text-blue-600 dark:text-blue-400">
              {downloadUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white cursor-pointer"
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
