import React, { useState, useMemo } from 'react';
import { HttpRequest } from '../../types';
import { GeneralTab } from './GeneralTab';
import { RequestTab } from './RequestTab';
import { ResponseTab } from './ResponseTab';
import { GraphQLViewer, parseGraphQLPayload } from './GraphQLViewer';
import { WebSocketTab } from './WebSocketTab';
import { SSETab } from './SSETab';
import { Play, Edit3, Share2, Heart, Copy, Sparkles, Send } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { useAppConfig } from '../../theme/useAppConfig';

export type InspectorTabType = 'general' | 'request' | 'response' | 'graphql' | 'websocket' | 'sse';

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
        className="flex-1 flex flex-col items-center justify-center text-gray-400 select-none text-xs"
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          color: 'var(--md-sys-color-on-surface-variant)',
        }}
      >
        <span>Select a request from the list to inspect</span>
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
  const isSse = ctHeader.toLowerCase().includes('text/event-stream');

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

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0 select-none font-sans"
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
      }}
    >
      {/* Tab Header & Action Bar */}
      <div
        className="flex items-center justify-between px-3 h-[42px] border-b shrink-0 select-none bg-white dark:bg-gray-900"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'general'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'request'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Request
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
              activeTab === 'response'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Response {request.response && `(${request.response.statusCode})`}
          </button>

          {isGraphQL && (
            <button
              type="button"
              onClick={() => setActiveTab('graphql')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                activeTab === 'graphql'
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shadow-2xs'
                  : 'text-purple-500 hover:text-purple-800 dark:hover:text-purple-300 font-bold'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>GraphQL</span>
            </button>
          )}

          {isWebSocket && (
            <button
              type="button"
              onClick={() => setActiveTab('websocket')}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                activeTab === 'websocket'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              WebSocket Frames
            </button>
          )}

          {isSse && (
            <button
              type="button"
              onClick={() => setActiveTab('sse')}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                activeTab === 'sse'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              SSE Stream
            </button>
          )}
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRepeat}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
            title={t.repeat}
          >
            <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={() => onEditAndResend(request)}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
            title={`${t.edit} in Request Composer`}
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleFavorite(request.id);
              toast.info(request.isFavorite ? t.removeFavorite : t.addFavorite);
            }}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
            title={request.isFavorite ? t.removeFavorite : t.addFavorite}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                request.isFavorite ? 'fill-red-500 text-red-500' : ''
              }`}
            />
          </button>

          {/* Share Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
              title={t.share}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {isShareMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-2xl shadow-xl py-1 border z-50 text-xs flex flex-col animate-in fade-in zoom-in-95 duration-75 bg-white dark:bg-gray-900"
                style={{
                  borderColor: 'var(--md-sys-color-divider)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(request.url);
                    toast.success(t.copied, request.url);
                    setIsShareMenuOpen(false);
                  }}
                  className="px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                >
                  {t.copyUrl}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
                >
                  {t.copyCurl}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content Panes */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
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
      </div>
    </div>
  );
};
