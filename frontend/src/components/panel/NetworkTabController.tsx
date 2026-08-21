import React, { useState, useMemo } from 'react';
import { HttpRequest } from '../../types';
import { GeneralTab } from './GeneralTab';
import { RequestTab } from './RequestTab';
import { ResponseTab } from './ResponseTab';
import { GraphQLViewer, parseGraphQLPayload } from './GraphQLViewer';
import { WebSocketTab } from './WebSocketTab';
import { SSETab } from './SSETab';
import { GrpcTab } from './GrpcTab';
import { StreamTab } from './StreamTab';
import { Play, Edit3, Share2, Heart, Copy, Sparkles, Activity, Binary, Cpu } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { useAppConfig } from '../../theme/useAppConfig';
import { exportRequests } from '../../utils/exportHelper';

export type InspectorTabType = 'general' | 'request' | 'response' | 'graphql' | 'websocket' | 'sse' | 'grpc' | 'stream';

interface NetworkTabControllerProps {
  request: HttpRequest | null;
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
  onOpenQuickRule?: (type: 'rewrite' | 'mock' | 'breakpoint' | 'script', req: HttpRequest, prefill?: any) => void;
}

export const NetworkTabController: React.FC<NetworkTabControllerProps> = ({
  request,
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
  onOpenQuickRule,
}) => {
  const { t } = useTranslation();
  const { toggleFavorite } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [activeTab, setActiveTab] = useState<InspectorTabType>('general');
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const activeColor = getActiveColorPreset();

  // Detect GraphQL unconditionally before early returns
  const isGraphQL = useMemo(() => {
    if (!request) return false;
    const reqBody = request.bodyString || request.body || '';
    if (parseGraphQLPayload(reqBody)) return true;
    const urlLower = (request.url || '').toLowerCase();
    return urlLower.includes('/graphql') || urlLower.includes('/gql');
  }, [request]);

  if (!request) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center select-none text-xs gap-3 p-6 text-center"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-subtle)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <Activity className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            No request selected
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Select a request from the traffic list to view headers, payload, response, and timing.
          </p>
        </div>
      </div>
    );
  }

  const upgradeHeader = Array.isArray(request.headers?.['upgrade'] || request.headers?.['Upgrade'])
    ? (request.headers?.['upgrade'] || request.headers?.['Upgrade']).join(', ')
    : String(request.headers?.['upgrade'] || request.headers?.['Upgrade'] || '');
  const isWebSocket =
    Boolean(request.isWebSocket) ||
    upgradeHeader.toLowerCase().includes('websocket');

  const ctHeader = Array.isArray(request.response?.headers?.['content-type'] || request.response?.headers?.['Content-Type'])
    ? (request.response?.headers?.['content-type'] || request.response?.headers?.['Content-Type']).join(', ')
    : String(request.response?.contentType || request.response?.headers?.['content-type'] || request.response?.headers?.['Content-Type'] || '');
  const reqCtHeader = Array.isArray(request.headers?.['content-type'] || request.headers?.['Content-Type'])
    ? (request.headers?.['content-type'] || request.headers?.['Content-Type']).join(', ')
    : String(request.headers?.['content-type'] || request.headers?.['Content-Type'] || '');

  const isSse = ctHeader.toLowerCase().includes('text/event-stream');
  const isGrpc =
    ctHeader.toLowerCase().includes('application/grpc') ||
    reqCtHeader.toLowerCase().includes('application/grpc') ||
    request.protocol?.includes('gRPC');
  const isRawStream =
    request.protocol === 'RawTCP' ||
    request.protocol === 'RawTLS' ||
    request.protocol === 'SOCKS5';

  const handleRepeat = async () => {
    try {
      if ((window as any).go?.main?.App?.ReplayRequest) {
        await (window as any).go.main.App.ReplayRequest(request);
      } else if (api.repeatRequest) {
        await api.repeatRequest(request.id);
      }
      toast.success(t.success, `Replaying ${request.method} ${request.url}`);
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  const handleCopyCurl = () => {
    let curl = `curl -X ${request.method} '${request.url}'`;
    if (request.headers) {
      Object.entries(request.headers).forEach(([k, v]) => {
        curl += ` \\\n  -H '${k}: ${v}'`;
      });
    }
    if (request.body || request.bodyString) {
      const b = request.bodyString || request.body || '';
      curl += ` \\\n  --data-raw '${b.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard.writeText(curl);
    toast.success(t.copied, 'cURL command copied');
    setIsShareMenuOpen(false);
  };

  const getMethodClass = (method: string): string => {
    switch (method.toUpperCase()) {
      case 'GET':     return 'badge-method badge-get';
      case 'POST':    return 'badge-method badge-post';
      case 'PUT':     return 'badge-method badge-put';
      case 'PATCH':   return 'badge-method badge-patch';
      case 'DELETE':  return 'badge-method badge-delete';
      case 'OPTIONS': return 'badge-method badge-options';
      case 'HEAD':    return 'badge-method badge-head';
      case 'CONNECT': return 'badge-method badge-connect';
      case 'WS':      return 'badge-method badge-ws';
      case 'SSE':     return 'badge-method badge-sse';
      case 'GRPC':    return 'badge-method badge-grpc';
      case 'H3':      return 'badge-method badge-h3';
      default:        return 'badge-method badge-options';
    }
  };

  const getStatusBadgeClass = (status?: number) => {
    if (!status) return 'badge-status badge-pending';
    if (status >= 200 && status < 300) return 'badge-status badge-2xx';
    if (status >= 300 && status < 400) return 'badge-status badge-3xx';
    if (status >= 400 && status < 500) return 'badge-status badge-4xx';
    return 'badge-status badge-5xx';
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0 select-none font-sans"
      style={{
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* ── Top Summary Banner ─────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3.5 py-2 border-b shrink-0 gap-3 flex-wrap sm:flex-nowrap"
        style={{
          background: 'var(--color-surface-raised)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={getMethodClass(request.method)}>{request.method}</span>
          <span
            className="font-mono text-xs font-semibold truncate select-text"
            style={{ color: 'var(--color-text)' }}
            title={request.url}
          >
            {request.url}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {request.response?.statusCode && (
            <span className={getStatusBadgeClass(request.response.statusCode)}>
              {request.response.statusCode}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyCurl}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors"
            style={{
              borderColor: 'var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-muted)',
            }}
            title="Copy as cURL"
          >
            <Copy className="w-3 h-3" />
            <span>cURL</span>
          </button>

          <button
            type="button"
            onClick={() => onEditAndResend(request)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            style={{
              background: 'var(--color-primary)',
              color: '#0a2e1e',
            }}
            title="Edit & Resend in Composer"
          >
            <Edit3 className="w-3 h-3" />
            <span>Resend</span>
          </button>
        </div>
      </div>

      {/* ── Tab Header & Quick Action Bar ──────────────────────── */}
      <div
        className="flex items-center justify-between px-3 h-10 border-b shrink-0 select-none overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-4 text-xs font-bold overflow-x-auto no-scrollbar flex-1 min-w-0 pr-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`tab-item ${activeTab === 'general' ? 'tab-item-active' : ''}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`tab-item ${activeTab === 'request' ? 'tab-item-active' : ''}`}
          >
            Request
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`tab-item ${activeTab === 'response' ? 'tab-item-active' : ''}`}
          >
            Response
          </button>

          {isGraphQL && (
            <button
              type="button"
              onClick={() => setActiveTab('graphql')}
              className={`tab-item flex items-center gap-1 ${activeTab === 'graphql' ? 'tab-item-active' : ''}`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>GraphQL</span>
            </button>
          )}

          {isWebSocket && (
            <button
              type="button"
              onClick={() => setActiveTab('websocket')}
              className={`tab-item ${activeTab === 'websocket' ? 'tab-item-active' : ''}`}
            >
              WebSocket Frames
            </button>
          )}

          {isSse && (
            <button
              type="button"
              onClick={() => setActiveTab('sse')}
              className={`tab-item ${activeTab === 'sse' ? 'tab-item-active' : ''}`}
            >
              SSE Stream
            </button>
          )}

          {isGrpc && (
            <button
              type="button"
              onClick={() => setActiveTab('grpc')}
              className={`tab-item flex items-center gap-1 ${activeTab === 'grpc' ? 'tab-item-active' : ''}`}
            >
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span>gRPC</span>
            </button>
          )}

          {isRawStream && (
            <button
              type="button"
              onClick={() => setActiveTab('stream')}
              className={`tab-item flex items-center gap-1 ${activeTab === 'stream' ? 'tab-item-active' : ''}`}
            >
              <Binary className="w-3 h-3 text-cyan-400" />
              <span>Hex Stream</span>
            </button>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRepeat}
            className="btn-icon"
            title={t.repeat}
          >
            <Play className="w-3.5 h-3.5 fill-current text-emerald-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleFavorite(request.id);
              toast.info(request.isFavorite ? t.removeFavorite : t.addFavorite);
            }}
            className="btn-icon"
            title={request.isFavorite ? t.removeFavorite : t.addFavorite}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                request.isFavorite ? 'fill-rose-500 text-rose-500' : ''
              }`}
            />
          </button>

          {/* Share Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              className="btn-icon"
              title="Share & Export Request/Response"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {isShareMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl p-1.5 border z-50 text-xs flex flex-col gap-0.5 animate-dialog-in"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border-strong)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <span className="section-label px-2.5 py-1">Export Options</span>
                <button
                  type="button"
                  onClick={() => {
                    exportRequests([request], 'har', `request_${request.id}`);
                    setIsShareMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Export as .HAR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportRequests([request], 'json', `request_${request.id}`);
                    setIsShareMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Export as .JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportRequests([request], 'csv', `request_${request.id}`);
                    setIsShareMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Export as .CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportRequests([request], 'sh', `request_${request.id}`);
                    setIsShareMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Export as .SH Script</span>
                </button>
                <div className="h-px my-1" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(request.url);
                    toast.success(t.copied, request.url);
                    setIsShareMenuOpen(false);
                  }}
                  className="px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  {t.copyUrl}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCopyCurl();
                    setIsShareMenuOpen(false);
                  }}
                  className="px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  {t.copyCurl}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Content Panes ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'general' && <GeneralTab request={request} />}
        {activeTab === 'request' && (
          <RequestTab
            request={request}
            response={request.response}
            onOpenRule={(type, prefill) => onOpenQuickRule?.(type, request, prefill)}
          />
        )}
        {activeTab === 'response' && (
          <ResponseTab
            request={request}
            onOpenRule={(type, prefill) => onOpenQuickRule?.(type, request, prefill)}
          />
        )}
        {activeTab === 'graphql' && (
          <GraphQLViewer
            request={request}
            response={request.response}
            onOpenComposer={onEditAndResend}
          />
        )}
        {activeTab === 'websocket' && <WebSocketTab request={request} />}
        {activeTab === 'sse' && <SSETab request={request} />}
        {activeTab === 'grpc' && <GrpcTab request={request} />}
        {activeTab === 'stream' && <StreamTab request={request} />}
      </div>
    </div>
  );
};
