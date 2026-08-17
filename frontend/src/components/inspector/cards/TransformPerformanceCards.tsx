import React from 'react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { AppliedRule, ExchangeTimings } from '../../../types';

interface TransformCardProps {
  appliedRules?: AppliedRule[];
}

export const TransformCard: React.FC<TransformCardProps> = ({ appliedRules }) => {
  if (!appliedRules?.length) return null;
  return (
    <CollapsibleCard id="transform" title="Transform / Rules Applied" defaultOpen>
      <div className="space-y-2">
        {appliedRules.map((r) => (
          <div key={r.id} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px]">
            <span className="font-bold text-amber-800 uppercase shrink-0">{r.type}</span>
            <span className="text-slate-700">{r.summary}</span>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};

interface PerformanceCardProps {
  timings?: ExchangeTimings;
  durationMs?: number;
}

export const PerformanceCard: React.FC<PerformanceCardProps> = ({ timings, durationMs }) => {
  const total = timings?.total ?? durationMs;
  if (total == null && !timings) return null;

  const rows = [
    { label: 'DNS', ms: timings?.dns },
    { label: 'Connect', ms: timings?.connect },
    { label: 'TLS', ms: timings?.tls },
    { label: 'TTFB', ms: timings?.ttfb },
    { label: 'Total', ms: total },
  ].filter((r) => r.ms != null);

  return (
    <CollapsibleCard id="performance" title="Performance" subtitle={total != null ? `${total}ms` : undefined} defaultOpen={false}>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 text-slate-500 font-semibold">{r.label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, ((r.ms || 0) / (total || 1)) * 100)}%` }}
              />
            </div>
            <span className="w-14 text-right font-mono text-slate-700">{r.ms}ms</span>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};
