import React from 'react';
import { ProxyStatus } from '../../types';

interface StatusPillProps {
  status: ProxyStatus;
  compact?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, compact = false }) => {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
        status.running
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
      title={status.running ? `Proxy listening on port ${status.port}` : 'Proxy stopped'}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          status.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
      />
      {!compact && <span>{status.running ? 'Running' : 'Stopped'}</span>}
      {status.running && (
        <span className="font-mono text-[10px] opacity-80">:{status.port}</span>
      )}
    </div>
  );
};
