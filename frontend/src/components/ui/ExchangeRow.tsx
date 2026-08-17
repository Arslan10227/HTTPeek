import React from 'react';
import { Star, Shield, Cpu } from 'lucide-react';
import { HttpRequest } from '../../types';
import { MethodBadge } from './MethodBadge';
import { StatusBadge } from './StatusBadge';
import { formatSize, formatTime } from '../../lib/httpFormat';

interface ExchangeRowProps {
  request: HttpRequest;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

export const ExchangeRow: React.FC<ExchangeRowProps> = ({
  request,
  isSelected,
  onSelect,
  onToggleFavorite,
  onContextMenu,
  compact = false,
}) => {
  const resp = request.response;
  const hostPath = `${request.hostPort?.host || ''}${request.path || ''}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      onContextMenu={onContextMenu}
      className={`htk-row ${isSelected ? 'htk-row-selected' : ''}`}
    >
      <MethodBadge method={request.method} />
      <StatusBadge code={resp?.statusCode} statusText={resp?.statusText} pending={!resp} />

      <span className="flex-1 min-w-0 truncate font-medium" title={hostPath}>
        {request.hostPort?.host}
        <span className="text-[var(--htk-text-muted)] font-normal font-mono text-[10px]">{request.path || ''}</span>
      </span>

      {!compact && (
        <>
          <span className="text-[var(--htk-text-muted)] font-mono shrink-0 w-12 text-right text-[10px]">
            {request.durationMs != null ? `${request.durationMs}ms` : '—'}
          </span>
          <span className="text-[var(--htk-text-muted)] font-mono shrink-0 w-14 text-right hidden lg:inline text-[10px]">
            {formatSize(resp?.bodySize)}
          </span>
          {request.hostPort?.ssl && <Shield className="w-3 h-3 shrink-0" style={{ color: 'var(--htk-accent)' }} />}
          {request.process?.name && (
            <span className="hidden xl:flex items-center gap-0.5 text-[var(--htk-text-muted)] shrink-0 max-w-[80px] truncate text-[10px]">
              <Cpu className="w-3 h-3 shrink-0" />
              {request.process.name}
            </span>
          )}
          <span className="text-[var(--htk-text-muted)] font-mono shrink-0 w-16 text-right hidden md:inline text-[10px]">
            {formatTime(request.startTime)}
          </span>
        </>
      )}

      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          className="htk-btn-icon shrink-0"
        >
          <Star className={`w-3.5 h-3.5 ${request.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
        </button>
      )}
    </div>
  );
};
