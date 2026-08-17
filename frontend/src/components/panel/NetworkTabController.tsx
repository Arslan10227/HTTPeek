import React, { useState } from 'react';
import { HttpRequest } from '../../types';
import { GeneralTab } from './GeneralTab';
import { RequestTab } from './RequestTab';
import { ResponseTab } from './ResponseTab';
import { CookiesTab } from './CookiesTab';
import { WebSocketTab } from './WebSocketTab';
import { SSETab } from './SSETab';
import { Play, Edit3, Share2, MoreVertical, Heart, Ban, FileCode, MapPin } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { useAppConfig } from '../../theme/useAppConfig';

export type InspectorTabType = 'general' | 'request' | 'response' | 'dynamic';

interface NetworkTabControllerProps {
  request: HttpRequest | null;
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

export const NetworkTabController: React.FC<NetworkTabControllerProps> = ({
  request,
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const { t } = useTranslation();
  const { toggleFavorite } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [activeTab, setActiveTab] = useState<InspectorTabType>('general');
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const activeColor = getActiveColorPreset();

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

  let dynamicTabLabel = t.cookies;
  if (isSse) dynamicTabLabel = 'SSE';
  else if (isWebSocket) dynamicTabLabel = 'WebSocket';

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
    if (request.body) {
      curl += ` \\\n  --data-raw '${request.body.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard.writeText(curl);
    toast.success(t.copied, 'cURL command copied');
    setIsShareMenuOpen(false);
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0 select-none"
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
      }}
    >
      {/* Tab Header & Action Bar */}
      <div
        className="flex items-center justify-between px-3 h-[38px] border-b shrink-0 select-none"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'general'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t.general}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'request'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t.request}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'response'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t.response}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dynamic')}
            className={`py-2 px-1 cursor-pointer transition-colors ${
              activeTab === 'dynamic'
                ? 'md3-tab-active'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {dynamicTabLabel}
          </button>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRepeat}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
            title={t.repeat}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => onEditAndResend(request)}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
            title={`${t.edit} & ${t.send}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              toggleFavorite(request.id);
              toast.info(request.isFavorite ? t.removeFavorite : t.addFavorite);
            }}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
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
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 cursor-pointer"
              title={t.share}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {isShareMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl py-1 border z-50 text-xs flex flex-col animate-in fade-in zoom-in-95 duration-75"
                style={{
                  backgroundColor: 'var(--md-dialog-bg)',
                  borderColor: 'var(--md-sys-color-divider)',
                  color: 'var(--md-sys-color-on-surface)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(request.url);
                    toast.success(t.copied);
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
        {activeTab === 'request' && <RequestTab request={request} />}
        {activeTab === 'response' && <ResponseTab request={request} />}
        {activeTab === 'dynamic' && (
          <>
            {isSse ? (
              <SSETab request={request} />
            ) : isWebSocket ? (
              <WebSocketTab request={request} />
            ) : (
              <CookiesTab request={request} />
            )}
          </>
        )}
      </div>
    </div>
  );
};
