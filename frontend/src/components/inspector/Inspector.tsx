import React from 'react';
import { useProxyStore } from '../../store/useProxyStore';
import { InspectorPanel } from './InspectorPanel';

export const Inspector: React.FC = () => {
  const { selectedRequest } = useProxyStore();

  if (!selectedRequest) {
    return (
      <div className="flex flex-col h-full bg-[var(--htk-panel)]">
        <div className="htk-pane-header">Exchange details</div>
        <div className="htk-empty flex-1">
          <p className="htk-empty-title">Select an exchange</p>
          <p>Click a row in the list to inspect request and response details.</p>
        </div>
      </div>
    );
  }

  return <InspectorPanel request={selectedRequest} />;
};

export default Inspector;
