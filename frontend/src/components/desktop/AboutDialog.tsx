import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Globe,
  RefreshCw,
  ArrowUpCircle,
  CheckCircle2,
  Shield,
  Zap,
  Sliders,
  Layers,
  Sparkles,
  ExternalLink,
  Heart,
  Cpu,
  Terminal,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';

const APP_VERSION = '2.5.0';
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const featureCards = [
    {
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      title: 'Multi-Protocol Engine',
      desc: 'Native capture & MITM for HTTP/1.1, HTTP/2, HTTP/3 (QUIC), WebSocket frames, SSE events, and gRPC streams.',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      bg: 'rgba(245, 158, 11, 0.05)',
    },
    {
      icon: <Sliders className="w-5 h-5 text-cyan-400" />,
      title: '100% Visual Rule Studios',
      desc: 'Zero-code studios for URL rewrite, header mutation, live breakpoints, network throttling, payload crypto & map local.',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      bg: 'rgba(6, 182, 212, 0.05)',
    },
    {
      icon: <Shield className="w-5 h-5 text-emerald-400" />,
      title: 'Zero-Compromise Security',
      desc: 'Byte-for-byte Subresource Integrity (SRI) passthrough, dynamic Root CA generator, JVM bytecode instrumentation & VPN tunnel.',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      bg: 'rgba(16, 185, 129, 0.05)',
    },
    {
      icon: <Layers className="w-5 h-5 text-purple-400" />,
      title: 'Cloud & Mobile Bridge',
      desc: 'Firebase Auth Google Sign-In, instant LAN Android companion pairing, QR workflow, ADB 1-click reverse tunnel & team sync.',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      bg: 'rgba(168, 85, 247, 0.05)',
    },
  ];

  const systemSpecs = [
    { label: 'Engine Core', value: 'Go 1.25 + Wails v2.15' },
    { label: 'Frontend', value: 'React 19 + Vite + TypeScript' },
    { label: 'Cloud CDN', value: 'httpeek.onemanbyte.cc' },
    { label: 'Architecture', value: 'Cross-Platform Native' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md select-none p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Background Ambient Glow */}
      <div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none blur-[120px] opacity-25"
        style={{
          background: `radial-gradient(circle, ${activeColor.hex} 0%, #06B6D4 40%, #8B5CF6 70%, transparent 100%)`,
        }}
      />

      <div
        className="relative w-full max-w-[780px] rounded-3xl p-8 border shadow-2xl flex flex-col items-center text-center gap-6 z-10 overflow-hidden"
        style={{
          backgroundColor: 'rgba(12, 17, 26, 0.95)',
          borderColor: `${activeColor.hex}40`,
          boxShadow: `0 0 50px ${activeColor.hex}20, 0 20px 40px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Emblem & Title */}
        <div className="flex flex-col items-center">
          <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 96 96">
              <path
                stroke={activeColor.hex}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                className="animate-pulse"
                d="M48 6 L84 26 L84 70 L48 90 L12 70 L12 26 Z"
              />
              <path
                stroke="#06B6D4"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M52 18 L28 50 L46 50 L42 78 L68 44 L48 44 Z"
              />
              <circle cx="48" cy="6" r="3.5" fill={activeColor.hex} />
              <circle cx="84" cy="26" r="3.5" fill="#06B6D4" />
              <circle cx="84" cy="70" r="3.5" fill="#8B5CF6" />
              <circle cx="48" cy="90" r="3.5" fill="#F59E0B" />
              <circle cx="12" cy="70" r="3.5" fill={activeColor.hex} />
              <circle cx="12" cy="26" r="3.5" fill="#06B6D4" />
            </svg>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 via-cyan-400 to-indigo-400 drop-shadow-md">
            HTTPeek
          </h1>

          {/* Subheading Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-300 mt-3 shadow-inner">
            <span>Next-Gen</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              HTTP / HTTPS / QUIC
            </span>
            <span>Workbench</span>
          </div>

          {/* Author attribution */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2.5">
            <span>Crafted with passion by</span>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
              OneManByte
            </span>
            <span className="text-gray-500">•</span>
            <span className="font-mono text-gray-400 font-bold">v{APP_VERSION}</span>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
          {featureCards.map((card, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.01]"
              style={{
                borderColor: card.borderColor,
                backgroundColor: card.bg,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {card.icon}
                <h3 className="text-xs font-extrabold text-gray-200">{card.title}</h3>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* System Specs Bar */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 text-left font-mono text-[11px]">
          {systemSpecs.map((spec, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{spec.label}</span>
              <span className="text-gray-300 font-semibold truncate">{spec.value}</span>
            </div>
          ))}
        </div>

        {/* Bottom Actions & Update Checker */}
        <div className="flex flex-wrap items-center justify-between w-full gap-3 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2">
            {updateStatus === 'idle' && (
              <button
                type="button"
                onClick={checkForUpdate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for Updates</span>
              </button>
            )}
            {updateStatus === 'checking' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-xs text-gray-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Checking GitHub Releases…</span>
              </div>
            )}
            {updateStatus === 'up-to-date' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Latest Version Installed</span>
              </div>
            )}
            {updateStatus === 'update-available' && (
              <a
                href="https://github.com/Arslan10227/HTTPeek/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-emerald-400 to-cyan-400 cursor-pointer shadow-lg hover:opacity-90"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>Update to v{latestVersion}</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Arslan10227/HTTPeek"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://httpeek.onemanbyte.cc"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Cloud</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 rounded-xl text-xs font-bold text-black transition-all cursor-pointer hover:opacity-90"
              style={{ backgroundColor: activeColor.hex }}
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
