import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { formatHeaderValue, getHeaderArray } from '../../../lib/httpFormat';

interface RequestCardProps {
  headers: Record<string, string[]>;
  queryParams: { key: string; value: string }[];
  requestCookies: { key: string; value: string }[];
}

export const RequestCard: React.FC<RequestCardProps> = ({ headers, queryParams, requestCookies }) => {
  const [raw, setRaw] = useState(false);
  const [filter, setFilter] = useState('');

  const entries = Object.entries(headers).flatMap(([k, vals]) =>
    getHeaderArray(vals).map((v) => ({ key: k, value: v }))
  );
  const filtered = entries.filter(
    (e) => !filter || e.key.toLowerCase().includes(filter.toLowerCase()) || e.value.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <CollapsibleCard
      id="request"
      title="Request"
      subtitle={`${entries.length} headers`}
      actions={
        <button type="button" onClick={() => setRaw(!raw)} className="text-[10px] font-semibold text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer">
          {raw ? 'Table' : 'Raw'}
        </button>
      }
    >
      {queryParams.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Query Parameters</p>
          <div className="space-y-1">
            {queryParams.map((p) => (
              <div key={p.key} className="flex gap-2 font-mono text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100">
                <span className="text-emerald-700 font-semibold shrink-0">{p.key}</span>
                <span className="text-slate-600 break-all">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {requestCookies.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Cookies</p>
          <div className="space-y-1">
            {requestCookies.map((c) => (
              <div key={c.key} className="flex gap-2 font-mono text-[11px] bg-slate-50 p-1.5 rounded">
                <span className="text-amber-700 font-semibold">{c.key}</span>
                <span className="text-slate-600 truncate">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter headers..."
          className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>

      {raw ? (
        <pre className="font-mono text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg border overflow-x-auto select-all whitespace-pre-wrap">
          {Object.entries(headers).map(([k, vals]) =>
            getHeaderArray(vals).map((v) => `${k}: ${formatHeaderValue(v)}`).join('\n')
          ).join('\n')}
        </pre>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {filtered.map((e, i) => (
            <div key={`${e.key}-${i}`} className="flex gap-2 px-3 py-1.5 text-[11px] hover:bg-slate-50">
              <span className="font-semibold text-slate-700 shrink-0 min-w-[120px]">{e.key}</span>
              <span className="font-mono text-slate-600 break-all select-all">{e.value}</span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
};
