import React from 'react';
import {
  Sliders,
  FileCode,
  Globe,
  Ban,
  PauseCircle,
  Code2,
  KeyRound,
  Gauge,
  ArrowRight,
} from 'lucide-react';
import { useAppConfig } from '../../theme/useAppConfig';

interface MockRulesPageProps {
  onOpenRewrite: () => void;
  onOpenMap: () => void;
  onOpenBlock: () => void;
  onOpenBreakpoint: () => void;
  onOpenScript: () => void;
  onOpenHosts: () => void;
  onOpenCrypto: () => void;
  onOpenWeakNetwork: () => void;
  onOpenExternalProxy: () => void;
}

export const MockRulesPage: React.FC<MockRulesPageProps> = ({
  onOpenRewrite,
  onOpenMap,
  onOpenBlock,
  onOpenBreakpoint,
  onOpenScript,
  onOpenHosts,
  onOpenCrypto,
  onOpenWeakNetwork,
}) => {
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const ruleCategories = [
    {
      id: 'mock',
      title: 'Mock Responses (Map Local)',
      subtitle: 'Return custom HTTP status codes, headers, and mock JSON/HTML bodies for matched requests.',
      icon: <FileCode className="w-5 h-5 text-amber-400" />,
      color: '#f59e0b',
      badge: 'Active',
      actionLabel: 'Configure Mock Responses',
      onClick: onOpenMap,
    },
    {
      id: 'rewrite',
      title: 'Request & Response Rewrites',
      subtitle: 'Modify request/response URLs, headers, status codes, and body payloads on the fly.',
      icon: <Sliders className="w-5 h-5 text-blue-400" />,
      color: '#3b82f6',
      badge: 'Active',
      actionLabel: 'Configure Rewrite Rules',
      onClick: onOpenRewrite,
    },
    {
      id: 'breakpoint',
      title: 'Breakpoints (Pause Traffic)',
      subtitle: 'Pause matching requests or responses before forwarding, allowing live interactive edits.',
      icon: <PauseCircle className="w-5 h-5 text-purple-400" />,
      color: '#a855f7',
      badge: 'Active',
      actionLabel: 'Configure Breakpoints',
      onClick: onOpenBreakpoint,
    },
    {
      id: 'block',
      title: 'Request Blocking (Blacklist)',
      subtitle: 'Instantly abort, drop, or return 403/404 for analytics, ads, or unwanted telemetry.',
      icon: <Ban className="w-5 h-5 text-rose-400" />,
      color: '#ef4444',
      badge: 'Active',
      actionLabel: 'Configure Block Rules',
      onClick: onOpenBlock,
    },
    {
      id: 'script',
      title: 'Custom JavaScript Interceptors',
      subtitle: 'Execute full Goja JavaScript scripts to inspect, mutate, calculate HMACs, and rewrite traffic.',
      icon: <Code2 className="w-5 h-5 text-teal-400" />,
      color: '#14b8a6',
      badge: 'Studio',
      actionLabel: 'Open Script Studio',
      onClick: onOpenScript,
    },
    {
      id: 'hosts',
      title: 'Host & DNS Redirection',
      subtitle: 'Map domains and IP addresses to redirect traffic to staging, localhost, or test servers.',
      icon: <Globe className="w-5 h-5 text-indigo-400" />,
      color: '#6366f1',
      badge: 'DNS',
      actionLabel: 'Manage Host Mappings',
      onClick: onOpenHosts,
    },
    {
      id: 'throttle',
      title: 'Network Throttling & Latency',
      subtitle: 'Simulate 2G/3G/4G, high latency, random packet loss, and constrained bandwidth.',
      icon: <Gauge className="w-5 h-5 text-emerald-400" />,
      color: '#10b981',
      badge: 'Network',
      actionLabel: 'Configure Network Throttling',
      onClick: onOpenWeakNetwork,
    },
    {
      id: 'crypto',
      title: 'Crypto & Payload Decryption',
      subtitle: 'Automatically decrypt and re-encrypt customized encrypted payload flows in real time.',
      icon: <KeyRound className="w-5 h-5 text-cyan-400" />,
      color: '#06b6d4',
      badge: 'Security',
      actionLabel: 'Manage Crypto Interceptors',
      onClick: onOpenCrypto,
    },
  ];

  return (
    <div
      className="flex-1 h-full overflow-y-auto p-5 flex flex-col gap-4 select-none font-sans"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* ── Categorized Rules Grid (Standardized 3-Column) ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ruleCategories.map((rule) => (
          <div
            key={rule.id}
            onClick={rule.onClick}
            className="card group flex flex-col justify-between p-5 cursor-pointer card-hover-lift"
          >
            <div>
              <div className="flex items-start justify-between">
                <div
                  className="p-3 rounded-2xl flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: `${rule.color}18` }}
                >
                  {rule.icon}
                </div>
                <span className="badge-status badge-2xx">
                  {rule.badge}
                </span>
              </div>

              <h3
                className="font-bold text-sm mt-4 group-hover:text-emerald-400 transition-colors"
                style={{ color: 'var(--color-text)' }}
              >
                {rule.title}
              </h3>
              <p
                className="text-xs mt-1.5 line-clamp-2 leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {rule.subtitle}
              </p>
            </div>

            <div
              className="mt-4 pt-3 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: 'var(--color-primary)' }}
              >
                {rule.actionLabel}
              </span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
