import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pause, Play, Trash2, Upload, Download, Star, List, FolderTree } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useUiStore } from '../../store/useUiStore';
import { ExchangeRow } from '../ui/ExchangeRow';
import { MobileRequestCard } from '../request-list/MobileRequestCard';
import { DomainTreeView } from '../request-list/DomainTreeView';
import { ContextMenu } from '../common/ContextMenu';
import { RepeatModal } from '../repeat/RepeatModal';
import { RequestComposerModal } from '../composer/RequestComposerModal';
import { QuickRuleDialog } from '../rules/QuickRuleDialog';
import { HttpRequest } from '../../types';
import { toast } from '../../store/useToastStore';
import { spacing } from '../../design/tokens';
import { PaneHeader } from '../ui/PaneHeader';
import { exportRequests, importHarOrJsonFile, ExportFormat } from '../../utils/exportHelper';
import { ExportModal } from '../common/ExportModal';

export const ExchangeListPane: React.FC = () => {
  const {
    selectedRequestId,
    selectRequest,
    toggleFavorite,
    deleteRequest,
    searchQuery,
    setSearchQuery,
    clearRequests,
    capturePaused,
    setCapturePaused,
    showFavoritesOnly,
    setShowFavoritesOnly,
    getFilteredRequests,
    selectNext,
    selectPrev,
    requests,
  } = useProxyStore();
  const { viewListMode, setViewListMode, isMobile } = useUiStore();

  const parentRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => getFilteredRequests(), [getFilteredRequests, requests, searchQuery, showFavoritesOnly]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => spacing.rowHeight,
    overscan: 12,
  });

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; request: HttpRequest } | null>(null);
  const [repeatReq, setRepeatReq] = useState<HttpRequest | null>(null);
  const [composerReq, setComposerReq] = useState<HttpRequest | null>(null);
  const [quickRule, setQuickRule] = useState<{ isOpen: boolean; type: 'rewrite' | 'mock' | 'breakpoint' | 'script'; request: HttpRequest | null }>({ isOpen: false, type: 'rewrite', request: null });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); selectNext(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); selectPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectNext, selectPrev]);

  const handleImportHar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.har,application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if ((window as any).go?.main?.App?.ImportHAR) {
          await (window as any).go.main.App.ImportHAR(await file.text(), file.name.replace(/\.har$/i, ''));
          toast.success('HAR imported');
        }
      } catch (err: any) {
        toast.error('Import failed', err.message);
      }
    };
    input.click();
  };

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportAll = (format: ExportFormat) => {
    const all = useProxyStore.getState().requests;
    if (!all.length) return toast.warning('No traffic to export');
    exportRequests(all, format, 'httpeek_all_traffic');
    setIsExportMenuOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--htk-panel)] border-r border-[var(--htk-panel-border)]">
      <PaneHeader title="Exchanges">
        <button
          type="button"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`htk-chip ${showFavoritesOnly ? 'htk-chip-active' : ''}`}
        >
          <Star className="w-3 h-3" /> Favorites
        </button>

        {/* Import HAR / JSON */}
        <button
          type="button"
          onClick={() => importHarOrJsonFile()}
          className="htk-chip hover:border-emerald-400 cursor-pointer flex items-center gap-1"
          title="Import .HAR or .JSON session"
        >
          <Upload className="w-3 h-3 text-emerald-500" />
          <span>Import</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="htk-chip hover:border-blue-400 cursor-pointer flex items-center gap-1"
            title="Export traffic in multiple formats"
          >
            <Download className="w-3 h-3 text-blue-500" />
            <span>Export</span>
          </button>

          {isExportMenuOpen && (
            <div
              className="absolute right-0 top-7 z-50 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl p-1 text-[11px] font-sans flex flex-col gap-0.5"
              onClick={() => setIsExportMenuOpen(false)}
            >
              <span className="px-2 py-1 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                Export Format
              </span>
              <button
                type="button"
                onClick={() => handleExportAll('har')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>Export as .HAR</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportAll('json')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Export as .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportAll('csv')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export as .CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportAll('sh')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-purple-500" />
                <span>Export as .SH Script</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-0.5" />
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(true);
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 text-left font-bold cursor-pointer"
              >
                <span>Advanced Export Dialog...</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex rounded p-0.5" style={{ background: 'var(--htk-surface)' }}>
          <button type="button" onClick={() => setViewListMode('list')} className={`htk-btn-icon ${viewListMode === 'list' ? 'htk-chip-active' : ''}`}><List className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setViewListMode('tree')} className={`htk-btn-icon ${viewListMode === 'tree' ? 'htk-chip-active' : ''}`}><FolderTree className="w-3.5 h-3.5" /></button>
        </div>
      </PaneHeader>

      {viewListMode === 'tree' ? (
        <div className="flex-1 overflow-hidden"><DomainTreeView /></div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="htk-empty h-full">
              <p className="htk-empty-title">No exchanges yet</p>
              <p>Start the proxy and generate traffic, or adjust your filter.</p>
            </div>
          ) : isMobile ? (
            filtered.map((req) => (
              <MobileRequestCard
                key={req.id}
                request={req}
                isSelected={selectedRequestId === req.id}
                onSelect={() => selectRequest(req.id)}
                onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(req.id); }}
              />
            ))
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const req = filtered[vRow.index];
                return (
                  <div key={req.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}>
                    <ExchangeRow
                      request={req}
                      isSelected={selectedRequestId === req.id}
                      onSelect={() => selectRequest(req.id)}
                      onToggleFavorite={() => toggleFavorite(req.id)}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, request: req }); }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="htk-list-footer space-y-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter: status:200 method:GET domain:api.*"
        />
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-mono" style={{ color: 'var(--htk-text-muted)' }}>{filtered.length} exchanges</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setCapturePaused(!capturePaused)} title={capturePaused ? 'Resume' : 'Pause'} className="htk-btn-icon">
              {capturePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={clearRequests} className="htk-btn-icon"><Trash2 className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={handleImportHar} className="htk-btn-icon"><Upload className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setIsExportModalOpen(true)} title="Export Traffic" className="htk-btn-icon"><Download className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          request={contextMenu.request}
          onClose={() => setContextMenu(null)}
          onReplay={() => {}}
          onRepeatModal={() => setRepeatReq(contextMenu.request)}
          onCompose={() => setComposerReq(contextMenu.request)}
          onToggleFavorite={() => toggleFavorite(contextMenu.request.id)}
          onCreateRule={(type) => setQuickRule({ isOpen: true, type, request: contextMenu.request })}
          onDelete={() => deleteRequest(contextMenu.request.id)}
        />
      )}
      {repeatReq && <RepeatModal isOpen request={repeatReq} onClose={() => setRepeatReq(null)} />}
      {composerReq && <RequestComposerModal isOpen onClose={() => setComposerReq(null)} initialRequest={composerReq} />}
      {quickRule.isOpen && quickRule.request && (
        <QuickRuleDialog isOpen type={quickRule.type} request={quickRule.request} onClose={() => setQuickRule({ ...quickRule, isOpen: false })} />
      )}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          allRequests={requests}
        />
      )}
    </div>
  );
};
