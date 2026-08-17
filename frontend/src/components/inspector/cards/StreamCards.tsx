import React from 'react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { WsFrame, SSEEvent } from '../../../types';

export const WebSocketCard: React.FC<{ frames?: WsFrame[] }> = ({ frames }) => {
  if (!frames?.length) return null;
  return (
    <CollapsibleCard id="websocket" title="WebSocket Frames" subtitle={`${frames.length} frames`}>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {frames.map((f) => (
          <div key={f.id} className="font-mono text-[10px] p-2 bg-slate-50 rounded border border-slate-100">
            <span className={`font-bold ${f.direction === 'send' ? 'text-sky-700' : 'text-emerald-700'}`}>
              {(f.direction || 'receive').toUpperCase()}
            </span>
            <span className="text-slate-400 mx-2">{f.opcodeName}</span>
            <span className="text-slate-700 break-all">{f.text || `[${f.length} bytes]`}</span>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};

export const SSECard: React.FC<{ events?: SSEEvent[] }> = ({ events }) => {
  if (!events?.length) return null;
  return (
    <CollapsibleCard id="sse" title="SSE Events" subtitle={`${events.length} events`}>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="font-mono text-[10px] p-2 bg-violet-50 rounded border border-violet-100">
            {e.event && <span className="font-bold text-violet-700 mr-2">{e.event}</span>}
            <span className="text-slate-700 break-all">{e.data}</span>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
};
