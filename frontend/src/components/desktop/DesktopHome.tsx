import React, { useState, useEffect } from 'react';
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
import { QuickRuleDialog } from '../rules/QuickRuleDialog';
import { WeakNetworkDialog } from '../rules/WeakNetworkDialog';
import { ExternalProxyDialog } from '../rules/ExternalProxyDialog';
import { AboutDialog } from './AboutDialog';
import { DocumentationModal } from './DocumentationModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { ExportModal } from '../common/ExportModal';
import { PCCertDialog } from '../ssl/PCCertDialog';
import { MobileCertDialog } from '../ssl/MobileCertDialog';
import { EnvironmentModal } from '../environment/EnvironmentModal';
import { RequestComposerModal } from '../composer/RequestComposerModal';

import { HttpRequest, HttpResponse } from '../../types';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';

export const DesktopHome: React.FC = () => {
  const { requests, selectedRequestId, setSelectedRequestId, addRequest } = useProxyStore();
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
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Quick Rule Modal
  const [quickRuleState, setQuickRuleState] = useState<{
    isOpen: boolean;
    type: 'rewrite' | 'mock' | 'breakpoint' | 'script';
    request: HttpRequest | null;
  }>({
    isOpen: false,
    type: 'rewrite',
    request: null,
  });

  // Global F1 Shortcut for in-app documentation & startup file check
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setIsDocsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Startup File Check (.har or .json passed via CLI / double click)
    if ((window as any).go?.main?.App?.GetStartupFile) {
      (window as any).go.main.App.GetStartupFile().then((filePath: string) => {
        if (filePath) {
          toast.info('Loading Startup File', filePath);
        }
      }).catch(() => {});
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request Composer / Editor State
  const [composerRequest, setComposerRequest] = useState<HttpRequest | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const handleEditAndResend = (req: HttpRequest) => {
    setComposerRequest(req);
    setIsComposerOpen(true);
  };

  const handleOpenQuickRule = (
    type: 'rewrite' | 'mock' | 'breakpoint' | 'script',
    req: HttpRequest,
    prefill?: any
  ) => {
    setQuickRuleState({
      isOpen: true,
      type,
      request: req,
    });
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
        return (
          <Toolbox
            onOpenRequestEditor={() => {
              setComposerRequest(null);
              setIsComposerOpen(true);
            }}
          />
        );
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
                onOpenQuickRule={handleOpenQuickRule}
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
      {isRewriteOpen && (
        <RequestRewriteDialog
          onClose={() => setIsRewriteOpen(false)}
          initialRequest={selectedRequest}
        />
      )}
      {isMapOpen && <RequestMapDialog onClose={() => setIsMapOpen(false)} />}
      {isCryptoOpen && <RequestCryptoDialog onClose={() => setIsCryptoOpen(false)} />}
      {isScriptOpen && <ScriptDialog onClose={() => setIsScriptOpen(false)} />}
      {isBreakpointOpen && (
        <BreakpointDialog
          onClose={() => setIsBreakpointOpen(false)}
          initialRequest={selectedRequest}
        />
      )}
      {quickRuleState.isOpen && (
        <QuickRuleDialog
          isOpen={quickRuleState.isOpen}
          onClose={() => setQuickRuleState({ ...quickRuleState, isOpen: false })}
          type={quickRuleState.type}
          request={quickRuleState.request}
        />
      )}
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
      {isComposerOpen && (
        <RequestComposerModal
          isOpen={isComposerOpen}
          initialRequest={composerRequest}
          onClose={() => setIsComposerOpen(false)}
        />
      )}
      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          allRequests={requests}
          selectedRequests={selectedRequest ? [selectedRequest] : []}
          activeDomain={selectedRequest?.hostPort?.host}
        />
      )}
      <ConfirmModal />
    </div>
  );
};
