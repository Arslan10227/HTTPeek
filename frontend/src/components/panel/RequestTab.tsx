import React, { useState } from 'react';
import { HttpRequest, HttpResponse } from '../../types';
import { HeadersViewer } from './HeadersViewer';
import { HttpBodyViewer } from './HttpBodyViewer';
import { CookiesCard } from './CookiesCard';
import { SuggestedRulesCard } from './SuggestedRulesCard';
import { ChevronDown, ChevronRight, Copy, Check, Table, Code, Search } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface RequestTabProps {
  request: HttpRequest;
  response?: HttpResponse | null;
  onOpenRule?: (type: 'rewrite' | 'mock' | 'breakpoint' | 'script', prefill?: any) => void;
}

export const RequestTab: React.FC<RequestTabProps> = ({ request, response, onOpenRule }) => {
  const { t } = useTranslation();
  const [isParamsExpanded, setIsParamsExpanded] = useState(true);
  const [paramsViewMode, setParamsViewMode] = useState<'table' | 'json' | 'raw'>('table');
  const [paramsFilter, setParamsFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Extract query parameters
  const queryParams: [string, string][] = [];
  try {
    const urlObj = new URL(request.url);
    urlObj.searchParams.forEach((v, k) => queryParams.push([k, v]));
  } catch (_) {}

  const filteredParams = queryParams.filter(
    ([k, v]) =>
      k.toLowerCase().includes(paramsFilter.toLowerCase()) ||
      v.toLowerCase().includes(paramsFilter.toLowerCase())
  );

  let pathname = request.url;
  try {
    const urlObj = new URL(request.url);
    pathname = urlObj.pathname;
  } catch (_) {}

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const handleCopyRow = (val: string, keyName: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Query Param Copied', val);
  };

  // Find Cookie header (case-insensitive)
  const cookieHeader = request.headers?.['cookie'] || request.headers?.['Cookie'];
  const hasBody = Boolean(request.body || request.bodyString);
  const contentType = Array.isArray(request.headers?.['content-type'] || request.headers?.['Content-Type'])
    ? (request.headers?.['content-type'] || request.headers?.['Content-Type']).join(', ')
    : String(request.headers?.['content-type'] || request.headers?.['Content-Type'] || '');

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none flex flex-col gap-3 font-sans text-xs">
      {/* 1. URL Path Card with Copy */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-mono shadow-2xs bg-white dark:bg-gray-900 transition-all shrink-0"
        style={{
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-black text-orange-600 dark:text-orange-400 shrink-0 text-[10px] uppercase bg-orange-100 dark:bg-orange-950/60 px-1.5 py-0.5 rounded">
            {request.method || 'GET'}
          </span>
          <span className="select-text truncate font-bold text-gray-800 dark:text-gray-200">
            {pathname}
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleCopy(request.url, 'Full URL Copied')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0 transition-colors"
          title="Copy full URL"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Smart Suggested Rules Card */}
      {onOpenRule && (
        <SuggestedRulesCard
          request={request}
          response={response}
          onOpenRule={onOpenRule}
        />
      )}

      {/* 3. Query Params Card (Only shown if populated) */}
      {queryParams.length > 0 && (
        <div
          className="rounded-2xl border overflow-hidden shadow-xs bg-white dark:bg-gray-900 transition-all shrink-0"
          style={{
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <div
            onClick={() => setIsParamsExpanded(!isParamsExpanded)}
            className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/80 dark:bg-gray-800/40 cursor-pointer select-none border-b shrink-0"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200">
              {isParamsExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span>Query Parameters</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                {queryParams.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setParamsViewMode('table')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    paramsViewMode === 'table' ? 'bg-orange-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setParamsViewMode('json')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    paramsViewMode === 'json' ? 'bg-orange-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setParamsViewMode('raw')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    paramsViewMode === 'raw' ? 'bg-orange-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Raw
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    paramsViewMode === 'json'
                      ? JSON.stringify(Object.fromEntries(queryParams), null, 2)
                      : queryParams.map(([k, v]) => `${k}=${v}`).join('&'),
                    'Query Parameters Copied'
                  )
                }
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                title="Copy query params"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isParamsExpanded && (
            <div className="p-3">
              {paramsViewMode === 'table' && (
                <div className="flex flex-col gap-2">
                  {queryParams.length > 4 && (
                    <div className="relative">
                      <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="text"
                        value={paramsFilter}
                        onChange={(e) => setParamsFilter(e.target.value)}
                        placeholder="Filter query params..."
                        className="w-full pl-8 pr-2.5 py-1 text-[11px] font-mono rounded-lg border bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none"
                        style={{ borderColor: 'var(--md-sys-color-divider)' }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden font-mono text-[11px]">
                    {filteredParams.map(([k, v], idx) => (
                      <div
                        key={`${k}-${idx}`}
                        className={`group flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-orange-50/30 dark:hover:bg-orange-950/20 transition-colors ${
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.015] dark:bg-white/[0.015]'
                        }`}
                      >
                        <span className="w-44 font-bold text-orange-600 dark:text-orange-400 select-text shrink-0 break-all">
                          {k}
                        </span>
                        <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all px-2">
                          {v}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyRow(v, k)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-orange-600 rounded cursor-pointer transition-opacity shrink-0"
                          title="Copy value"
                        >
                          {copiedKey === k ? (
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

              {paramsViewMode === 'json' && (
                <textarea
                  readOnly
                  value={JSON.stringify(Object.fromEntries(queryParams), null, 2)}
                  rows={Math.min(queryParams.length + 3, 14)}
                  className="w-full p-3 rounded-xl border font-mono text-[11px] bg-slate-900 text-orange-300 focus:outline-none resize-y select-text"
                  style={{ borderColor: 'var(--md-sys-color-divider)' }}
                />
              )}

              {paramsViewMode === 'raw' && (
                <textarea
                  readOnly
                  value={queryParams.map(([k, v]) => `${k}=${v}`).join('&')}
                  rows={Math.min(Math.ceil(queryParams.length / 2) + 1, 8)}
                  className="w-full p-3 rounded-xl border font-mono text-[11px] bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 focus:outline-none resize-y select-text"
                  style={{ borderColor: 'var(--md-sys-color-divider)' }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Request Cookies Card (Dynamic: only rendered if cookies exist) */}
      <CookiesCard type="request" cookieHeader={cookieHeader} />

      {/* 5. Headers Card (Dynamic: only rendered if headers exist) */}
      <HeadersViewer title="Request" headers={request.headers} />

      {/* 6. Body Card (Dynamic: only rendered if body exists) */}
      {hasBody && (
        <HttpBodyViewer
          title="Request"
          body={request.bodyString || request.body}
          contentType={contentType}
          bodySize={request.body ? request.body.length : 0}
        />
      )}
    </div>
  );
};
