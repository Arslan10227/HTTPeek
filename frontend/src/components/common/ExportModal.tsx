import React, { useState, useMemo } from 'react';
import {
  Download,
  X,
  FileCode,
  Globe,
  CheckCircle2,
  FileSpreadsheet,
  Terminal,
  Layers,
  FileJson,
  CheckSquare,
  Square,
  Search,
  Filter
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { toast } from '../../store/useToastStore';
import { exportRequests, ExportFormat } from '../../utils/exportHelper';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRequests: HttpRequest[];
  selectedRequests?: HttpRequest[];
  activeDomain?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  allRequests,
  selectedRequests = [],
  activeDomain,
}) => {
  const [scope, setScope] = useState<'all' | 'domains' | 'selected'>(
    activeDomain ? 'domains' : selectedRequests.length > 0 ? 'selected' : 'all'
  );
  const [format, setFormat] = useState<ExportFormat>('har');
  const [exporting, setExporting] = useState(false);

  // Compute unique domains from allRequests
  const availableDomains = useMemo(() => {
    const counts: Record<string, number> = {};
    allRequests.forEach((r) => {
      const d = r.hostPort?.host || 'unknown';
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [allRequests]);

  // Selected domains state for domain filtering
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (activeDomain) {
      set.add(activeDomain);
    } else {
      // Default select all available domains
      availableDomains.forEach((d) => set.add(d.domain));
    }
    return set;
  });

  const [domainFilter, setDomainFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (!isOpen) return null;

  const toggleDomain = (domain: string) => {
    const next = new Set(selectedDomains);
    if (next.has(domain)) {
      next.delete(domain);
    } else {
      next.add(domain);
    }
    setSelectedDomains(next);
  };

  const selectAllDomains = () => {
    const next = new Set<string>();
    availableDomains.forEach((d) => next.add(d.domain));
    setSelectedDomains(next);
  };

  const deselectAllDomains = () => {
    setSelectedDomains(new Set<string>());
  };

  // Filter requests based on selected scope and filters
  const filteredRequests = useMemo(() => {
    let list = allRequests;

    if (scope === 'selected') {
      list = selectedRequests;
    } else if (scope === 'domains') {
      list = allRequests.filter((r) => {
        const host = r.hostPort?.host || 'unknown';
        return selectedDomains.has(host);
      });
    }

    if (methodFilter !== 'all') {
      list = list.filter((r) => (r.method || 'GET').toUpperCase() === methodFilter);
    }

    if (statusFilter !== 'all') {
      list = list.filter((r) => {
        const code = r.response?.statusCode || 0;
        if (statusFilter === '2xx') return code >= 200 && code < 300;
        if (statusFilter === '3xx') return code >= 300 && code < 400;
        if (statusFilter === '4xx') return code >= 400 && code < 500;
        if (statusFilter === '5xx') return code >= 500 && code < 600;
        if (statusFilter === 'err') return code === 0 || code >= 400;
        return true;
      });
    }

    return list;
  }, [allRequests, selectedRequests, scope, selectedDomains, methodFilter, statusFilter]);

  const handleExport = async () => {
    if (filteredRequests.length === 0) {
      toast.warning('No requests match the selected export criteria');
      return;
    }

    setExporting(true);
    try {
      let baseName = 'httpeek_export';
      if (scope === 'domains' && selectedDomains.size === 1) {
        baseName = Array.from(selectedDomains)[0];
      }
      await exportRequests(filteredRequests, format, baseName);
      onClose();
    } catch (e: any) {
      toast.error('Export Failed', e.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  const visibleDomains = availableDomains.filter((d) =>
    d.domain.toLowerCase().includes(domainFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans text-xs p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Advanced Traffic Export Manager
              </h2>
              <p className="text-gray-500 text-xs">Filter by specific domains, methods, status and choose format</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {/* 1. Scope Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-gray-700 dark:text-gray-300">1. Target Scope:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-gray-50/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">All Traffic</span>
                  <Layers className="w-3.5 h-3.5 opacity-50" />
                </div>
                <span className="text-[11px] text-gray-500">{allRequests.length} requests</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('domains')}
                className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all ${
                  scope === 'domains'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-gray-50/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Filter Domains</span>
                  <Globe className="w-3.5 h-3.5 opacity-50" />
                </div>
                <span className="text-[11px] text-gray-500">
                  {selectedDomains.size} of {availableDomains.length} domains
                </span>
              </button>

              <button
                type="button"
                disabled={selectedRequests.length === 0}
                onClick={() => setScope('selected')}
                className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all disabled:opacity-40 ${
                  scope === 'selected'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-gray-50/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Selected Rows</span>
                  <CheckCircle2 className="w-3.5 h-3.5 opacity-50" />
                </div>
                <span className="text-[11px] text-gray-500">{selectedRequests.length} items</span>
              </button>
            </div>
          </div>

          {/* Domain Checkbox Selector (Visible when scope is 'domains') */}
          {scope === 'domains' && (
            <div className="p-3 rounded-2xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllDomains}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllDomains}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {visibleDomains.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">No matching domains found</div>
                ) : (
                  visibleDomains.map(({ domain, count }) => {
                    const isChecked = selectedDomains.has(domain);
                    return (
                      <div
                        key={domain}
                        onClick={() => toggleDomain(domain)}
                        className="flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <span className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate">
                            {domain}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          {count} reqs
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. Format Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-gray-700 dark:text-gray-300">2. Select Export Format:</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'har', label: 'HTTP Archive (.har)', desc: 'Standard HAR 1.2 format for Charles, Fiddler, DevTools', icon: FileCode, color: '#3b82f6' },
                { id: 'json', label: 'Raw JSON (.json)', desc: 'Complete structured array of request & response objects', icon: FileJson, color: '#10b981' },
                { id: 'csv', label: 'Summary Table (.csv)', desc: 'Spreadsheet format with URL, status, sizes, timings', icon: FileSpreadsheet, color: '#f59e0b' },
                { id: 'sh', label: 'cURL Shell Script (.sh)', desc: 'Executable bash script to replay requests via cURL', icon: Terminal, color: '#8b5cf6' },
              ].map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id as any)}
                    className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                      format === fmt.id
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-gray-50/20'
                    }`}
                  >
                    <div className="p-2 rounded-xl text-white shrink-0 shadow-2xs" style={{ backgroundColor: fmt.color }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">{fmt.label}</div>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{fmt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <span className="font-mono text-gray-600 dark:text-gray-400 font-bold">
            Total matching requests: <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{filteredRequests.length}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || filteredRequests.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : `Export .${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
