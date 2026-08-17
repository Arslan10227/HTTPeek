import React from 'react';
import { Star, RotateCw, Trash2 } from 'lucide-react';
import { HttpRequest } from '../../types';
import { useExchangeDerived } from './hooks/useExchangeDerived';
import { ExchangeSummaryCard } from './cards/ExchangeSummaryCard';
import { RequestCard } from './cards/RequestCard';
import { RequestBodyCard, ResponseBodyCard } from './cards/BodyCard';
import { ResponseCard } from './cards/ResponseCard';
import { ExportCard } from './cards/ExportCard';
import { TransformCard, PerformanceCard } from './cards/TransformPerformanceCards';
import { WebSocketCard, SSECard } from './cards/StreamCards';
import { PaneHeader } from '../ui/PaneHeader';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';

interface InspectorPanelProps {
  request: HttpRequest;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ request }) => {
  const { toggleFavorite, deleteRequest, selectRequest } = useProxyStore();
  const derived = useExchangeDerived(request);

  const handleReplay = async () => {
    try {
      if ((window as any).go?.main?.App?.ReplayRequest) {
        await (window as any).go.main.App.ReplayRequest(request);
        toast.success('Request replayed');
      }
    } catch (e: any) {
      toast.error('Replay failed', e.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--htk-panel)]">
      <PaneHeader title="Exchange details" />

      <div className="flex-1 overflow-y-auto p-3">
        <ExchangeSummaryCard req={request} />
        <RequestCard
          headers={derived.reqHeaders}
          queryParams={derived.queryParams}
          requestCookies={derived.requestCookies}
        />
        <RequestBodyCard
          bodyRaw={derived.reqBodyRaw}
          formatted={derived.reqFormatted.formatted}
          language={derived.reqFormatted.language}
          contentType={derived.reqHeaders['Content-Type']?.[0]}
        />
        {derived.resp && (
          <>
            <ResponseCard
              statusCode={derived.resp.statusCode}
              statusText={derived.resp.statusText}
              protocol={derived.resp.protocol}
              headers={derived.respHeaders}
              responseCookies={derived.responseCookies}
            />
            <ResponseBodyCard
              bodyRaw={derived.respBodyRaw}
              formatted={derived.respFormatted.formatted}
              language={derived.respFormatted.language}
              contentType={derived.resp.contentType}
              isImage={derived.isImageResponse}
            />
          </>
        )}
        <TransformCard appliedRules={request.appliedRules} />
        <PerformanceCard timings={request.timings} durationMs={request.durationMs} />
        <WebSocketCard frames={derived.resp?.wsFrames} />
        <SSECard events={derived.resp?.sseEvents} />
        <ExportCard req={request} curl={derived.curl} />
      </div>

      <div className="htk-inspector-actions">
        <button type="button" onClick={handleReplay} className="htk-btn">
          <RotateCw className="w-3.5 h-3.5" /> Replay
        </button>
        <button type="button" onClick={() => toggleFavorite(request.id)} className="htk-btn">
          <Star className={`w-3.5 h-3.5 ${request.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} /> Favorite
        </button>
        <button
          type="button"
          onClick={() => { deleteRequest(request.id); selectRequest(null); }}
          className="htk-btn ml-auto"
          style={{ color: 'var(--htk-danger)' }}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
};
