import React, { useState } from 'react';
import {
  Download,
  X,
  FileCode,
  Globe,
  CheckCircle2,
  FileSpreadsheet,
  Terminal,
  Layers,
  FileJson
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { toast } from '../../store/useToastStore';

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
  const [scope, setScope] = useState<'all' | 'domain' | 'selected'>(
    selectedRequests.length > 0 ? 'selected' : 'all'
  );
  const [format, setFormat] = useState<'har' | 'json' | 'csv' | 'curl'>('har');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const targetRequests = useMemoRequests(scope, allRequests, selectedRequests, activeDomain);

  const handleExport = async () => {
    if (targetRequests.length === 0) {
      toast.warning('No requests match the selected export scope');
      return;
    }

    setExporting(true);
    try {
      let data = '';
      let mimeType = 'application/json';
      let extension = 'har';

      if (format === 'har') {
        if ((window as any).go?.main?.App?.ExportHAR) {
          data = await (window as any).go.main.App.ExportHAR(targetRequests);
        } else {
          // Client-side fallback
          data = JSON.stringify(targetRequests, null, 2);
        }
        mimeType = 'application/json';
        extension = 'har';
      } else if (format === 'json') {
        if ((window as any).go?.main?.App?.ExportRequestsAs) {
          data = await (window as any).go.main.App.ExportRequestsAs(targetRequests, 'json');
        } else {
          data = JSON.stringify(targetRequests, null, 2);
        }
        mimeType = 'application/json';
        extension = 'json';
      } else if (format === 'csv') {
        if ((window as any).go?.main?.App?.ExportRequestsAs) {
          data = await (window as any).go.main.App.ExportRequestsAs(targetRequests, 'csv');
        } else {
          data = generateClientCSV(targetRequests);
        }
        mimeType = 'text/csv';
        extension = 'csv';
      } else if (format === 'curl') {
        if ((window as any).go?.main?.App?.ExportRequestsAs) {
          data = await (window as any).go.main.App.ExportRequestsAs(targetRequests, 'curl');
        } else {
          data = generateClientCurlScript(targetRequests);
        }
        mimeType = 'text/x-sh';
        extension = 'sh';
      }

      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `httpeek_${scope}_${timestamp}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Export Successful', `Exported ${targetRequests.length} requests as .${extension}`);
      onClose();
    } catch (e: any) {
      toast.error('Export Failed', e.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none font-sans text-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Export Captured Traffic
              </h2>
              <p className="text-gray-500 text-xs">Choose target scope and export format</p>
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

        {/* 1. Scope Selection */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700 dark:text-gray-300">1. Select Export Scope:</label>
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
              disabled={!activeDomain}
              onClick={() => setScope('domain')}
              className={`p-3 rounded-2xl border flex flex-col gap-1 text-left cursor-pointer transition-all disabled:opacity-40 ${
                scope === 'domain'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-gray-50/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">Domain Only</span>
                <Globe className="w-3.5 h-3.5 opacity-50" />
              </div>
              <span className="text-[11px] text-gray-500 truncate">{activeDomain || 'None'}</span>
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
                <span className="font-bold">Selected</span>
                <CheckCircle2 className="w-3.5 h-3.5 opacity-50" />
              </div>
              <span className="text-[11px] text-gray-500">{selectedRequests.length} items</span>
            </button>
          </div>
        </div>

        {/* 2. Format Selection */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700 dark:text-gray-300">2. Select Export Format:</label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'har', label: 'HTTP Archive (.har)', desc: 'Standard HAR 1.2 format for Charles, Fiddler, DevTools', icon: FileCode, color: '#3b82f6' },
              { id: 'json', label: 'Raw JSON (.json)', desc: 'Complete structured array of request & response objects', icon: FileJson, color: '#10b981' },
              { id: 'csv', label: 'Summary Table (.csv)', desc: 'Spreadsheet format with URL, status, sizes, timings', icon: FileSpreadsheet, color: '#f59e0b' },
              { id: 'curl', label: 'cURL Shell Script (.sh)', desc: 'Executable bash script to replay requests via cURL', icon: Terminal, color: '#8b5cf6' },
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

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="font-mono text-gray-500 font-bold">
            Total to export: <span className="text-blue-600">{targetRequests.length}</span> requests
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
              disabled={exporting || targetRequests.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold cursor-pointer transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function useMemoRequests(scope: string, all: HttpRequest[], selected: HttpRequest[], domain?: string) {
  if (scope === 'selected') return selected;
  if (scope === 'domain' && domain) {
    return all.filter((r) => r.hostPort?.host === domain || (r.url && r.url.includes(domain)));
  }
  return all;
}

function generateClientCSV(requests: HttpRequest[]): string {
  const lines = ['ID,Method,URL,Status,Duration(ms),StartTime'];
  requests.forEach((r) => {
    lines.push(`"${r.id}","${r.method}","${r.url.replace(/"/g, '""')}",${r.response?.statusCode || 0},${r.durationMs || 0},"${r.startTime || ''}"`);
  });
  return lines.join('\n');
}

function generateClientCurlScript(requests: HttpRequest[]): string {
  const lines = ['#!/usr/bin/env bash\n'];
  requests.forEach((r) => {
    lines.push(`curl -X ${r.method} "${r.url}"`);
  });
  return lines.join('\n');
}
