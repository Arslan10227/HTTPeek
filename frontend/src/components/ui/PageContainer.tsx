import React from 'react';

interface PageContainerProps {
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Scrollable HTK-style page wrapper (title lives in PageHeader). */
export const PageContainer: React.FC<PageContainerProps> = ({
  description,
  children,
  className = '',
}) => (
  <div className={`htk-page ${className}`}>
    <div className="htk-page-inner">
      {description && <p className="htk-page-desc mb-4">{description}</p>}
      {children}
    </div>
  </div>
);
