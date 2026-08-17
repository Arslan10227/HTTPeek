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

const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#2196F3';
    case 'POST':
      return '#4CAF50';
    case 'PUT':
      return '#FF9800';
    case 'DELETE':
      return '#F44336';
    case 'PATCH':
      return '#9C27B0';
    case 'WS':
      return '#E91E63';
    case 'SSE':
      return '#00BCD4';
    default:
      return '#607D8B';
  }
};

const getStatusColor = (status?: number): string => {
  if (!status) return '#9E9E9E';
  if (status >= 200 && status < 300) return '#4CAF50';
  if (status >= 300 && status < 400) return '#2196F3';
  if (status >= 400 && status < 500) return '#FF9800';
  return '#F44336';
};

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '-';
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
      if (m && m[2]) return m[2];
      return 'GraphQL';
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
    setContextMenu({
      request: req,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="flex-1 overflow-auto text-xs select-none flex flex-col min-h-0">
      {/* Table Header */}
      <div
        className="flex items-center px-2 py-1.5 border-b font-semibold text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-800/60 shrink-0 sticky top-0 z-10"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        {selectedIds.size > 0 && <div className="w-6 shrink-0" />}
        <div className="w-10 text-center shrink-0">#</div>
        <div className="w-16 shrink-0">Method</div>
        <div className="flex-1 min-w-[200px]">URL / Path</div>
        <div className="w-14 text-center shrink-0">Status</div>
        <div className="w-24 shrink-0 hidden md:block">Type</div>
        <div className="w-16 text-right shrink-0">Time</div>
        <div className="w-16 text-right shrink-0 pr-2">Size</div>
        <div className="w-20 shrink-0 hidden lg:block">App</div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <span>No requests in sequence</span>
          </div>
        ) : (
          requests.map((req, idx) => {
            const isSelected = selectedRequestId === req.id;
            const isChecked = selectedIds.has(req.id);
            const methodColor = getMethodColor(req.method);
            const statusColor = getStatusColor(req.response?.statusCode);
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
                className={`flex items-center px-2 py-1.5 border-b border-gray-100 dark:border-gray-800/40 cursor-pointer font-mono text-[11px] transition-colors ${
                  isSelected
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
                    : isChecked
                    ? 'bg-black/5 dark:bg-white/5'
                    : idx % 2 === 0
                    ? 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    : 'bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {selectedIds.size > 0 && (
                  <div className="w-6 shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectId(req.id);
                      }}
                      className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Index # */}
                <div className="w-10 text-center text-gray-400 shrink-0">{idx + 1}</div>

                {/* Method */}
                <div className="w-16 shrink-0">
                  <span
                    className="px-1.5 py-0.2 rounded text-[9px] font-bold text-white uppercase text-center inline-block min-w-[36px]"
                    style={{ backgroundColor: methodColor }}
                  >
                    {req.method}
                  </span>
                </div>

                {/* URL */}
                <div className="flex-1 min-w-[200px] truncate" title={req.url}>
                  {req.url}
                  {(() => { const gql = detectGraphQLOp(req); return gql ? <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-pink-500/20 text-pink-600 dark:text-pink-400 font-bold">{gql}</span> : null; })()}
                </div>

                {/* Status */}
                <div
                  className="w-14 text-center font-bold shrink-0"
                  style={{ color: statusColor }}
                >
                  {req.response?.statusCode || '...'}
                </div>

                {/* Content-Type */}
                <div className="w-24 truncate text-gray-500 text-[10px] shrink-0 hidden md:block">
                  {contentType ? contentType.split(';')[0] : '-'}
                </div>

                {/* Duration */}
                <div className="w-16 text-right text-gray-500 shrink-0">
                  {formatDuration(req.response?.duration)}
                </div>

                {/* Size */}
                <div className="w-16 text-right text-gray-500 shrink-0 pr-2">
                  {formatSize(req.response?.bodySize)}
                </div>

                {/* App */}
                <div className="w-20 truncate text-gray-400 text-[10px] shrink-0 hidden lg:block">
                  {req.processName || req.process?.name || '-'}
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
