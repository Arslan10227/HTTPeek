import React, { useState, useMemo } from 'react';
import { DomainList } from './DomainList';
import { RequestSequence } from './RequestSequence';
import { SearchBar } from './SearchBar';
import { SelectionActionBar } from './SelectionActionBar';
import {
  SearchFilterConditions,
  defaultSearchConditions,
} from './SearchConditionDialog';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';
import { useAppConfig } from '../../theme/useAppConfig';

export type TrafficTab = 'domain' | 'sequence';

interface RequestListProps {
  selectedRequestId: string | null;
  onSelectRequest: (req: HttpRequest) => void;
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

export const RequestList: React.FC<RequestListProps> = ({
  selectedRequestId,
  onSelectRequest,
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const { t } = useTranslation();
  const { requests, removeRequest } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [activeTab, setActiveTab] = useState<TrafficTab>('domain');
  const [searchQuery, setSearchQuery] = useState('');
  const [conditions, setConditions] = useState<SearchFilterConditions>(defaultSearchConditions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activeColor = getActiveColorPreset();

  // Filter requests based on search query and search conditions
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!req) return false;

      // 1. Basic search query on URL
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const urlStr = String(req.url || '').toLowerCase();
        const methodStr = String(req.method || '').toLowerCase();
        const urlMatch = urlStr.includes(q);
        const methodMatch = methodStr.includes(q);
        if (!urlMatch && !methodMatch) return false;
      }

      // 2. Condition filters
      if (conditions.method && String(req.method || '').toUpperCase() !== conditions.method.toUpperCase()) {
        return false;
      }

      if (conditions.statusCode) {
        const code = String(req.response?.statusCode || '');
        if (conditions.statusCode.endsWith('xx')) {
          const prefix = conditions.statusCode[0];
          if (!code.startsWith(prefix)) return false;
        } else if (code !== conditions.statusCode) {
          return false;
        }
      }

      if (conditions.contentType) {
        const rawCt =
          req.response?.headers?.['content-type'] ||
          req.response?.headers?.['Content-Type'] ||
          '';
        const ct = (Array.isArray(rawCt) ? rawCt.join(' ') : String(rawCt || '')).toLowerCase();
        if (!ct.includes(conditions.contentType.toLowerCase())) return false;
      }

      if (conditions.keyword) {
        let match = false;
        const kw = conditions.caseSensitive
          ? conditions.keyword
          : conditions.keyword.toLowerCase();

        const testStr = (str?: any) => {
          if (str === undefined || str === null) return false;
          const s = typeof str === 'string' ? str : String(str);
          const target = conditions.caseSensitive ? s : s.toLowerCase();
          if (conditions.isRegex) {
            try {
              const regex = new RegExp(conditions.keyword, conditions.caseSensitive ? '' : 'i');
              return regex.test(s);
            } catch (_) {
              return target.includes(kw);
            }
          }
          return target.includes(kw);
        };

        if (testStr(req.url)) match = true;
        if (!match && conditions.searchRequestHeader && req.headers) {
          if (testStr(JSON.stringify(req.headers))) match = true;
        }
        if (!match && conditions.searchRequestBody && (req.body || req.bodyString)) {
          if (testStr(req.body || req.bodyString)) match = true;
        }
        if (!match && conditions.searchResponseHeader && req.response?.headers) {
          if (testStr(JSON.stringify(req.response.headers))) match = true;
        }
        if (!match && conditions.searchResponseBody && (req.response?.body || req.response?.bodyString)) {
          if (testStr(req.response.body || req.response.bodyString)) match = true;
        }

        if (!match) return false;
      }

      return true;
    });
  }, [requests, searchQuery, conditions]);

  const handleToggleSelectId = (id: string, shiftKey?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRepeatSelected = async () => {
    for (const id of selectedIds) {
      try {
        if (api.repeatRequest) await api.repeatRequest(id);
      } catch (_) {}
    }
    toast.success(t.success, `Replaying ${selectedIds.size} requests`);
    setSelectedIds(new Set());
  };

  const handleExportSelected = async () => {
    try {
      if ((window as any).go?.main?.App?.ExportSelectedHAR) {
        await (window as any).go.main.App.ExportSelectedHAR(Array.from(selectedIds));
        toast.success(t.exportSuccess, 'HAR exported');
      } else {
        toast.info('Export HAR available in desktop client');
      }
    } catch (e: any) {
      toast.error(t.exportFailed, e?.message);
    }
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => removeRequest(id));
    toast.info(t.deleteSuccess);
    setSelectedIds(new Set());
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0 select-none border-r"
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Tab Header (Domain List vs Sequence) */}
      <div
        className="flex items-center justify-between px-3 h-[38px] border-b shrink-0"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('domain')}
            className={`py-2 px-1 cursor-pointer transition-colors relative ${
              activeTab === 'domain' ? 'md3-tab-active' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t.domainList}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sequence')}
            className={`py-2 px-1 cursor-pointer transition-colors relative ${
              activeTab === 'sequence' ? 'md3-tab-active' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t.sequence}
          </button>
        </div>

        <div className="text-[11px] text-gray-400 font-mono">
          {filteredRequests.length} / {requests.length}
        </div>
      </div>

      {/* Multi-selection Action Bar */}
      <SelectionActionBar
        selectedCount={selectedIds.size}
        onRepeat={handleRepeatSelected}
        onExport={handleExportSelected}
        onDelete={handleDeleteSelected}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Main List Container */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {activeTab === 'domain' ? (
          <DomainList
            requests={filteredRequests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={onSelectRequest}
            selectedIds={selectedIds}
            onToggleSelectId={handleToggleSelectId}
            onEditAndResend={onEditAndResend}
            onOpenRewriteRule={onOpenRewriteRule}
            onOpenMapLocal={onOpenMapLocal}
            onOpenBreakpoint={onOpenBreakpoint}
          />
        ) : (
          <RequestSequence
            requests={filteredRequests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={onSelectRequest}
            selectedIds={selectedIds}
            onToggleSelectId={handleToggleSelectId}
            onEditAndResend={onEditAndResend}
            onOpenRewriteRule={onOpenRewriteRule}
            onOpenMapLocal={onOpenMapLocal}
            onOpenBreakpoint={onOpenBreakpoint}
          />
        )}
      </div>

      {/* Search Bar at bottom */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        conditions={conditions}
        onConditionsChange={setConditions}
      />
    </div>
  );
};
