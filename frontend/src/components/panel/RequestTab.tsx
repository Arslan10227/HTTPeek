import React, { useState } from 'react';
import { HttpRequest } from '../../types';
import { HeadersViewer } from './HeadersViewer';
import { HttpBodyViewer } from './HttpBodyViewer';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface RequestTabProps {
  request: HttpRequest;
}

export const RequestTab: React.FC<RequestTabProps> = ({ request }) => {
  const { t } = useTranslation();
  const [isParamsExpanded, setIsParamsExpanded] = useState(true);

  // Extract query parameters
  const queryParams: [string, string][] = [];
  try {
    const urlObj = new URL(request.url);
    urlObj.searchParams.forEach((v, k) => queryParams.push([k, v]));
  } catch (_) {}

  let pathname = request.url;
  try {
    const urlObj = new URL(request.url);
    pathname = urlObj.pathname;
  } catch (_) {}

  const handleCopyPath = () => {
    navigator.clipboard.writeText(pathname);
    toast.success(t.copied, pathname);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none flex flex-col gap-3">
      {/* Path row */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono shadow-2xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-bold text-orange-600 dark:text-orange-400 shrink-0">
            Path:
          </span>
          <span className="select-text truncate text-gray-800 dark:text-gray-200">
            {pathname}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyPath}
          className="p-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer shrink-0"
          title="Copy path"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Query Params Table */}
      {queryParams.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden shadow-2xs"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <div
            onClick={() => setIsParamsExpanded(!isParamsExpanded)}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/40 cursor-pointer select-none border-b"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300 text-xs">
              {isParamsExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span>Request Params</span>
              <span className="text-[10px] font-normal text-gray-400 font-mono">
                ({queryParams.length})
              </span>
            </div>
          </div>

          {isParamsExpanded && (
            <div className="p-3">
              <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden font-mono text-[11px]">
                {queryParams.map(([k, v], idx) => (
                  <div
                    key={`${k}-${idx}`}
                    className={`flex items-start px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="w-40 font-semibold text-orange-600 dark:text-orange-400 select-text shrink-0 break-all">
                      {k}
                    </span>
                    <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all pl-2">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Headers */}
      <HeadersViewer title="Request" headers={request.headers} />

      {/* Body */}
      <HttpBodyViewer
        title="Request"
        body={request.body}
        contentType={
          Array.isArray(request.headers?.['content-type'] || request.headers?.['Content-Type'])
            ? (request.headers?.['content-type'] || request.headers?.['Content-Type']).join(', ')
            : String(request.headers?.['content-type'] || request.headers?.['Content-Type'] || '')
        }
        bodySize={request.body ? request.body.length : 0}
      />
    </div>
  );
};
