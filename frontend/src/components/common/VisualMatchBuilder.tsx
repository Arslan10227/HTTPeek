import React, { useState } from 'react';
import { Globe, ListFilter, Sparkles, Wand2 } from 'lucide-react';
import { HttpMethodPicker } from './HttpMethodPicker';
import { useProxyStore } from '../../store/useProxyStore';
import { MethodBadge } from './MethodBadge';

interface VisualMatchBuilderProps {
  urlPattern: string;
  onChangeUrlPattern: (pattern: string) => void;
  method?: string;
  onChangeMethod?: (method: string) => void;
  protocol?: string;
  onChangeProtocol?: (protocol: string) => void;
  title?: string;
  className?: string;
}

export const VisualMatchBuilder: React.FC<VisualMatchBuilderProps> = ({
  urlPattern,
  onChangeUrlPattern,
  method = '',
  onChangeMethod,
  protocol = 'ALL',
  onChangeProtocol,
  title = 'Target URL & Matching Condition',
  className = '',
}) => {
  const { requests } = useProxyStore();
  const [showTrafficPicker, setShowTrafficPicker] = useState(false);

  // Extract unique active hosts/paths from recent traffic
  const recentEndpoints = React.useMemo(() => {
    const map = new Map<string, { method: string; host: string; path: string; url: string }>();
    for (let i = requests.length - 1; i >= 0 && map.size < 15; i--) {
      const r = requests[i];
      const host = r.hostPort?.host || '';
      const path = r.path || '/';
      const key = `${r.method || 'GET'} ${host}${path}`;
      if (host && !map.has(key)) {
        map.set(key, { method: r.method || 'GET', host, path, url: r.url });
      }
    }
    return Array.from(map.values());
  }, [requests]);

  const applyWildcard = (type: 'domain' | 'api' | 'exact' | 'suffix') => {
    try {
      let host = 'example.com';
      let path = '/*';
      if (urlPattern.includes('://')) {
        const parsed = new URL(urlPattern.startsWith('*://') ? urlPattern.replace('*://', 'https://') : urlPattern);
        host = parsed.hostname || host;
        path = parsed.pathname || path;
      } else if (urlPattern.includes('/')) {
        const parts = urlPattern.split('/');
        host = parts[0] || host;
        path = '/' + parts.slice(1).join('/');
      } else if (urlPattern.trim()) {
        host = urlPattern.trim();
      }

      if (type === 'domain') {
        onChangeUrlPattern(`*://${host}/*`);
      } else if (type === 'api') {
        onChangeUrlPattern(`*://${host}/api/*`);
      } else if (type === 'suffix') {
        onChangeUrlPattern(`*://${host}/*.json`);
      } else if (type === 'exact') {
        onChangeUrlPattern(`https://${host}${path}`);
      }
    } catch (_) {
      onChangeUrlPattern(`*://${urlPattern.trim() || 'example.com'}/*`);
    }
  };

  return (
    <div className={`flex flex-col gap-3.5 p-4 rounded-xl border bg-gray-50/80 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">{title}</span>
        </div>
        {recentEndpoints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTrafficPicker(!showTrafficPicker)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <ListFilter className="w-3 h-3" />
            Pick from Active Traffic ({recentEndpoints.length})
          </button>
        )}
      </div>

      {/* Active Traffic Dropdown Picker */}
      {showTrafficPicker && (
        <div className="p-2 rounded-lg border border-emerald-500/30 bg-white dark:bg-gray-900 max-h-40 overflow-y-auto flex flex-col gap-1 shadow-lg animate-in fade-in duration-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-0.5">
            Click to auto-populate match pattern:
          </div>
          {recentEndpoints.map((ep, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChangeUrlPattern(`*://${ep.host}${ep.path}`);
                if (onChangeMethod) onChangeMethod(ep.method);
                setShowTrafficPicker(false);
              }}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded-md text-left hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors cursor-pointer text-xs font-mono"
            >
              <div className="flex items-center gap-1.5 truncate">
                <MethodBadge method={ep.method} size="sm" />
                <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{ep.host}</span>
                <span className="text-gray-400 truncate">{ep.path}</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium shrink-0">
                Use URL
              </span>
            </button>
          ))}
        </div>
      )}

      {/* HTTP Method Selector */}
      {onChangeMethod && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">HTTP Method:</span>
          <HttpMethodPicker value={method} onChange={onChangeMethod} size="sm" />
        </div>
      )}

      {/* Protocol Selector */}
      {onChangeProtocol && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Protocol:</span>
          <div className="flex items-center gap-1.5">
            {['ALL', 'HTTPS', 'HTTP', 'WSS', 'WS'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChangeProtocol(p)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  protocol === p
                    ? 'badge-connect ring-1 ring-indigo-500 scale-105'
                    : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URL Match Pattern Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">URL Pattern (supports * wildcards & regex):</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">1-Click Wildcards:</span>
            <button
              type="button"
              onClick={() => applyWildcard('domain')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-200 dark:bg-gray-700 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
              title="Match all URLs on this domain"
            >
              *domain*
            </button>
            <button
              type="button"
              onClick={() => applyWildcard('api')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-200 dark:bg-gray-700 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
              title="Match all /api/* routes"
            >
              /api/*
            </button>
            <button
              type="button"
              onClick={() => applyWildcard('suffix')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-200 dark:bg-gray-700 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
              title="Match all .json files"
            >
              *.json
            </button>
          </div>
        </div>
        <input
          type="text"
          value={urlPattern}
          onChange={(e) => onChangeUrlPattern(e.target.value)}
          placeholder="*://api.example.com/* or *login*"
          className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
};
