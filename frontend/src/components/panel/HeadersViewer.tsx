import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Search, Check, Code, FileText, Table } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface HeadersViewerProps {
  title: string;
  headers?: Record<string, string | string[]>;
}

export const HeadersViewer: React.FC<HeadersViewerProps> = ({ title, headers }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'raw'>('table');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!headers || Object.keys(headers).length === 0) {
    return null;
  }

  const entries: [string, string][] = Object.entries(headers).map(([k, v]) => [
    String(k || ''),
    Array.isArray(v) ? v.join(', ') : String(v ?? ''),
  ]);

  const filtered = entries.filter(
    ([k, v]) =>
      k.toLowerCase().includes(filterQuery.toLowerCase()) ||
      v.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const rawHeadersText = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  const jsonHeadersText = JSON.stringify(
    entries.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    null,
    2
  );

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const handleCopyRow = (val: string, keyName: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Copied Value', val);
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-xs text-xs bg-white dark:bg-gray-900 transition-all"
      style={{
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-1.5 bg-gray-50/80 dark:bg-gray-800/40 cursor-pointer select-none border-b shrink-0"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
          <span>{title} Headers</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-0.2 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-2 py-0.2 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'json' ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.2 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'raw' ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Raw
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(viewMode === 'json' ? jsonHeadersText : rawHeadersText, 'Headers Copied')}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            title="Copy all headers"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-2">
          {viewMode === 'table' && (
            <div className="flex flex-col gap-1.5">
              {entries.length > 4 && (
                <div className="relative">
                  <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1.5 pointer-events-none" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter headers..."
                    className="w-full pl-8 pr-2 py-0.5 text-[11px] font-mono rounded-lg border bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-divider)' }}
                  />
                </div>
              )}
              <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-y-auto max-h-64 font-mono text-[11px]">
                {filtered.map(([key, val], idx) => (
                  <div
                    key={`${key}-${idx}`}
                    className={`group flex items-center justify-between px-2.5 py-1 border-b border-gray-100 dark:border-gray-800/60 last:border-b-0 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.015] dark:bg-white/[0.015]'
                    }`}
                  >
                    <span className="w-44 font-bold text-blue-600 dark:text-blue-400 select-text shrink-0 break-all pr-2">
                      {key}
                    </span>
                    <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all">
                      {val}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyRow(val, key)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 rounded cursor-pointer transition-opacity shrink-0"
                      title="Copy header value"
                    >
                      {copiedKey === key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'json' && (
            <textarea
              readOnly
              value={jsonHeadersText}
              rows={Math.min(entries.length + 2, 14)}
              className="w-full p-2.5 rounded-xl border font-mono text-[11px] bg-slate-900 text-blue-300 focus:outline-none resize-y select-text"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          )}

          {viewMode === 'raw' && (
            <textarea
              readOnly
              value={rawHeadersText}
              rows={Math.min(entries.length + 1, 14)}
              className="w-full p-2.5 rounded-xl border font-mono text-[11px] bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 focus:outline-none resize-y select-text"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          )}
        </div>
      )}
    </div>
  );
};
