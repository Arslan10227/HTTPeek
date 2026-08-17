import React from 'react';
import { getMethodColor } from '../../design/tokens';

interface MethodBadgeProps {
  method: string;
  size?: 'sm' | 'md';
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method, size = 'sm' }) => {
  const c = getMethodColor(method);
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`font-bold rounded border shrink-0 ${sizeClass} ${c.bg} ${c.text} ${c.border}`}>
      {method?.toUpperCase() || 'GET'}
    </span>
  );
};
