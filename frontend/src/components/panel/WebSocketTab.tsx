import React, { useState } from 'react';
import { HttpRequest, WsFrame } from '../../types';
import { ArrowDownLeft, ArrowUpRight, Send, Search, Copy } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { api } from '../../store/apiAdapter';

interface WebSocketTabProps {
  request: HttpRequest;
}

export const WebSocketTab: React.FC<WebSocketTabProps> = ({ request }) => {
  const { t } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const [filterQuery, setFilterQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const activeColor = getActiveColorPreset();

  const frames: WsFrame[] = request.wsFrames || [];

  const filteredFrames = frames.filter((f) =>
    (f.payload || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleSendFrame = async () => {
    if (!messageInput.trim()) return;
    try {
      if (api.sendWsFrame) {
        await api.sendWsFrame(request.id, messageInput);
      }
      toast.success(t.success, 'Frame sent');
      setMessageInput('');
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 select-none p-3 text-xs gap-2">
      {/* Top Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter WebSocket frames..."
            className="w-full pl-8 pr-3 py-1 rounded-lg border font-mono text-[11px] bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          />
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          {filteredFrames.length} frames
        </span>
      </div>

      {/* Frame Timeline List */}
      <div
        className="flex-1 overflow-y-auto border rounded-xl p-2 flex flex-col gap-1 min-h-0"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        {filteredFrames.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 italic">
            No WebSocket frames recorded
          </div>
        ) : (
          filteredFrames.map((frame, idx) => {
            const isClient = frame.direction === 'send' || frame.fromClient;
            return (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[11px] group border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors select-text"
              >
                <div
                  className={`p-1 rounded-full shrink-0 ${
                    isClient ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'bg-green-100 dark:bg-green-900/40 text-green-600'
                  }`}
                  title={isClient ? 'Client -> Server' : 'Server -> Client'}
                >
                  {isClient ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-0.5">
                    <span className="font-bold uppercase">
                      {frame.opcode || (frame.isBinary ? 'BINARY' : 'TEXT')}
                    </span>
                    <span>{frame.length || frame.payload?.length || 0} B</span>
                    <span>
                      {frame.timestamp ? new Date(frame.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <div className="break-all whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                    {frame.payload}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(frame.payload || '');
                    toast.success(t.copied);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                  title="Copy frame"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Send Message Input */}
      <div className="flex items-center gap-2 pt-1 shrink-0">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendFrame();
          }}
          placeholder="Send custom WebSocket frame..."
          className="flex-1 px-3 py-1.5 rounded-lg border font-mono text-[11px] bg-transparent focus:outline-none"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        />
        <button
          type="button"
          onClick={handleSendFrame}
          className="flex items-center gap-1 px-4 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
          style={{ backgroundColor: activeColor.hex }}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t.send}</span>
        </button>
      </div>
    </div>
  );
};
