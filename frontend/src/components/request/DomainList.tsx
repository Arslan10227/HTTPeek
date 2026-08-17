import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Lock,
  FileText,
  CheckSquare,
  Square,
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { useAppConfig } from '../../theme/useAppConfig';
import { RequestContextMenu, ContextMenuPosition } from './RequestContextMenu';

interface DomainListProps {
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
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '';
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

export const DomainList: React.FC<DomainListProps> = ({
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
  const { getActiveColorPreset } = useAppConfig();
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    request: HttpRequest;
    position: ContextMenuPosition;
  } | null>(null);
  const activeColor = getActiveColorPreset();

  // Group requests by domain
  const domainGroups = useMemo(() => {
    const map = new Map<string, HttpRequest[]>();
    requests.forEach((req) => {
      let domain = 'unknown';
      if (req.hostPort?.host) {
        domain = req.hostPort.host;
      } else if (req.url) {
        try {
          const urlObj = new URL(req.url.startsWith('http') ? req.url : `http://${req.url}`);
          domain = urlObj.host || urlObj.hostname || 'unknown';
        } catch (_) {
          const urlStr = typeof req.url === 'string' ? req.url : String(req.url);
          domain = urlStr.split('/')[2] || urlStr.split('/')[0] || 'unknown';
        }
      }
      if (!map.has(domain)) {
        map.set(domain, []);
      }
      map.get(domain)!.push(req);
    });
    return Array.from(map.entries());
  }, [requests]);

  const toggleDomain = (domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, req: HttpRequest) => {
    e.preventDefault();
    setContextMenu({
      request: req,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden text-xs select-none p-1">
      {domainGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
          <Globe className="w-8 h-8 opacity-40 mb-2" />
          <span>No requests captured yet</span>
        </div>
      ) : (
        domainGroups.map(([domain, reqs]) => {
          const isCollapsed = collapsedDomains.has(domain);
          const isHttps = reqs.some((r) => r.url.startsWith('https://'));

          return (
            <div key={domain} className="flex flex-col mb-1">
              {/* Domain Header */}
              <div
                onClick={() => toggleDomain(domain)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-gray-800 dark:text-gray-200"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                )}
                {isHttps ? (
                  <Lock className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
                <span className="font-mono font-semibold truncate flex-1">{domain}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-mono">
                  {reqs.length}
                </span>
              </div>

              {/* Child Requests */}
              {!isCollapsed && (
                <div className="flex flex-col pl-4 border-l border-gray-100 dark:border-gray-800 ml-3 mt-0.5 gap-0.5">
                  {reqs.map((req) => {
                    const isSelected = selectedRequestId === req.id;
                    const isChecked = selectedIds.has(req.id);
                    const methodColor = getMethodColor(req.method);
                    const statusColor = getStatusColor(req.response?.statusCode);
                    const gqlOp = detectGraphQLOp(req);

                    let path = '/';
                    try {
                      const urlObj = new URL(req.url);
                      path = urlObj.pathname + urlObj.search;
                    } catch (_) {
                      path = req.url;
                    }

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
                        className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors group ${
                          isSelected
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
                            : isChecked
                            ? 'bg-black/5 dark:bg-white/5'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {selectedIds.size > 0 && (
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
                        )}

                        {/* Method badge */}
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-bold text-white uppercase shrink-0 min-w-[38px] text-center"
                          style={{ backgroundColor: methodColor }}
                        >
                          {req.method}
                        </span>

                        {/* URL Path + GraphQL Badge */}
                        <div className="font-mono text-[11px] truncate flex-1 flex items-center gap-1" title={req.url}>
                          <span className="truncate">{path}</span>
                          {gqlOp && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-pink-500/20 text-pink-600 dark:text-pink-400 font-bold shrink-0">
                              {gqlOp}
                            </span>
                          )}
                        </div>

                        {/* Status Code */}
                        {req.response?.statusCode ? (
                          <span
                            className="font-mono font-semibold text-[11px] shrink-0"
                            style={{ color: statusColor }}
                          >
                            {req.response.statusCode}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px] italic shrink-0">...</span>
                        )}

                        {/* Duration & Size */}
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono shrink-0">
                          {req.response?.duration && (
                            <span>{formatDuration(req.response.duration)}</span>
                          )}
                          {req.response?.bodySize && (
                            <span>{formatSize(req.response.bodySize)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

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
