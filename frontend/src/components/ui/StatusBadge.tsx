import React from 'react';
import { getStatusColor } from '../../design/tokens';

interface StatusBadgeProps {
  code?: number;
  statusText?: string;
  pending?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ code, statusText, pending }) => {
  if (pending || !code) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono font-bold" style={{ color: 'var(--htk-text-muted)' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--htk-text-muted)' }} />
        ...
      </span>
    );
  }
  const c = getStatusColor(code);
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {code}{statusText ? ` ${statusText}` : ''}
    </span>
  );
};
