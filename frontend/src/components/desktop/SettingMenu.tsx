import React, { useState, useRef, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  ChevronRight,
  Shield,
  Globe,
  Ban,
  FileCode,
  MapPin,
  KeyRound,
  Code2,
  PauseCircle,
  Gauge,
  Network,
  Info,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';

export interface SettingDialogTriggers {
  onOpenFilter: () => void;
  onOpenHosts: () => void;
  onOpenBlock: () => void;
  onOpenRewrite: () => void;
  onOpenMap: () => void;
  onOpenCrypto: () => void;
  onOpenScript: () => void;
  onOpenBreakpoint: () => void;
  onOpenWeakNetwork: () => void;
  onOpenExternalProxy: () => void;
  onOpenAbout: () => void;
}

interface SettingMenuProps extends SettingDialogTriggers {}

export const SettingMenu: React.FC<SettingMenuProps> = ({
  onOpenFilter,
  onOpenHosts,
  onOpenBlock,
  onOpenRewrite,
  onOpenMap,
  onOpenCrypto,
  onOpenScript,
  onOpenBreakpoint,
  onOpenWeakNetwork,
  onOpenExternalProxy,
  onOpenAbout,
}) => {
  const { t, language } = useTranslation();
  const { status, setStatus } = useProxyStore();
  const {
    enableSocks5,
    setEnableSocks5,
    enabledHttp2,
    setEnabledHttp2,
    proxyPassDomains,
    setProxyPassDomains,
    getActiveColorPreset,
  } = useAppConfig();

  const [isOpen, setIsOpen] = useState(false);
  const [isProxySubmenuOpen, setIsProxySubmenuOpen] = useState(false);
  const [portInput, setPortInput] = useState<string>(String(status.port || 9099));
  const menuRef = useRef<HTMLDivElement>(null);
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');
  const systemProxyEnabled = status.systemProxyEnabled ?? false;

  useEffect(() => {
    setPortInput(String(status.port || 9099));
  }, [status.port]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsProxySubmenuOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleSystemProxy = async () => {
    try {
      const next = !systemProxyEnabled;
      if (api.setSystemProxy) {
        await api.setSystemProxy(next);
      }
      setStatus({ ...status, systemProxyEnabled: next });
      toast.info(`System Proxy ${next ? 'Enabled' : 'Disabled'}`);
    } catch (e: any) {
      toast.error('System Proxy Error', e?.message);
    }
  };

  const handleUpdatePort = async () => {
    const p = parseInt(portInput, 10);
    if (isNaN(p) || p < 1 || p > 65535) {
      toast.warning('Invalid Port', 'Port must be between 1 and 65535');
      return;
    }
    try {
      if (api.setPort) {
        await api.setPort(p);
      }
      setStatus({ ...status, port: p });
      toast.success(t.saveSuccess, `Proxy port changed to ${p}`);
    } catch (e: any) {
      toast.error('Failed to change port', e?.message);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsProxySubmenuOpen(false);
        }}
        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
        title={t.setting}
      >
        <SettingsIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-56 rounded-xl shadow-xl py-1 border z-50 text-xs flex flex-col animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        >
          {/* Proxy Submenu Item */}
          <div
            className="relative"
            onMouseEnter={() => setIsProxySubmenuOpen(true)}
            onMouseLeave={() => setIsProxySubmenuOpen(false)}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium">
              <span>{t.proxy}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </div>

            {/* Proxy Submenu Dropdown */}
            {isProxySubmenuOpen && (
              <div
                className="absolute left-full top-0 ml-1 w-64 rounded-xl shadow-xl p-3 border z-50 text-xs flex flex-col gap-2.5 animate-in fade-in duration-75"
                style={{
                  backgroundColor: 'var(--md-dialog-bg)',
                  borderColor: 'var(--md-sys-color-divider)',
                }}
              >
                {/* Port setting */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{t.port}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={portInput}
                      onChange={(e) => setPortInput(e.target.value)}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono border rounded-md text-right bg-transparent"
                      style={{ borderColor: 'var(--md-sys-color-outline)' }}
                    />
                    <button
                      type="button"
                      onClick={handleUpdatePort}
                      className="px-2 py-0.5 text-[11px] rounded-md font-medium text-white cursor-pointer"
                      style={{ backgroundColor: activeColor.hex }}
                    >
                      {t.save}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-gray-200 dark:bg-gray-800" />

                {/* System Proxy */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{t.setAs}{t.systemProxy}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemProxyEnabled}
                      onChange={handleToggleSystemProxy}
                      className="sr-only peer"
                    />
                    <div
                      className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
                      style={{
                        backgroundColor: systemProxyEnabled ? activeColor.hex : undefined,
                      }}
                    />
                  </label>
                </div>

                <div className="h-px bg-gray-200 dark:bg-gray-800" />

                {/* SOCKS5 */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">SOCKS5</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSocks5}
                      onChange={(e) => setEnableSocks5(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
                      style={{
                        backgroundColor: enableSocks5 ? activeColor.hex : undefined,
                      }}
                    />
                  </label>
                </div>

                {/* HTTP/2 */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{t.enabledHTTP2}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabledHttp2}
                      onChange={(e) => setEnabledHttp2(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all"
                      style={{
                        backgroundColor: enabledHttp2 ? activeColor.hex : undefined,
                      }}
                    />
                  </label>
                </div>

                <div className="h-px bg-gray-200 dark:bg-gray-800" />

                {/* Proxy Ignore Domains */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px]">{t.proxyIgnoreDomain}</span>
                    <button
                      type="button"
                      onClick={() => setProxyPassDomains('localhost;127.0.0.1;')}
                      className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                    >
                      {t.reset}
                    </button>
                  </div>
                  <textarea
                    value={proxyPassDomains}
                    onChange={(e) => setProxyPassDomains(e.target.value)}
                    rows={2}
                    placeholder="localhost;127.0.0.1;*.local"
                    className="w-full p-1.5 text-[11px] font-mono border rounded-md resize-none bg-transparent"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Domain Filter */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenFilter();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.domainFilter}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Hosts */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenHosts();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.hosts}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Request Block */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenBlock();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.requestBlock}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Request Rewrite */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenRewrite();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.requestRewrite}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Request Map */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenMap();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.requestMap}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Request Crypto */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenCrypto();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.requestCrypto}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Script */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenScript();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.script}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Breakpoint */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenBreakpoint();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.breakpoint}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Weak Network */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenWeakNetwork();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.weakNetwork}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* External Proxy */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenExternalProxy();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
          >
            <span>{t.externalProxy}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Open Logs Folder */}
          <button
            type="button"
            onClick={async () => {
              setIsOpen(false);
              await api.openLogFolder();
              toast.info('Opening logs directory in File Explorer');
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
          >
            <span>Open Logs Folder</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

          {/* About */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenAbout();
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-gray-600 dark:text-gray-400"
          >
            <span>{t.about}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
};
