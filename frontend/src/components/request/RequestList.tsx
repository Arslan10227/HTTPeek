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
  const { requests, removeRequest, processFilter } = useProxyStore();
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

      // 0. Process filter (Phase 9-C: auto-filter by launched app's process name)
      if (processFilter) {
        const pn = String(req.process?.name || '').toLowerCase();
        if (!pn || !pn.includes(processFilter.toLowerCase())) return false;
      }

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

      // Advanced filters (Phase 9-A)

      // Protocol filter
      if (conditions.protocol) {
        const url = String(req.url || '').toLowerCase();
        const isWs = req.method === 'WS' || url.startsWith('ws://') || url.startsWith('wss://');
        const isSse = req.method === 'SSE';
        const isHttps = url.startsWith('https://') || (req.hostPort as any)?.ssl;
        const isHttp = url.startsWith('http://') || (!isHttps && !isWs && !isSse);
        const proto = conditions.protocol.toLowerCase();
        if (proto === 'http' && !isHttp) return false;
        if (proto === 'https' && !isHttps) return false;
        if (proto === 'ws' && !(isWs && !url.startsWith('wss://'))) return false;
        if (proto === 'wss' && !url.startsWith('wss://')) return false;
        if (proto === 'sse' && !isSse) return false;
      }

      // Duration range filter
      const durationMs = req.durationMs ?? req.duration ?? (req.response as any)?.durationMs;
      if (conditions.minDurationMs) {
        const min = parseInt(conditions.minDurationMs, 10);
        if (!isNaN(min) && (durationMs == null || durationMs < min)) return false;
      }
      if (conditions.maxDurationMs) {
        const max = parseInt(conditions.maxDurationMs, 10);
        if (!isNaN(max) && (durationMs == null || durationMs > max)) return false;
      }

      // Size range filter (response body size)
      const sizeBytes = (req.response as any)?.bodySize ?? (req.response?.bodyString?.length ?? 0);
      if (conditions.minSizeBytes) {
        const min = parseInt(conditions.minSizeBytes, 10);
        if (!isNaN(min) && sizeBytes < min) return false;
      }
      if (conditions.maxSizeBytes) {
        const max = parseInt(conditions.maxSizeBytes, 10);
        if (!isNaN(max) && sizeBytes > max) return false;
      }

      // Rule hits filter
      if (conditions.hasRuleHits) {
        const hasRules = req.appliedRules && Array.isArray(req.appliedRules) && req.appliedRules.length > 0;
        if (!hasRules) return false;
      }

      // Body regex filter — test against both request and response bodies
      if (conditions.bodyRegex) {
        let bodyMatch = false;
        try {
          const bodyRegex = new RegExp(conditions.bodyRegex, 'i');
          const reqBody = req.body || req.bodyString || '';
          const respBody = req.response?.body || req.response?.bodyString || '';
          if (typeof reqBody === 'string' && bodyRegex.test(reqBody)) bodyMatch = true;
          if (!bodyMatch && typeof respBody === 'string' && bodyRegex.test(respBody)) bodyMatch = true;
        } catch (_) {
          // Invalid regex — fall back to literal includes
          const reqBody = String(req.body || req.bodyString || '');
          const respBody = String(req.response?.body || req.response?.bodyString || '');
          if (reqBody.includes(conditions.bodyRegex) || respBody.includes(conditions.bodyRegex)) bodyMatch = true;
        }
        if (!bodyMatch) return false;
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
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Tab Header */}
      <div
        className="flex items-center justify-between px-4 h-10 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setActiveTab('domain')}
            className={`tab-item ${activeTab === 'domain' ? 'tab-item-active' : ''}`}
          >
            {t.domainList}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sequence')}
            className={`tab-item ${activeTab === 'sequence' ? 'tab-item-active' : ''}`}
          >
            {t.sequence}
          </button>
        </div>

        <div className="text-[11px] font-mono" style={{ color: 'var(--color-text-subtle)' }}>
          {filteredRequests.length}/{requests.length}
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
