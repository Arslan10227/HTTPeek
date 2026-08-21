import React, { useState, useMemo } from 'react';
import {
  Download,
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
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { toast } from '../../store/useToastStore';
import { exportRequests, ExportFormat } from '../../utils/exportHelper';
import { Dialog, FormSection } from '../ui/Dialog';

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
      availableDomains.forEach((d) => set.add(d.domain));
    }
    return set;
  });

  const [domainFilter, setDomainFilter] = useState('');

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

  // Filter requests based on selected scope
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
    return list;
  }, [allRequests, selectedRequests, scope, selectedDomains]);

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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Advanced Traffic Export Manager"
      subtitle="Filter traffic by domains, select rows, and export into standard formats."
      icon={<Download className="w-5 h-5 text-blue-400" />}
      iconColor="#60a5fa"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            Matching: <span className="font-bold text-emerald-400">{filteredRequests.length}</span> reqs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || filteredRequests.length === 0}
              className="btn-primary"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : `Export .${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 text-xs">
        {/* 1. Scope Selection */}
        <FormSection title="1. Target Scope">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all ${
                scope === 'all'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ borderColor: scope === 'all' ? undefined : 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: 'var(--color-text)' }}>All Traffic</span>
                <Layers className="w-3.5 h-3.5 opacity-50" />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{allRequests.length} requests</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('domains')}
              className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all ${
                scope === 'domains'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ borderColor: scope === 'domains' ? undefined : 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: 'var(--color-text)' }}>Filter Domains</span>
                <Globe className="w-3.5 h-3.5 opacity-50" />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {selectedDomains.size} of {availableDomains.length} domains
              </span>
            </button>

            <button
              type="button"
              disabled={selectedRequests.length === 0}
              onClick={() => setScope('selected')}
              className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all disabled:opacity-40 ${
                scope === 'selected'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ borderColor: scope === 'selected' ? undefined : 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: 'var(--color-text)' }}>Selected Rows</span>
                <CheckCircle2 className="w-3.5 h-3.5 opacity-50" />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{selectedRequests.length} items</span>
            </button>
          </div>
        </FormSection>

        {/* Domain Checkbox Selector (Visible when scope is 'domains') */}
        {scope === 'domains' && (
          <div
            className="p-3.5 rounded-2xl border flex flex-col gap-2.5"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface-raised)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search domains..."
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="input-base pl-8 font-mono text-xs py-1"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={selectAllDomains}
                  className="btn-ghost py-1 px-2.5 text-[11px]"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllDomains}
                  className="btn-ghost py-1 px-2.5 text-[11px]"
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              className="max-h-40 overflow-y-auto divide-y rounded-xl border"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              {visibleDomains.length === 0 ? (
                <div className="p-4 text-center text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                  No matching domains found
                </div>
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
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400 shrink-0" />
                        )}
                        <span
                          className="font-mono text-xs truncate"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {domain}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'var(--color-surface-raised)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
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
        <FormSection title="2. Export Format">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { id: 'har', label: 'HTTP Archive (.har)', desc: 'Standard HAR 1.2 format for Charles, Fiddler, DevTools', icon: FileCode, color: '#3b82f6' },
              { id: 'json', label: 'Raw JSON (.json)', desc: 'Complete structured array of request & response objects', icon: FileJson, color: '#10b981' },
              { id: 'csv', label: 'Summary Table (.csv)', desc: 'Spreadsheet format with URL, status, sizes, timings', icon: FileSpreadsheet, color: '#f59e0b' },
              { id: 'sh', label: 'cURL Shell Script (.sh)', desc: 'Executable bash script to replay requests via cURL', icon: Terminal, color: '#8b5cf6' },
            ].map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = format === fmt.id;
              return (
                <div
                  key={fmt.id}
                  onClick={() => setFormat(fmt.id as any)}
                  className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{ borderColor: isSelected ? undefined : 'var(--color-border)' }}
                >
                  <div
                    className="p-2 rounded-xl text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: fmt.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--color-text)' }}>{fmt.label}</div>
                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{fmt.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>
      </div>
    </Dialog>
  );
};
