import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star, Zap, Trash2, Sliders, Play, RotateCw, Edit3, Bookmark } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { HttpRequest } from '../../types';
import { ContextMenu } from '../common/ContextMenu';
import { RepeatModal } from '../repeat/RepeatModal';
import { RequestComposerModal } from '../composer/RequestComposerModal';
import { QuickRuleDialog } from '../rules/QuickRuleDialog';
import { LottiePlayer } from '../common/LottiePlayer';
import { MobileRequestCard } from './MobileRequestCard';

export const SequenceTableView: React.FC = () => {
  const { 
    requests, 
    favorites,
    selectedRequestId, 
    selectRequest, 
    toggleFavorite, 
    deleteRequest, 
    searchQuery,
    activeTab,
    setActiveTab
  } = useProxyStore();
  
  const parentRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    request: HttpRequest;
  } | null>(null);

  // Modals state
  const [repeatReq, setRepeatReq] = useState<HttpRequest | null>(null);
  const [composerReq, setComposerReq] = useState<HttpRequest | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Quick Rule Dialog state
  const [quickRuleModal, setQuickRuleModal] = useState<{
    isOpen: boolean;
    type: 'rewrite' | 'mock' | 'breakpoint' | 'script';
    request: HttpRequest | null;
  }>({
    isOpen: false,
    type: 'rewrite',
    request: null,
  });

  // Apply tab source (favorites vs capture) and search query
  const filteredRequests = useMemo(() => {
    const sourceList = activeTab === 'favorites' ? favorites : requests;
    return sourceList.filter((r) => {
      // Search query filter
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (q.startsWith('status:')) {
        const code = q.replace('status:', '').trim();
        return r.response?.statusCode.toString().startsWith(code);
      }
      if (q.startsWith('method:')) {
        const m = q.replace('method:', '').trim().toUpperCase();
        return r.method === m;
      }
      return (
        r.url.toLowerCase().includes(q) ||
        (r.path || '').toLowerCase().includes(q) ||
        (r.hostPort?.host || '').toLowerCase().includes(q) ||
        (r.process?.name && r.process.name.toLowerCase().includes(q))
      );
    });
  }, [requests, favorites, activeTab, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 84 : 36),
    overscan: 10,
  });

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-50 text-blue-700 border-blue-200',
      POST: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PUT: 'bg-amber-50 text-amber-700 border-amber-200',
      DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
      PATCH: 'bg-purple-50 text-purple-700 border-purple-200',
      OPTIONS: 'bg-slate-50 text-slate-700 border-slate-200',
      HEAD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      CONNECT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${colors[method?.toUpperCase()] || colors.GET}`}>
        {method}
      </span>
    );
  };

  const getStatusBadge = (code?: number) => {
    if (!code) return <span className="text-slate-400">...</span>;
    let color = 'text-slate-600 bg-slate-100 border-slate-200';
    if (code >= 200 && code < 300) color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (code >= 300 && code < 400) color = 'text-sky-700 bg-sky-50 border-sky-200';
    if (code >= 400 && code < 500) color = 'text-amber-700 bg-amber-50 border-amber-200';
    if (code >= 500) color = 'text-rose-700 bg-rose-50 border-rose-200';

    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${color}`}>
        {code}
      </span>
    );
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleContextMenu = (e: React.MouseEvent | null, req: HttpRequest) => {
    if (e) e.preventDefault();
    setContextMenu({
      x: e ? e.clientX : window.innerWidth / 2,
      y: e ? e.clientY : window.innerHeight / 2,
      request: req,
    });
  };

  const menuItems = contextMenu ? [
    {
      label: 'Copy URL',
      icon: <Bookmark className="w-3.5 h-3.5" />,
      onClick: () => navigator.clipboard.writeText(contextMenu.request.url),
    },
    {
      label: 'Copy as cURL',
      icon: <Bookmark className="w-3.5 h-3.5" />,
      onClick: () => {
        let curl = `curl -X ${contextMenu.request.method} '${contextMenu.request.url}'`;
        if (contextMenu.request.headers) {
          Object.entries(contextMenu.request.headers).forEach(([k, rawVals]) => {
            const list = Array.isArray(rawVals) ? rawVals : [String(rawVals)];
            list.forEach((v: string) => {
              curl += ` \\\n  -H '${k}: ${v}'`;
            });
          });
        }
        if (contextMenu.request.bodyString || contextMenu.request.body) {
          curl += ` \\\n  --data-raw '${contextMenu.request.bodyString || contextMenu.request.body}'`;
        }
        navigator.clipboard.writeText(curl);
      },
    },
    {
      label: contextMenu.request.isFavorite ? 'Remove Favorite' : 'Add to Favorites',
      icon: <Star className={`w-3.5 h-3.5 ${contextMenu.request.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />,
      onClick: () => toggleFavorite(contextMenu.request.id),
    },
    {
      label: 'Repeat / Stress Test',
      icon: <RotateCw className="w-3.5 h-3.5 text-sky-600" />,
      onClick: () => setRepeatReq(contextMenu.request),
    },
    {
      label: 'Edit & Resend (Composer)',
      icon: <Edit3 className="w-3.5 h-3.5 text-emerald-600" />,
      onClick: () => {
        setComposerReq(contextMenu.request);
        setIsComposerOpen(true);
      },
    },
    {
      label: 'Create Mock Rule',
      icon: <Zap className="w-3.5 h-3.5 text-purple-600" />,
      onClick: () => setQuickRuleModal({ isOpen: true, type: 'mock', request: contextMenu.request }),
    },
    {
      label: 'Delete Request',
      icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
      danger: true,
      onClick: () => deleteRequest(contextMenu.request.id),
    },
  ] : [];

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-sans">
      {/* Desktop Table Header */}
      {!isMobile && (
        <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-3 text-[11px] font-semibold text-slate-500 shrink-0">
          <div className="w-8 text-center">#</div>
          <div className="w-16">Method</div>
          <div className="w-14">Status</div>
          <div className="w-48">Host</div>
          <div className="flex-1 min-w-[200px]">Path & Query</div>
          <div className="w-20 text-right">Size</div>
          <div className="w-20 text-right">Duration</div>
          <div className="w-28 pl-4">Process</div>
          <div className="w-8 text-center">Fav</div>
        </div>
      )}

      {/* List Container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto relative divide-y divide-slate-100">
        {filteredRequests.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 select-none">
            {activeTab === 'favorites' ? (
              <>
                <LottiePlayer type="empty" width={90} height={90} className="mb-1" />
                <p className="text-sm font-bold text-slate-700">No Favorites Pinned</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                  Click the star icon or right-click any network request to pin it to your favorites.
                </p>
              </>
            ) : (
              <>
                <LottiePlayer type="radar" width={100} height={100} className="mb-1" />
                <p className="text-sm font-bold text-slate-700">Listening for Network Traffic...</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                  Start the proxy server and make requests to inspect HTTP, HTTPS, WebSocket, and SSE traffic in real-time.
                </p>
              </>
            )}
          </div>
        ) : isMobile ? (
          // Mobile Card View
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((req) => (
              <MobileRequestCard
                key={req.id}
                request={req}
                isSelected={selectedRequestId === req.id}
                onSelect={() => selectRequest(req.id)}
                onToggleFavorite={(e) => {
                  e.stopPropagation();
                  toggleFavorite(req.id);
                }}
                onLongPress={() => handleContextMenu(null, req)}
              />
            ))}
          </div>
        ) : (
          // Desktop Virtualized Table
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const req = filteredRequests[virtualRow.index];
              const isSelected = selectedRequestId === req.id;

              return (
                <div
                  key={req.id}
                  onClick={() => selectRequest(req.id)}
                  onContextMenu={(e) => handleContextMenu(e, req)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`flex items-center px-3 border-b border-slate-100 cursor-pointer transition-colors text-[11px] select-none ${
                    isSelected
                      ? 'bg-emerald-50/80 text-slate-900 border-l-3 border-l-emerald-600'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="w-8 text-center text-slate-400 text-[10px]">
                    {virtualRow.index + 1}
                  </div>
                  <div className="w-16">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getMethodBadge(req.method)}`}>
                      {req.method}
                    </span>
                  </div>
                  <div className="w-14">
                    {getStatusBadge(req.response?.statusCode)}
                  </div>
                  <div className="w-48 truncate text-slate-800 font-medium" title={req.hostPort?.host || 'unknown'}>
                    {req.hostPort?.host || 'unknown'}
                  </div>
                  <div className="flex-1 min-w-[200px] truncate text-slate-600 font-mono" title={req.path}>
                    {req.path || req.url || '/'}
                  </div>
                  <div className="w-20 text-right font-mono text-slate-500 text-[10px]">
                    {formatSize(req.response?.bodySize)}
                  </div>
                  <div className="w-20 text-right font-mono text-slate-500 text-[10px]">
                    {req.durationMs ? `${req.durationMs}ms` : '...'}
                  </div>
                  <div className="w-28 pl-4 truncate text-slate-500 text-[10px]">
                    {req.process?.name || '-'}
                  </div>
                  <div className="w-8 text-center" onClick={(e) => { e.stopPropagation(); toggleFavorite(req.id); }}>
                    <Star className={`w-3.5 h-3.5 mx-auto ${req.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          request={contextMenu.request}
          onClose={() => setContextMenu(null)}
          onReplay={async (r) => {
            if ((window as any).go?.main?.App?.ReplayRequest) {
              await (window as any).go.main.App.ReplayRequest(r);
            }
          }}
          onRepeatModal={(r) => setRepeatReq(r)}
          onCompose={(r) => {
            setComposerReq(r);
            setIsComposerOpen(true);
          }}
          onToggleFavorite={(id) => toggleFavorite(id)}
          onCreateRule={(type, r) => setQuickRuleModal({ isOpen: true, type, request: r })}
          onDelete={(id) => deleteRequest(id)}
        />
      )}

      {/* Modals */}
      {repeatReq && (
        <RepeatModal
          request={repeatReq}
          isOpen={true}
          onClose={() => setRepeatReq(null)}
        />
      )}

      {isComposerOpen && (
        <RequestComposerModal
          isOpen={isComposerOpen}
          initialRequest={composerReq}
          onClose={() => {
            setIsComposerOpen(false);
            setComposerReq(null);
          }}
        />
      )}

      {quickRuleModal.isOpen && (
        <QuickRuleDialog
          isOpen={quickRuleModal.isOpen}
          type={quickRuleModal.type}
          request={quickRuleModal.request}
          onClose={() => setQuickRuleModal({ isOpen: false, type: 'rewrite', request: null })}
        />
      )}
    </div>
  );
};
