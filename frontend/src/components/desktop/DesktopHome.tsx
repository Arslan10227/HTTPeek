import React, { useState } from 'react';
import { Toolbar } from './Toolbar';
import { LeftNavigationBar, LeftNavTab } from './LeftNavigationBar';
import { VerticalSplitView } from './SplitView';
import { RequestList } from '../request/RequestList';
import { FavoritesPage } from '../left_menus/FavoritesPage';
import { HistoryPage } from '../left_menus/HistoryPage';
import { Toolbox } from '../toolbox/Toolbox';
import { NetworkTabController } from '../panel/NetworkTabController';
import { RequestEditor } from '../editor/RequestEditor';
import { FilterDialog } from '../rules/FilterDialog';
import { HostsDialog } from '../rules/HostsDialog';
import { RequestBlockDialog } from '../rules/RequestBlockDialog';
import { RequestRewriteDialog } from '../rules/RequestRewriteDialog';
import { RequestMapDialog } from '../rules/RequestMapDialog';
import { RequestCryptoDialog } from '../rules/RequestCryptoDialog';
import { ScriptDialog } from '../rules/ScriptDialog';
import { BreakpointDialog } from '../rules/BreakpointDialog';
import { WeakNetworkDialog } from '../rules/WeakNetworkDialog';
import { ExternalProxyDialog } from '../rules/ExternalProxyDialog';
import { AboutDialog } from './AboutDialog';
import { DocumentationModal } from './DocumentationModal';
import { PCCertDialog } from '../ssl/PCCertDialog';
import { MobileCertDialog } from '../ssl/MobileCertDialog';
import { EnvironmentModal } from '../environment/EnvironmentModal';

import { HttpRequest, HttpResponse } from '../../types';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';

export const DesktopHome: React.FC = () => {
  const { requests, selectedRequestId, setSelectedRequestId } = useProxyStore();
  const { panelRatio, setPanelRatio } = useAppConfig();

  const [activeNavTab, setActiveNavTab] = useState<LeftNavTab>('requests');

  // Selected Request for Inspector
  const selectedRequest =
    requests.find((r) => r.id === selectedRequestId) || (requests.length > 0 ? requests[0] : null);

  // Dialog State Machine
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isHostsOpen, setIsHostsOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isCryptoOpen, setIsCryptoOpen] = useState(false);
  const [isScriptOpen, setIsScriptOpen] = useState(false);
  const [isBreakpointOpen, setIsBreakpointOpen] = useState(false);
  const [isWeakNetworkOpen, setIsWeakNetworkOpen] = useState(false);
  const [isExternalProxyOpen, setIsExternalProxyOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isPcCertOpen, setIsPcCertOpen] = useState(false);
  const [mobileCertPlatform, setMobileCertPlatform] = useState<'ios' | 'android' | null>(null);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);

  // Global F1 Shortcut for in-app documentation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setIsDocsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request Editor State
  const [editorRequest, setEditorRequest] = useState<HttpRequest | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleEditAndResend = (req: HttpRequest) => {
    setEditorRequest(req);
    setIsEditorOpen(true);
  };

  const renderLeftNavigationView = () => {
    switch (activeNavTab) {
      case 'requests':
        return (
          <RequestList
            selectedRequestId={selectedRequest?.id || null}
            onSelectRequest={(req) => setSelectedRequestId(req.id)}
            onEditAndResend={handleEditAndResend}
            onOpenRewriteRule={() => setIsRewriteOpen(true)}
            onOpenMapLocal={() => setIsMapOpen(true)}
            onOpenBreakpoint={() => setIsBreakpointOpen(true)}
          />
        );
      case 'favorites':
        return (
          <FavoritesPage
            onEditAndResend={handleEditAndResend}
            onOpenRewriteRule={() => setIsRewriteOpen(true)}
            onOpenMapLocal={() => setIsMapOpen(true)}
            onOpenBreakpoint={() => setIsBreakpointOpen(true)}
          />
        );
      case 'history':
        return (
          <HistoryPage
            onEditAndResend={handleEditAndResend}
            onOpenRewriteRule={() => setIsRewriteOpen(true)}
            onOpenMapLocal={() => setIsMapOpen(true)}
            onOpenBreakpoint={() => setIsBreakpointOpen(true)}
          />
        );
      case 'toolbox':
        return <Toolbox onOpenRequestEditor={() => {
          setEditorRequest(undefined);
          setIsEditorOpen(true);
        }} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-sans">
      {/* Top Toolbar */}
      <Toolbar
        onClear={() => setSelectedRequestId(null)}
        onOpenPcCert={() => setIsPcCertOpen(true)}
        onOpenMobileCert={(p) => setMobileCertPlatform(p)}
        onManageEnvironments={() => setIsEnvModalOpen(true)}
        onOpenFilter={() => setIsFilterOpen(true)}
        onOpenHosts={() => setIsHostsOpen(true)}
        onOpenBlock={() => setIsBlockOpen(true)}
        onOpenRewrite={() => setIsRewriteOpen(true)}
        onOpenMap={() => setIsMapOpen(true)}
        onOpenCrypto={() => setIsCryptoOpen(true)}
        onOpenScript={() => setIsScriptOpen(true)}
        onOpenBreakpoint={() => setIsBreakpointOpen(true)}
        onOpenWeakNetwork={() => setIsWeakNetworkOpen(true)}
        onOpenExternalProxy={() => setIsExternalProxyOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
      />

      {/* Main Body with Left Nav and Split View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <LeftNavigationBar
          activeTab={activeNavTab}
          onTabChange={setActiveNavTab}
          requestCount={requests.length}
          onOpenDocs={() => setIsDocsOpen(true)}
        />

        {activeNavTab === 'requests' ? (
          <VerticalSplitView
            ratio={panelRatio}
            onRatioChanged={setPanelRatio}
            left={renderLeftNavigationView()}
            right={
              <NetworkTabController
                request={selectedRequest}
                onEditAndResend={handleEditAndResend}
                onOpenRewriteRule={() => setIsRewriteOpen(true)}
                onOpenMapLocal={() => setIsMapOpen(true)}
                onOpenBreakpoint={() => setIsBreakpointOpen(true)}
              />
            }
          />
        ) : (
          <div className="flex-1 overflow-hidden min-h-0 flex">
            {renderLeftNavigationView()}
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      {isFilterOpen && <FilterDialog onClose={() => setIsFilterOpen(false)} />}
      {isHostsOpen && <HostsDialog onClose={() => setIsHostsOpen(false)} />}
      {isBlockOpen && <RequestBlockDialog onClose={() => setIsBlockOpen(false)} />}
      {isRewriteOpen && <RequestRewriteDialog onClose={() => setIsRewriteOpen(false)} />}
      {isMapOpen && <RequestMapDialog onClose={() => setIsMapOpen(false)} />}
      {isCryptoOpen && <RequestCryptoDialog onClose={() => setIsCryptoOpen(false)} />}
      {isScriptOpen && <ScriptDialog onClose={() => setIsScriptOpen(false)} />}
      {isBreakpointOpen && <BreakpointDialog onClose={() => setIsBreakpointOpen(false)} />}
      {isWeakNetworkOpen && <WeakNetworkDialog onClose={() => setIsWeakNetworkOpen(false)} />}
      {isExternalProxyOpen && <ExternalProxyDialog onClose={() => setIsExternalProxyOpen(false)} />}
      {isAboutOpen && <AboutDialog onClose={() => setIsAboutOpen(false)} />}
      {isDocsOpen && (
        <DocumentationModal
          isOpen={isDocsOpen}
          onClose={() => setIsDocsOpen(false)}
          onOpenRules={() => setIsRewriteOpen(true)}
          onOpenToolbox={() => setActiveNavTab('toolbox')}
          onOpenBreakpoints={() => setIsBreakpointOpen(true)}
        />
      )}
      {isPcCertOpen && <PCCertDialog onClose={() => setIsPcCertOpen(false)} />}
      {mobileCertPlatform && (
        <MobileCertDialog
          platform={mobileCertPlatform}
          onClose={() => setMobileCertPlatform(null)}
        />
      )}
      {isEnvModalOpen && <EnvironmentModal isOpen onClose={() => setIsEnvModalOpen(false)} />}
      {isEditorOpen && (
        <RequestEditor
          request={editorRequest}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};
