import React, { useState, useMemo } from 'react';
import { Columns, Eye, Copy, Check, ArrowRightLeft } from 'lucide-react';

interface DiffCardProps {
  originalText: string;
  modifiedText: string;
  originalLabel?: string;
  modifiedLabel?: string;
}

export const DiffCard: React.FC<DiffCardProps> = ({
  originalText = '',
  modifiedText = '',
  originalLabel = 'Original Payload',
  modifiedLabel = 'Tampered / Modified',
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState(false);

  const origLines = useMemo(() => originalText.split('\n'), [originalText]);
  const modLines = useMemo(() => modifiedText.split('\n'), [modifiedText]);

  const maxLines = Math.max(origLines.length, modLines.length);

  const diffRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < maxLines; i++) {
      const orig = origLines[i] ?? '';
      const mod = modLines[i] ?? '';
      const isDiff = orig !== mod;
      const isAdded = orig === '' && mod !== '';
      const isRemoved = orig !== '' && mod === '';
      rows.push({
        lineNum: i + 1,
        orig,
        mod,
        isDiff,
        isAdded,
        isRemoved,
      });
    }
    return rows;
  }, [origLines, modLines, maxLines]);

  const diffCount = useMemo(() => {
    return diffRows.filter((r) => r.isDiff).length;
  }, [diffRows]);

  return (
    <div className="flex flex-col h-full bg-[#080d16] text-gray-200 font-mono text-xs select-text border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-cyan-400">
            <ArrowRightLeft className="w-4 h-4" />
            <span>Payload Diff</span>
          </span>
          <span className="text-gray-500">|</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
            diffCount > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            {diffCount > 0 ? `${diffCount} Differences Detected` : 'Identical Payloads'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{viewMode === 'split' ? 'Unified View' : 'Split View'}</span>
          </button>
        </div>
      </div>

      {/* Split Header */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-2 bg-white/5 border-b border-white/10 font-sans font-semibold text-[11px] text-gray-400">
          <div className="px-4 py-1.5 border-r border-white/10 flex items-center justify-between text-rose-300">
            <span>{originalLabel}</span>
            <span className="text-gray-500 text-[10px]">{origLines.length} lines</span>
          </div>
          <div className="px-4 py-1.5 flex items-center justify-between text-emerald-300">
            <span>{modifiedLabel}</span>
            <span className="text-gray-500 text-[10px]">{modLines.length} lines</span>
          </div>
        </div>
      ) : null}

      {/* Diff Content Body */}
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed divide-y divide-white/5">
        {viewMode === 'split' ? (
          diffRows.map((row) => (
            <div
              key={row.lineNum}
              className={`grid grid-cols-2 ${
                row.isDiff ? 'bg-amber-500/10' : 'hover:bg-white/5'
              }`}
            >
              {/* Original Left Pane */}
              <div
                className={`flex px-3 py-0.5 border-r border-white/10 ${
                  row.isDiff && !row.isAdded ? 'bg-rose-500/15 text-rose-200 font-semibold' : 'text-gray-400'
                }`}
              >
                <span className="w-8 text-gray-600 select-none text-right pr-2">
                  {row.orig ? row.lineNum : ''}
                </span>
                <span className="whitespace-pre-wrap break-all flex-1">{row.orig}</span>
              </div>

              {/* Modified Right Pane */}
              <div
                className={`flex px-3 py-0.5 ${
                  row.isDiff && !row.isRemoved ? 'bg-emerald-500/15 text-emerald-200 font-semibold' : 'text-gray-300'
                }`}
              >
                <span className="w-8 text-gray-600 select-none text-right pr-2">
                  {row.mod ? row.lineNum : ''}
                </span>
                <span className="whitespace-pre-wrap break-all flex-1">{row.mod}</span>
              </div>
            </div>
          ))
        ) : (
          diffRows.map((row) => (
            <div key={row.lineNum} className="flex flex-col">
              {row.isDiff ? (
                <>
                  {row.orig && (
                    <div className="flex px-3 py-0.5 bg-rose-500/15 text-rose-200 font-semibold">
                      <span className="w-8 text-rose-400 select-none text-right pr-2">-</span>
                      <span className="whitespace-pre-wrap break-all flex-1">{row.orig}</span>
                    </div>
                  )}
                  {row.mod && (
                    <div className="flex px-3 py-0.5 bg-emerald-500/15 text-emerald-200 font-semibold">
                      <span className="w-8 text-emerald-400 select-none text-right pr-2">+</span>
                      <span className="whitespace-pre-wrap break-all flex-1">{row.mod}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex px-3 py-0.5 hover:bg-white/5 text-gray-400">
                  <span className="w-8 text-gray-600 select-none text-right pr-2">{row.lineNum}</span>
                  <span className="whitespace-pre-wrap break-all flex-1">{row.orig}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
