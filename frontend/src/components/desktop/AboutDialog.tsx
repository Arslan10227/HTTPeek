import React, { useState, useEffect } from 'react';
import { X, Code2, Globe, RefreshCw, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';

const APP_VERSION = '1.0.0';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/Arslan10227/HTTPeek/releases/latest';

interface AboutDialogProps {
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'update-available'>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const checkForUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const res = await fetch(GITHUB_RELEASES_API);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const rawTag = data?.tag_name || data?.name || '';
      const latest = String(rawTag).replace(/^v/, '').trim();
      if (latest) {
        setLatestVersion(latest);
        const cur = String(APP_VERSION || '1.0.0').split('.').map(Number);
        const lat = latest.split('.').map(Number);
        const isNewer = lat[0] > cur[0] || (lat[0] === cur[0] && lat[1] > cur[1]) || (lat[0] === cur[0] && lat[1] === cur[1] && lat[2] > cur[2]);
        setUpdateStatus(isNewer ? 'update-available' : 'up-to-date');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch (_) {
      setUpdateStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[440px] rounded-2xl shadow-2xl p-6 border flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        <div className="flex w-full justify-end -mt-2 -mr-2">
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Logo & Title */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg"
          style={{ backgroundColor: activeColor.hex }}
        >
          H
        </div>

        <div>
          <h1 className="text-xl font-black tracking-tight">HTTPeek</h1>
          <div className="text-xs font-semibold text-gray-500 mt-0.5">Next Gen HTTP Debugging Tool</div>
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">v{APP_VERSION} • Built with Go &amp; Wails</div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-[340px] leading-relaxed">
          High-performance, cross-platform HTTP/HTTPS/WebSocket proxy and traffic manipulation workbench by <strong>OneManByte</strong>.
        </p>

        {/* Update Checker */}
        <div className="flex items-center gap-2">
          {updateStatus === 'idle' && (
            <button
              type="button"
              onClick={checkForUpdate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check for Updates</span>
            </button>
          )}
          {updateStatus === 'checking' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Checking...</span>
            </div>
          )}
          {updateStatus === 'up-to-date' && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>You're up to date!</span>
            </div>
          )}
          {updateStatus === 'update-available' && (
            <a
              href="https://github.com/Arslan10227/HTTPeek/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
              style={{ backgroundColor: activeColor.hex }}
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              <span>Update to v{latestVersion} →</span>
            </a>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3 mt-1">
          <a
            href="https://github.com/Arslan10227/HTTPeek"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Code2 className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <a
            href="https://github.com/Arslan10227/HTTPeek/releases"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Globe className="w-4 h-4" />
            <span>Releases</span>
          </a>
        </div>

        <div className="text-[11px] text-gray-400 mt-2">
          Copyright © 2026 OneManByte. All rights reserved.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90 mt-1"
          style={{ backgroundColor: activeColor.hex }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
