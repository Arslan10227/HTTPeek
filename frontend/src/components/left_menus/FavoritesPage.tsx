import React, { useState } from 'react';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { NetworkTabController } from '../panel/NetworkTabController';
import { Heart, Trash2, Search, Globe, Clock, ArrowUpRight } from 'lucide-react';
import { useAppConfig } from '../../theme/useAppConfig';
import { matchStructuredQuery } from '../../utils/searchParser';

interface FavoritesPageProps {
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const { t } = useTranslation();
  const { favorites, toggleFavorite } = useProxyStore();
  const { panelRatio, getActiveColorPreset } = useAppConfig();
  const [selectedReq, setSelectedReq] = useState<HttpRequest | null>(
    favorites[0] || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const activeColor = getActiveColorPreset();

  const filtered = favorites.filter((f) => matchStructuredQuery(f, searchQuery));

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'badge-get';
      case 'POST': return 'badge-post';
      case 'PUT': return 'badge-put';
      case 'DELETE': return 'badge-delete';
      case 'PATCH': return 'badge-patch';
      default: return 'badge-options';
    }
  };

  const getStatusBadgeClass = (code?: number) => {
    if (!code) return 'badge-pending';
    if (code >= 200 && code < 300) return 'badge-2xx';
    if (code >= 300 && code < 400) return 'badge-3xx';
    if (code >= 400 && code < 500) return 'badge-4xx';
    return 'badge-5xx';
  };

  return (
    <div
      className="flex-1 flex overflow-hidden min-h-0 select-none font-sans"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Left List */}
      <div
        className="flex flex-col border-r overflow-hidden min-h-0"
        style={{
          width: `${panelRatio * 100}%`,
          minWidth: '280px',
          maxWidth: '80%',
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {/* Search */}
        <div
          className="p-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search favorites (e.g. status:200)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs font-mono bg-white/5 dark:bg-white/5 focus:bg-white/10 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400 text-xs text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                <Heart className="w-6 h-6" />
              </div>
              <span className="font-semibold text-slate-300">No favorite requests saved</span>
              <span className="text-[11px] text-slate-500 mt-1">Star any request from the traffic list to pin it here.</span>
            </div>
          ) : (
            filtered.map((req) => {
              const isSelected = selectedReq?.id === req.id;
              const host = req.hostPort?.host || new URL(req.url, 'http://localhost').hostname;

              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`flex flex-col p-2.5 rounded-xl cursor-pointer transition-all border group ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-xs'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 border-transparent text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`badge-method ${getMethodBadgeClass(req.method)}`}>
                        {req.method}
                      </span>
                      <span className="font-bold text-xs truncate text-slate-800 dark:text-slate-100" title={host}>
                        {host}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {req.response && (
                        <span className={`badge-status ${getStatusBadgeClass(req.response.statusCode)}`}>
                          {req.response.statusCode}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(req.id);
                          if (selectedReq?.id === req.id) {
                            setSelectedReq(null);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 cursor-pointer transition-opacity"
                        title="Remove from favorites"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="truncate flex-1 pr-2" title={req.path || req.url}>
                      {req.path || req.url}
                    </span>
                    {req.durationMs !== undefined && (
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {req.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Inspector */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <NetworkTabController
          request={selectedReq}
          onEditAndResend={onEditAndResend}
          onOpenRewriteRule={onOpenRewriteRule}
          onOpenMapLocal={onOpenMapLocal}
          onOpenBreakpoint={onOpenBreakpoint}
        />
      </div>
    </div>
  );
};
