import React, { useMemo, useState } from 'react';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { toast } from '../../store/useToastStore';
import { Copy, ChevronDown, ChevronRight, Lock } from 'lucide-react';

interface GeneralTabProps {
  request: HttpRequest;
}

const RowWidget: React.FC<{ name: string; value?: string | number | null; mono?: boolean }> = ({
  name,
  value,
  mono = true,
}) => {
  const { t } = useTranslation();
  if (value === undefined || value === null || value === '') return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(String(value));
    toast.success(t.copied, String(value).slice(0, 80));
  };

  return (
    <div className="flex items-center py-1 border-b border-gray-100 dark:border-gray-800/60 text-[11px] group hover:bg-black/[0.015] dark:hover:bg-white/[0.015] px-1 rounded transition-colors">
      <div className="w-40 font-bold text-orange-600 dark:text-orange-400 shrink-0 select-text pr-2">
        {name}
      </div>
      <div className={`flex-1 break-all select-text text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>
        {String(value)}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer transition-opacity shrink-0"
        title="Copy value"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

const detectGraphQL = (body?: string): string | null => {
  if (!body || typeof body !== 'string') return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.query === 'string') {
      const match = parsed.query.match(/^\s*(query|mutation|subscription)\s+(\w+)/m);
      if (match && match[2]) return `${match[1]} ${match[2]}`;
      const anonMatch = parsed.query.match(/^\s*(query|mutation|subscription)/m);
      if (anonMatch && anonMatch[1]) return `${anonMatch[1]} (anonymous)`;
    }
    if (parsed && typeof parsed.operationName === 'string') return `Operation: ${parsed.operationName}`;
  } catch (_) {}
  return null;
};

const decodeJWT = (token: string): { header: any; payload: any } | null => {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { header, payload };
  } catch (_) {
    return null;
  }
};

const JWTDecoder: React.FC<{ token: string }> = ({ token }) => {
  const [expanded, setExpanded] = useState(false);
  const decoded = useMemo(() => decodeJWT(token), [token]);

  if (!decoded) return null;

  const exp = decoded.payload.exp;
  const isExpired = exp && exp * 1000 < Date.now();
  const expDate = exp ? new Date(exp * 1000).toLocaleString() : null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
      >
        <Lock className="w-3 h-3" />
        <span>JWT Decoded</span>
        {isExpired && <span className="text-red-500 text-[10px] font-bold">(EXPIRED)</span>}
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border p-3 text-[11px] font-mono space-y-2" style={{ borderColor: 'var(--md-sys-color-divider)', backgroundColor: 'var(--md-sys-color-surface-variant, rgba(0,0,0,0.04))' }}>
          <div>
            <span className="font-bold text-gray-500 text-[10px] uppercase">Header</span>
            <pre className="mt-1 break-all whitespace-pre-wrap">{JSON.stringify(decoded.header, null, 2)}</pre>
          </div>
          <div>
            <span className="font-bold text-gray-500 text-[10px] uppercase">Payload</span>
            <pre className="mt-1 break-all whitespace-pre-wrap">{JSON.stringify(decoded.payload, null, 2)}</pre>
          </div>
          {expDate && (
            <div className={`text-[10px] ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
              Expires: {expDate} {isExpired ? '⚠ Expired' : '✓ Valid'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const GeneralTab: React.FC<GeneralTabProps> = ({ request }) => {
  const reqTime = request.startTime
    ? new Date(request.startTime).toLocaleString()
    : request.timestamp
    ? new Date(request.timestamp).toLocaleString()
    : new Date().toLocaleString();

  const reqContentType =
    request.headers?.['content-type'] || request.headers?.['Content-Type'] || '';
  const respContentType =
    request.response?.contentType ||
    request.response?.headers?.['content-type'] ||
    request.response?.headers?.['Content-Type'] ||
    '';

  // GraphQL detection
  const graphqlOp = detectGraphQL(request.body || request.bodyString);

  // JWT detection (safely handles string or string[])
  const rawAuthHeader =
    request.headers?.['authorization'] ||
    request.headers?.['Authorization'] ||
    '';
  const authHeaderStr = Array.isArray(rawAuthHeader) ? rawAuthHeader.join(' ') : String(rawAuthHeader || '');
  const jwtToken = useMemo(() => {
    if (!authHeaderStr) return null;
    const match = authHeaderStr.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
  }, [authHeaderStr]);

  // Timing
  const totalDuration = request.response?.durationMs ?? request.durationMs ?? request.response?.duration;
  const timings = request.timings;

  // Process info
  const processName =
    request.processName ||
    request.process?.name ||
    (request.process as any)?.ProcessName ||
    null;

  return (
    <div className="flex-1 overflow-y-auto p-3 select-none space-y-2.5">
      {/* Main Info Card */}
      <div
        className="rounded-2xl border p-3 shadow-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 px-1">
          General Information
        </h3>

        <RowWidget name="Request URL" value={request.url} />
        <RowWidget name="Request Method" value={request.method} mono={false} />
        <RowWidget
          name="Protocol"
          value={
            request.protocol ||
            (request.url.startsWith('https://') ? 'HTTPS / TLS' : 'HTTP')
          }
        />
        {graphqlOp && <RowWidget name="GraphQL Operation" value={graphqlOp} mono={false} />}
        <RowWidget name="Status Code" value={request.response?.statusCode} />
        <RowWidget name="Remote Address" value={request.remoteAddr || request.clientAddr} />
        <RowWidget name="Request Time" value={reqTime} mono={false} />
        <RowWidget name="Duration" value={totalDuration !== undefined ? formatDuration(totalDuration) : undefined} mono={false} />
        <RowWidget name="Request Content-Type" value={reqContentType} mono={false} />
        <RowWidget name="Response Content-Type" value={respContentType} mono={false} />
        <RowWidget
          name="Request Size"
          value={formatSize(request.body ? request.body.length : (request.bodyString?.length ?? 0))}
          mono={false}
        />
        <RowWidget
          name="Response Size"
          value={formatSize(
            request.response?.bodySize ||
            (request.response?.body ? request.response.body.length : 0)
          )}
          mono={false}
        />
        {processName && <RowWidget name="App / Process" value={processName} mono={false} />}
      </div>

      {/* Timing Breakdown */}
      {timings && (
        <div
          className="rounded-2xl border p-3 shadow-xs"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 px-1">Timing</h3>
          {timings.dns !== undefined && <RowWidget name="DNS Lookup" value={`${timings.dns} ms`} />}
          {timings.connect !== undefined && <RowWidget name="TCP Connect" value={`${timings.connect} ms`} />}
          {timings.tls !== undefined && <RowWidget name="TLS Handshake" value={`${timings.tls} ms`} />}
          {timings.ttfb !== undefined && <RowWidget name="TTFB" value={`${timings.ttfb} ms`} />}
          {timings.total !== undefined && <RowWidget name="Total" value={`${timings.total} ms`} />}
        </div>
      )}

      {/* JWT Decoder */}
      {jwtToken && (
        <div
          className="rounded-2xl border p-3 shadow-xs"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <JWTDecoder token={jwtToken} />
        </div>
      )}
    </div>
  );
};
