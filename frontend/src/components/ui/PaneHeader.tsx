import React from 'react';

interface PaneHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export const PaneHeader: React.FC<PaneHeaderProps> = ({ title, children }) => (
  <div className="htk-pane-header">
    <span className="flex-1 truncate">{title}</span>
    {children && <div className="flex items-center gap-1 normal-case tracking-normal font-semibold">{children}</div>}
  </div>
);
