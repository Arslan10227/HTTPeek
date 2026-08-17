import React, { useState } from 'react';
import { HttpRequest, SSEEvent } from '../../types';
import { Activity, Search, Copy } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface SSETabProps {
  request: HttpRequest;
}

export const SSETab: React.FC<SSETabProps> = ({ request }) => {
  const { t } = useTranslation();
  const [filterQuery, setFilterQuery] = useState('');

  const events: SSEEvent[] = request.sseEvents || [];

  const filteredEvents = events.filter((e) =>
    (e.data || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (e.event || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 select-none p-3 text-xs gap-2">
      {/* Search Header */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter Server-Sent Events..."
            className="w-full pl-8 pr-3 py-1 rounded-lg border font-mono text-[11px] bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          />
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          {filteredEvents.length} events
        </span>
      </div>

      {/* Events List */}
      <div
        className="flex-1 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 min-h-0"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 italic">
            No SSE events recorded
          </div>
        ) : (
          filteredEvents.map((evt, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[11px] group border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors select-text"
            >
              <div className="p-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-0.5">
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    event: {evt.event || 'message'}
                  </span>
                  {evt.id && <span>id: {evt.id}</span>}
                  <span>
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <div className="break-all whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/40 p-1.5 rounded-md border border-gray-100 dark:border-gray-800">
                  {evt.data}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(evt.data || '');
                  toast.success(t.copied);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                title="Copy event data"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
