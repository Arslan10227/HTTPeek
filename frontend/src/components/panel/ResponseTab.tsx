import React from 'react';
import { HttpRequest, HttpResponse } from '../../types';
import { HeadersViewer } from './HeadersViewer';
import { HttpBodyViewer } from './HttpBodyViewer';
import { CookiesCard } from './CookiesCard';
import { SuggestedRulesCard } from './SuggestedRulesCard';
import { Copy, Check, Activity, Clock, FileCode } from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface ResponseTabProps {
  request: HttpRequest;
  onOpenRule?: (type: 'rewrite' | 'mock' | 'breakpoint' | 'script', prefill?: any) => void;
}

const getStatusColor = (status?: number): string => {
  if (!status) return '#9E9E9E';
  if (status >= 200 && status < 300) return '#10b981';
  if (status >= 300 && status < 400) return '#3b82f6';
  if (status >= 400 && status < 500) return '#f59e0b';
  return '#ef4444';
};

export const ResponseTab: React.FC<ResponseTabProps> = ({ request, onOpenRule }) => {
  const response = request.response;
  const statusColor = getStatusColor(response?.statusCode);

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs italic p-12 bg-slate-50 dark:bg-gray-950 font-sans">
        <Activity className="w-8 h-8 opacity-40 mb-2 animate-pulse" />
        <span>Waiting for response from server...</span>
      </div>
    );
  }

  const rawContentType =
    response.contentType ||
    response.headers?.['content-type'] ||
    response.headers?.['Content-Type'] ||
    '';
  const contentType = Array.isArray(rawContentType)
    ? rawContentType.join(', ')
    : String(rawContentType || '');

  // Extract Set-Cookie header
  const setCookieHeader =
    response.headers?.['set-cookie'] ||
    response.headers?.['Set-Cookie'] ||
    response.headers?.['SET-COOKIE'];

  const hasBody = Boolean(
    response.body ||
    response.bodyString ||
    response.bodyBase64 ||
    (response.bodySize && response.bodySize > 0)
  );

  const handleCopyStatus = () => {
    const text = `HTTP ${response.statusCode} ${response.statusText || ''} (${response.durationMs || response.duration || 0}ms)`;
    navigator.clipboard.writeText(text);
    toast.success('Response Status Copied', text);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none flex flex-col gap-3 font-sans text-xs">
      {/* 1. Status Code Summary Card */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-mono shadow-2xs bg-white dark:bg-gray-900 transition-all shrink-0"
        style={{
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="font-black px-2.5 py-0.5 rounded-lg text-white text-xs shadow-2xs"
            style={{ backgroundColor: statusColor }}
          >
            {response.statusCode}
          </span>
          <span className="font-bold text-gray-800 dark:text-gray-200 text-sm font-sans">
            {response.statusText || 'OK'}
          </span>
          <span className="text-gray-400 text-[11px] font-sans">
            • {response.protocol || 'HTTP/1.1'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {(response.durationMs !== undefined || response.duration !== undefined) && (
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[11px] font-mono">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>{response.durationMs || response.duration} ms</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleCopyStatus}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0 transition-colors"
            title="Copy status info"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Smart Suggested Rules Card */}
      {onOpenRule && (
        <SuggestedRulesCard
          request={request}
          response={response}
          onOpenRule={onOpenRule}
        />
      )}

      {/* 3. Response Cookies Card (Dynamic: only rendered if Set-Cookie exists) */}
      <CookiesCard type="response" cookieHeader={setCookieHeader} />

      {/* 4. Response Headers Card (Dynamic: only rendered if headers exist) */}
      <HeadersViewer title="Response" headers={response.headers} />

      {/* 5. Response Body Card (Dynamic: only rendered if body exists) */}
      {hasBody && (
        <HttpBodyViewer
          title="Response"
          body={response.bodyString || response.body}
          bodyBase64={response.bodyBase64}
          contentType={contentType}
          bodySize={response.bodySize || (response.body ? response.body.length : 0)}
        />
      )}
    </div>
  );
};
