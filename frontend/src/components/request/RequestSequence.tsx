import React, { useState } from 'react';
import { HttpRequest } from '../../types';
import { RequestContextMenu, ContextMenuPosition } from './RequestContextMenu';
import { Square, CheckSquare } from 'lucide-react';

interface RequestSequenceProps {
  requests: HttpRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (req: HttpRequest) => void;
  selectedIds: Set<string>;
  onToggleSelectId: (id: string, shiftKey?: boolean) => void;
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

const getMethodClass = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':     return 'badge-method badge-get';
    case 'POST':    return 'badge-method badge-post';
    case 'PUT':     return 'badge-method badge-put';
    case 'PATCH':   return 'badge-method badge-patch';
    case 'DELETE':  return 'badge-method badge-delete';
    case 'OPTIONS': return 'badge-method badge-options';
    case 'HEAD':    return 'badge-method badge-head';
    case 'CONNECT': return 'badge-method badge-connect';
    case 'WS':      return 'badge-method badge-ws';
    case 'SSE':     return 'badge-method badge-sse';
    case 'GRPC':    return 'badge-method badge-grpc';
    case 'H3':      return 'badge-method badge-h3';
    default:        return 'badge-method badge-options';
  }
};

const renderStatusBadge = (status?: number) => {
  if (!status) return <span className="badge-status badge-pending">···</span>;
  if (status >= 200 && status < 300) return <span className="badge-status badge-2xx">{status}</span>;
  if (status >= 300 && status < 400) return <span className="badge-status badge-3xx">{status}</span>;
  if (status >= 400 && status < 500) return <span className="badge-status badge-4xx">{status}</span>;
  return <span className="badge-status badge-5xx">{status}</span>;
};

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '–';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const detectGraphQLOp = (req: HttpRequest): string | null => {
  const body = req.body || req.bodyString;
  if (!body || typeof body !== 'string') return null;
  try {
    const p = JSON.parse(body);
    if (p && typeof p.query === 'string') {
      const m = p.query.match(/^\s*(query|mutation|subscription)\s+(\w+)/m);
      return m?.[2] ?? 'GraphQL';
    }
  } catch (_) {}
  return null;
};

export const RequestSequence: React.FC<RequestSequenceProps> = ({
  requests,
  selectedRequestId,
  onSelectRequest,
  selectedIds,
  onToggleSelectId,
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    request: HttpRequest;
    position: ContextMenuPosition;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, req: HttpRequest) => {
    e.preventDefault();
    setContextMenu({ request: req, position: { x: e.clientX, y: e.clientY } });
  };

  return (
    <div className="flex-1 overflow-auto text-xs select-none flex flex-col min-h-0">
      {/* Table Header */}
      <div
        className="flex items-center px-2 h-8 border-b font-semibold text-[11px] shrink-0 sticky top-0 z-10"
        style={{
          background: 'var(--color-surface-raised)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-subtle)',
        }}
      >
        {selectedIds.size > 0 && <div className="w-6 shrink-0" />}
        <div className="w-8 text-center shrink-0">#</div>
        <div className="w-[68px] shrink-0">Method</div>
        <div className="flex-1 min-w-[200px]">URL / Path</div>
        <div className="w-14 text-center shrink-0">Status</div>
        <div className="w-24 shrink-0 hidden md:block">Type</div>
        <div className="w-14 text-right shrink-0">Time</div>
        <div className="w-14 text-right shrink-0 pr-2">Size</div>
        <div className="w-20 shrink-0 hidden lg:block">App</div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {requests.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-48 gap-2"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <span className="text-xs">No requests captured yet.</span>
          </div>
        ) : (
          requests.map((req, idx) => {
            const isSelected = selectedRequestId === req.id;
            const isChecked = selectedIds.has(req.id);
            const rawContentType =
              req.response?.contentType ||
              req.response?.headers?.['content-type'] ||
              req.response?.headers?.['Content-Type'] ||
              '';
            const contentType = Array.isArray(rawContentType)
              ? rawContentType.join(', ')
              : String(rawContentType || '');

            return (
              <div
                key={req.id}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    onToggleSelectId(req.id, e.shiftKey);
                  } else {
                    onSelectRequest(req);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, req)}
                className="group flex items-center px-2 py-1.5 border-b cursor-pointer font-mono text-[11px] transition-colors animate-row-in"
                style={{
                  borderColor: 'var(--color-border)',
                  background: isSelected
                    ? 'rgba(0,229,163,0.08)'
                    : isChecked
                    ? 'var(--color-surface-raised)'
                    : idx % 2 === 0
                    ? 'transparent'
                    : 'rgba(0,0,0,0.01)',
                  borderLeft: isSelected ? `3px solid var(--color-primary)` : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-raised)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background =
                      isChecked
                        ? 'var(--color-surface-raised)'
                        : idx % 2 === 0
                        ? 'transparent'
                        : 'rgba(0,0,0,0.01)';
                }}
              >
                {selectedIds.size > 0 && (
                  <div className="w-6 shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSelectId(req.id); }}
                      className="cursor-pointer"
                      style={{ color: 'var(--color-text-subtle)' }}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Index */}
                <div className="w-8 text-center shrink-0" style={{ color: 'var(--color-text-subtle)' }}>
                  {idx + 1}
                </div>

                {/* Method badge */}
                <div className="w-[68px] shrink-0">
                  <span className={getMethodClass(req.method)}>{req.method}</span>
                </div>

                {/* URL — host bold, path muted */}
                <div className="flex-1 min-w-[200px] truncate flex items-center gap-1.5" title={req.url}>
                  {/* Protocol Indicator Pill */}
                  {req.protocol === 'HTTP/3.0' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25 shrink-0">
                      H3
                    </span>
                  )}
                  {req.protocol === 'HTTP/2.0' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                      H2
                    </span>
                  )}
                  {(contentType.includes('application/grpc') || req.protocol?.includes('gRPC')) && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                      gRPC
                    </span>
                  )}
                  {contentType.includes('text/event-stream') && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
                      SSE
                    </span>
                  )}
                  {(req.protocol === 'RawTCP' || req.protocol === 'RawTLS') && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                      TCP
                    </span>
                  )}

                  {(() => {
                    try {
                      const u = new URL(req.url);
                      return (
                        <>
                          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{u.host}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{u.pathname + u.search}</span>
                        </>
                      );
                    } catch {
                      return <span style={{ color: 'var(--color-text)' }}>{req.url}</span>;
                    }
                  })()}
                  {(() => {
                    const gql = detectGraphQLOp(req);
                    return gql ? (
                      <span className="badge-method" style={{ background: 'rgba(236,72,153,0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.2)', flexShrink: 0 }}>
                        {gql}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Status */}
                <div className="w-14 text-center shrink-0">
                  {renderStatusBadge(req.response?.statusCode)}
                </div>

                {/* Content-Type */}
                <div className="w-24 truncate text-[10px] shrink-0 hidden md:block" style={{ color: 'var(--color-text-subtle)' }}>
                  {contentType ? contentType.split(';')[0] : '–'}
                </div>

                {/* Duration */}
                <div className="w-14 text-right font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDuration(req.response?.duration)}
                </div>

                {/* Size */}
                <div className="w-14 text-right font-mono shrink-0 pr-2" style={{ color: 'var(--color-text-muted)' }}>
                  {formatSize(req.response?.bodySize)}
                </div>

                {/* App */}
                <div className="w-20 truncate text-[10px] shrink-0 hidden lg:block" style={{ color: 'var(--color-text-subtle)' }}>
                  {req.processName || req.process?.name || '–'}
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <RequestContextMenu
          request={contextMenu.request}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onEditAndResend={onEditAndResend}
          onOpenRewriteRule={onOpenRewriteRule}
          onOpenMapLocal={onOpenMapLocal}
          onOpenBreakpoint={onOpenBreakpoint}
        />
      )}
    </div>
  );
};
