import React from 'react';
import { Copy, Check, ShieldCheck } from 'lucide-react';
import { HttpRequest } from '../../../types';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { MethodBadge } from '../../ui/MethodBadge';
import { StatusBadge } from '../../ui/StatusBadge';
import { formatSize, formatTime } from '../../../lib/httpFormat';

interface ExchangeSummaryCardProps {
  req: HttpRequest;
}

export const ExchangeSummaryCard: React.FC<ExchangeSummaryCardProps> = ({ req }) => {
  const [copied, setCopied] = React.useState(false);
  const resp = req.response;

  const copyUrl = () => {
    if (req.url) {
      navigator.clipboard.writeText(req.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <CollapsibleCard id="summary" title="Exchange Summary" defaultOpen subtitle={req.method}>
      <div className="space-y-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method={req.method} size="md" />
          <StatusBadge code={resp?.statusCode} statusText={resp?.statusText} pending={!resp} />
          {req.hostPort?.ssl && (
            <span className="flex items-center gap-1 text-emerald-700 text-[10px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> HTTPS
            </span>
          )}
        </div>

        <div className="flex items-start gap-2">
          <p className="font-mono text-slate-800 break-all bg-slate-50 p-2 rounded-lg border border-slate-200 flex-1 select-all">
            {req.url || '-'}
          </p>
          <button type="button" onClick={copyUrl} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-400 text-[10px]">Protocol</span>
            <p className="font-semibold text-slate-800">{req.protocol || 'HTTP/1.1'}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">Duration</span>
            <p className="font-bold text-emerald-700">{req.durationMs ?? '—'} ms</p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">Size</span>
            <p className="font-mono text-slate-700">{formatSize(resp?.bodySize)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">Time</span>
            <p className="font-mono text-slate-700">{formatTime(req.startTime)}</p>
          </div>
          {req.process?.name && (
            <div className="col-span-2">
              <span className="text-slate-400 text-[10px]">Process</span>
              <p className="font-semibold text-slate-800">{req.process.name}</p>
            </div>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
};
