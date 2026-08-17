import React from 'react';
import { SplitPane } from '../components/ui/SplitPane';
import { ExchangeListPane } from '../components/request-list/ExchangeListPane';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { MobileInspectorSheet } from '../components/inspector/MobileInspectorSheet';
import { useProxyStore } from '../store/useProxyStore';
import { useUiStore } from '../store/useUiStore';

export const ViewPage: React.FC = () => {
  const { selectedRequest, selectedRequestId, selectRequest, toggleFavorite, status } = useProxyStore();
  const { isMobile } = useUiStore();

  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[var(--htk-panel)]">
        <ExchangeListPane />
        {selectedRequest && (
          <MobileInspectorSheet
            request={selectedRequest}
            onClose={() => selectRequest(null)}
            onToggleFavorite={() => selectedRequestId && toggleFavorite(selectedRequestId)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-[var(--htk-bg)]">
      <SplitPane
        left={<ExchangeListPane />}
        right={
          selectedRequest ? (
            <InspectorPanel request={selectedRequest} />
          ) : (
            <div className="flex flex-col h-full bg-[var(--htk-panel)]">
              <div className="htk-pane-header">Exchange details</div>
              <div className="htk-empty flex-1">
                <p className="htk-empty-title">
                  {status.running ? 'Waiting for traffic…' : 'Proxy is not running'}
                </p>
                <p className="text-[11px] max-w-xs">
                  {status.running
                    ? 'Send a request through the proxy, then select an exchange from the list.'
                    : 'Start the proxy from the status bar below, then generate traffic.'}
                </p>
              </div>
            </div>
          )
        }
      />
    </div>
  );
};
