import React, { useState } from 'react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { StatusBadge } from '../../ui/StatusBadge';
import { formatHeaderValue, getHeaderArray } from '../../../lib/httpFormat';

interface ResponseCardProps {
  statusCode?: number;
  statusText?: string;
  protocol?: string;
  headers: Record<string, string[]>;
  responseCookies: { name: string; value: string; raw: string }[];
}

export const ResponseCard: React.FC<ResponseCardProps> = ({
  statusCode,
  statusText,
  protocol,
  headers,
  responseCookies,
}) => {
  const [raw, setRaw] = useState(false);
  if (!statusCode) return null;

  const entries = Object.entries(headers).flatMap(([k, vals]) =>
    getHeaderArray(vals).map((v) => ({ key: k, value: v }))
  );

  return (
    <CollapsibleCard
      id="response"
      title="Response"
      subtitle={`${statusCode} ${statusText || ''}`}
      actions={
        <button type="button" onClick={() => setRaw(!raw)} className="text-[10px] font-semibold text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer">
          {raw ? 'Table' : 'Raw'}
        </button>
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge code={statusCode} statusText={statusText} />
        {protocol && <span className="text-[10px] text-slate-500 font-mono">{protocol}</span>}
      </div>

      {responseCookies.length > 0 && (
        <div className="mb-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Set-Cookie</p>
          {responseCookies.map((c) => (
            <div key={c.name} className="font-mono text-[10px] bg-amber-50 p-2 rounded border border-amber-100 break-all select-all">{c.raw}</div>
          ))}
        </div>
      )}

      {raw ? (
        <pre className="font-mono text-[11px] bg-slate-50 p-3 rounded-lg border overflow-x-auto select-all whitespace-pre-wrap">
          {entries.map((e) => `${e.key}: ${formatHeaderValue(e.value)}`).join('\n')}
        </pre>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          {entries.map((e, i) => (
            <div key={`${e.key}-${i}`} className="flex gap-2 px-3 py-1.5 text-[11px]">
              <span className="font-semibold text-slate-700 shrink-0 min-w-[120px]">{e.key}</span>
              <span className="font-mono text-slate-600 break-all select-all">{e.value}</span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
};
