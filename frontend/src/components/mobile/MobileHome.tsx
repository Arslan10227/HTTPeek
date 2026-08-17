import React, { useState } from 'react';
import {
  Play,
  Square,
  Lock,
  Unlock,
  Trash2,
  Menu,
  X,
  LayoutGrid,
  History as HistoryIcon,
  Wrench,
  Settings as SettingsIcon,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { RequestList } from '../request/RequestList';
import { HistoryPage } from '../left_menus/HistoryPage';
import { Toolbox } from '../toolbox/Toolbox';
import { NetworkTabController } from '../panel/NetworkTabController';
import { RequestEditor } from '../editor/RequestEditor';
import { PreferenceDialog } from '../desktop/PreferenceDialog';
import { SslWidget } from '../desktop/SslWidget';
import { PCCertDialog } from '../ssl/PCCertDialog';
import { MobileCertDialog } from '../ssl/MobileCertDialog';
import { HttpRequest } from '../../types';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';

export const MobileHome: React.FC = () => {
  const { t } = useTranslation();
  const { requests, status, setStatus, selectedRequestId, setSelectedRequestId, clearRequests } = useProxyStore();
  const { getActiveColorPreset, clearConfirm } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [activeTab, setActiveTab] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPcCertOpen, setIsPcCertOpen] = useState(false);
  const [mobileCertPlatform, setMobileCertPlatform] = useState<'ios' | 'android' | null>(null);

  const isRunning = status.running ?? true;
  const isSsl = status.sslEnabled ?? true;

  const selectedRequest =
    requests.find((r) => r.id === selectedRequestId) || (requests.length > 0 ? requests[0] : null);

  const handleToggleProxy = async () => {
    try {
      if (isRunning) {
        if (api.stop) await api.stop();
        setStatus({ ...status, running: false });
      } else {
        if (api.start) await api.start();
        setStatus({ ...status, running: true });
      }
    } catch (e: any) {
      toast.error('Proxy Error', e?.message);
    }
  };

  const handleClear = () => {
    if (clearConfirm) {
      if (window.confirm(`${t.clearConfirm}?\n${t.clearConfirmSubtitle}`)) {
        clearRequests();
      }
    } else {
      clearRequests();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-sans select-none">
      {/* Mobile Top AppBar */}
      <header
        className="flex items-center justify-between px-3 h-12 border-b shrink-0"
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 rounded-full hover:bg-black/5 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm">ProxyPin</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleProxy}
            className={`p-1.5 rounded-full text-white cursor-pointer ${
              isRunning ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-full hover:bg-black/5 text-gray-600 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {activeTab === 0 && (
          <RequestList
            selectedRequestId={selectedRequest?.id || null}
            onSelectRequest={(req) => {
              setSelectedRequestId(req.id);
              setIsDetailOpen(true);
            }}
            onEditAndResend={(req) => {
              setIsEditorOpen(true);
            }}
          />
        )}
        {activeTab === 1 && (
          <HistoryPage
            onEditAndResend={(req) => setIsEditorOpen(true)}
          />
        )}
        {activeTab === 2 && (
          <Toolbox onOpenRequestEditor={() => setIsEditorOpen(true)} />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="flex items-center justify-around h-14 border-t shrink-0 pb-[env(safe-area-inset-bottom)]"
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab(0)}
          className={`flex flex-col items-center justify-center p-1 cursor-pointer ${
            activeTab === 0 ? 'font-bold' : 'text-gray-500'
          }`}
          style={{ color: activeTab === 0 ? activeColor.hex : undefined }}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">{t.requests}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(1)}
          className={`flex flex-col items-center justify-center p-1 cursor-pointer ${
            activeTab === 1 ? 'font-bold' : 'text-gray-500'
          }`}
          style={{ color: activeTab === 1 ? activeColor.hex : undefined }}
        >
          <HistoryIcon className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">{t.history}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(2)}
          className={`flex flex-col items-center justify-center p-1 cursor-pointer ${
            activeTab === 2 ? 'font-bold' : 'text-gray-500'
          }`}
          style={{ color: activeTab === 2 ? activeColor.hex : undefined }}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">{t.toolbox}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center p-1 text-gray-500 cursor-pointer"
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">{t.setting}</span>
        </button>
      </nav>

      {/* Mobile Request Detail Sheet */}
      {isDetailOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
            <span className="font-bold text-sm">Request Details</span>
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="p-1 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <NetworkTabController
              request={selectedRequest}
              onEditAndResend={() => setIsEditorOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {isPreferenceOpen && <PreferenceDialog onClose={() => setIsPreferenceOpen(false)} />}
      {isEditorOpen && <RequestEditor onClose={() => setIsEditorOpen(false)} />}
      {isPcCertOpen && <PCCertDialog onClose={() => setIsPcCertOpen(false)} />}
      {mobileCertPlatform && (
        <MobileCertDialog
          platform={mobileCertPlatform}
          onClose={() => setMobileCertPlatform(null)}
        />
      )}
    </div>
  );
};
