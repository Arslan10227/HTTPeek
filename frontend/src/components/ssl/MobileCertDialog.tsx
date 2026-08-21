import React, { useState, useEffect } from 'react';
import { Smartphone, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { Dialog } from '../ui/Dialog';

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
    <Dialog
      isOpen
      onClose={onClose}
      title={`${t.installRootCa} (${platform.toUpperCase()})`}
      subtitle="Scan QR or download the certificate on your mobile device."
      icon={<Smartphone className="w-5 h-5" />}
      maxWidth="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
        >
          {t.close}
        </button>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* IP Selector */}
        <div className="flex items-center gap-2">
          <span className="font-semibold shrink-0" style={{ color: 'var(--color-text-muted)' }}>IP Address:</span>
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="input-base font-mono text-xs cursor-pointer"
          >
            {localIps.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>

        {/* QR Code */}
        <div
          className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border shadow-inner"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <QRCodeSVG value={downloadUrl} size={150} level="M" />
          <span className="text-[11px] text-neutral-500 mt-2 text-center">
            {isZh
              ? '使用 Safari 或手机自带浏览器扫描下载证书'
              : 'Scan with mobile browser (Safari/Chrome) to download CA'}
          </span>
        </div>

        {/* Step Guide */}
        <div
          className="flex flex-col gap-2 p-3.5 rounded-2xl border text-[11px]"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
        >
          <div className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {platform === 'ios'
              ? isZh
                ? 'iOS 证书安装与信任步骤:'
                : 'iOS Certificate Trust Steps:'
              : isZh
              ? 'Android 证书安装步骤:'
              : 'Android Certificate Install Steps:'}
          </div>
          {platform === 'ios' ? (
            <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--color-text-muted)' }}>
              <li>{isZh ? '使用 Safari 打开下载链接，允许下载描述文件' : 'Open link in Safari, tap Allow to download profile'}</li>
              <li>{isZh ? '打开设置 -> 已下载的描述文件 -> 点击安装' : 'Open Settings -> Profile Downloaded -> Tap Install'}</li>
              <li>{isZh ? '打开设置 -> 通用 -> 关于本机 -> 证书信任设置 -> 开启 ProxyPin CA 根证书完全信任' : 'Open Settings -> General -> About -> Certificate Trust Settings -> Enable Full Trust for ProxyPin CA'}</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--color-text-muted)' }}>
              <li>{isZh ? '手机浏览器访问下载证书文件' : 'Download the CA certificate file from browser'}</li>
              <li>{isZh ? '打开手机设置 -> 安全 / 加密与凭据 -> 从存储设备安装证书' : 'Open Settings -> Security -> Install from storage -> CA Certificate'}</li>
              <li>{isZh ? '选择下载的 ProxyPinCA.crt 并确认安装' : 'Select ProxyPinCA.crt and confirm installation'}</li>
            </ol>
          )}

          <div
            className="flex items-center justify-between px-3 py-1.5 rounded-xl border mt-1 font-mono"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <span className="text-[10px] select-all truncate text-blue-400">
              {downloadUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
