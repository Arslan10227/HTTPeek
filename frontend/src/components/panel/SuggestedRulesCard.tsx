import React from 'react';
import {
  Sparkles,
  Sliders,
  Play,
  Clock,
  Ban,
  ArrowRight,
  Shield,
  Layers,
  Code2,
} from 'lucide-react';
import { HttpRequest, HttpResponse } from '../../types';

interface SuggestedRulesCardProps {
  request: HttpRequest;
  response?: HttpResponse | null;
  onOpenRule: (type: 'rewrite' | 'mock' | 'breakpoint' | 'script', prefill?: any) => void;
}

export const SuggestedRulesCard: React.FC<SuggestedRulesCardProps> = ({
  request,
  response,
  onOpenRule,
}) => {
  const domain = request.hostPort?.host || 'api.example.com';
  const pathname = request.path || '/';
  const method = request.method || 'GET';

  const suggestions = [
    {
      id: 'mock_200',
      title: 'Mock Response (HTTP 200)',
      description: 'Return immediate mock response body without hitting server',
      icon: Sparkles,
      color: '#10b981',
      badge: 'Mock',
      onClick: () => onOpenRule('mock', {
        name: `Mock 200 - ${pathname}`,
        statusCode: 200,
        body: response?.bodyString || response?.body || '{\n  "code": 0,\n  "status": "mocked"\n}',
      }),
    },
    {
      id: 'redirect',
      title: 'Redirect Endpoint',
      description: 'Forward requests to local dev server or staging backend',
      icon: ArrowRight,
      color: '#3b82f6',
      badge: 'Rewrite',
      onClick: () => onOpenRule('rewrite', {
        name: `Redirect - ${pathname}`,
        action: 'redirect',
        redirectUrl: `http://localhost:8080${pathname}`,
      }),
    },
    {
      id: 'breakpoint',
      title: 'Pause on Breakpoint',
      description: 'Halt execution on next hit to inspect and mutate live in editor',
      icon: Sliders,
      color: '#f59e0b',
      badge: 'Breakpoint',
      onClick: () => onOpenRule('breakpoint', {
        name: `Breakpoint - ${pathname}`,
        method: method,
      }),
    },
    {
      id: 'delay',
      title: 'Inject Latency Lag (+500ms)',
      description: 'Test UI loading states and slow network timeouts',
      icon: Clock,
      color: '#8b5cf6',
      badge: 'Throttle',
      onClick: () => onOpenRule('rewrite', {
        name: `Lag 500ms - ${pathname}`,
        action: 'delay',
        delayMs: 500,
      }),
    },
    {
      id: 'drop',
      title: 'Silent Connection Drop',
      description: 'Simulate connection reset / TCP abort failure',
      icon: Ban,
      color: '#f43f5e',
      badge: 'Block',
      onClick: () => onOpenRule('rewrite', {
        name: `Drop - ${pathname}`,
        action: 'drop',
      }),
    },
  ];

  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-xs text-xs bg-white dark:bg-gray-900 transition-all"
      style={{
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 border-b select-none shrink-0"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Suggested Interceptor Rules</span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black uppercase">
            1-Click
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
          {domain}{pathname}
        </span>
      </div>

      <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {suggestions.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              onClick={s.onClick}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500/60 bg-gray-50/40 dark:bg-gray-800/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-all flex flex-col justify-between group shadow-2xs"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div
                  className="p-1.5 rounded-lg text-white shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: s.color }}
                >
                  <Icon className="w-3 h-3" />
                </div>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                  {s.badge}
                </span>
              </div>
              <div className="mt-1.5">
                <div className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-[11px] transition-colors">
                  {s.title}
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-tight">
                  {s.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
