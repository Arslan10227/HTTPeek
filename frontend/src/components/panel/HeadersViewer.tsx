import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Search } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface HeadersViewerProps {
  title: string;
  headers?: Record<string, string>;
}

export const HeadersViewer: React.FC<HeadersViewerProps> = ({ title, headers }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');

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

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawHeadersText);
    toast.success(t.copied, `${entries.length} headers`);
  };

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-2xs mb-3 text-xs"
      style={{
        backgroundColor: 'var(--md-dialog-bg)',
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/40 cursor-pointer select-none border-b"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span>{title} Headers</span>
          <span className="text-[10px] font-normal text-gray-400 font-mono">
            ({entries.length})
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'table' ? 'raw' : 'table')}
            className="px-2 py-0.5 rounded text-[10px] font-mono border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            {viewMode === 'table' ? 'Raw' : 'Table'}
          </button>
          <button
            type="button"
            onClick={handleCopyRaw}
            className="p-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            title="Copy all headers"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {viewMode === 'table' ? (
            <div className="flex flex-col gap-1">
              {entries.length > 5 && (
                <div className="relative mb-2">
                  <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter headers..."
                    className="w-full pl-7 pr-2 py-1 text-[11px] font-mono rounded-md border bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-divider)' }}
                  />
                </div>
              )}
              <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden font-mono text-[11px]">
                {filtered.map(([key, val], idx) => (
                  <div
                    key={key}
                    className={`flex items-start px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="w-44 font-semibold text-blue-600 dark:text-blue-400 select-text shrink-0 break-all">
                      {key}
                    </span>
                    <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all pl-2">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <textarea
              readOnly
              value={rawHeadersText}
              rows={Math.min(entries.length + 1, 14)}
              className="w-full p-2 rounded-lg border font-mono text-[11px] bg-transparent focus:outline-none resize-y select-text"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          )}
        </div>
      )}
    </div>
  );
};
