import React, { useState } from 'react';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { NetworkTabController } from '../panel/NetworkTabController';
import { Heart, Trash2, Search } from 'lucide-react';
import { useAppConfig } from '../../theme/useAppConfig';

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
  const { panelRatio } = useAppConfig();
  const [selectedReq, setSelectedReq] = useState<HttpRequest | null>(
    favorites[0] || null
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = favorites.filter((f) =>
    f.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 select-none">
      {/* Left List */}
      <div
        className="flex flex-col border-r overflow-hidden min-h-0"
        style={{
          width: `${panelRatio * 100}%`,
          minWidth: '240px',
          maxWidth: '80%',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        {/* Search */}
        <div
          className="p-2 border-b shrink-0"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search favorites..."
              className="w-full pl-8 pr-3 py-1 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
              <Heart className="w-8 h-8 opacity-30 mb-2" />
              <span>No favorite requests saved</span>
            </div>
          ) : (
            filtered.map((req) => {
              const isSelected = selectedReq?.id === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-mono group ${
                    isSelected
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[10px] text-blue-500 uppercase">
                        {req.method}
                      </span>
                      <span className="truncate text-[11px]" title={req.url}>
                        {req.url}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(req.id);
                      if (selectedReq?.id === req.id) {
                        setSelectedReq(null);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                    title="Remove from favorites"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Inspector */}
      <NetworkTabController
        request={selectedReq}
        onEditAndResend={onEditAndResend}
        onOpenRewriteRule={onOpenRewriteRule}
        onOpenMapLocal={onOpenMapLocal}
        onOpenBreakpoint={onOpenBreakpoint}
      />
    </div>
  );
};
