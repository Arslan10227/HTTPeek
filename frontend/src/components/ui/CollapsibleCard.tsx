import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleCardProps {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  persistKey?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  id,
  title,
  subtitle,
  defaultOpen = true,
  persistKey,
  actions,
  children,
  className = '',
}) => {
  const storageKey = persistKey || `httpeek_card_${id}`;
  const [open, setOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return defaultOpen;
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === 'true' : defaultOpen;
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, String(open));
    }
  }, [open, storageKey]);

  return (
    <div className={`htk-card ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="htk-card-header"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
          )}
          <span>{title}</span>
          {subtitle && !open && (
            <span className="font-normal normal-case tracking-normal text-[var(--htk-text-muted)] truncate">{subtitle}</span>
          )}
        </div>
        {actions && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{actions}</div>}
      </button>
      {open && <div className="htk-card-body">{children}</div>}
    </div>
  );
};
