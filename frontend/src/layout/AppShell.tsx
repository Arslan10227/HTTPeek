import React, { useEffect } from 'react';
import { Eye, Sliders, History, Wrench, Settings } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { PageHeader } from './PageHeader';
import { StatusBar } from './StatusBar';
import { ViewPage } from '../pages/ViewPage';
import { RulesModal } from '../components/rules/RulesModal';
import { HistoryView } from '../components/history/HistoryView';
import { ToolboxView } from '../components/toolbox/ToolboxView';
import { SettingsView } from '../components/settings/SettingsView';
import { BreakpointDrawer } from '../components/breakpoint/BreakpointDrawer';
import { ToastContainer } from '../components/common/ToastContainer';
import { useUiStore, SidebarTab } from '../store/useUiStore';
import { api } from '../store/apiAdapter';
import { chrome } from '../design/tokens';

const mobileTabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'view', label: 'View', icon: <Eye className="w-5 h-5" /> },
  { id: 'rules', label: 'Rules', icon: <Sliders className="w-5 h-5" /> },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  { id: 'toolbox', label: 'Tools', icon: <Wrench className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export const AppShell: React.FC = () => {
  const { sidebarTab, setSidebarTab, setIsMobile } = useUiStore();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || api.isMobile());
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  const renderContent = () => {
    switch (sidebarTab) {
      case 'view':
        return <ViewPage />;
      case 'rules':
        return <RulesModal isOpen isEmbedded onClose={() => setSidebarTab('view')} />;
      case 'history':
        return <HistoryView />;
      case 'toolbox':
        return <ToolboxView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ViewPage />;
    }
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans"
      style={{ backgroundColor: 'var(--htk-bg)', color: 'var(--htk-text)' }}
    >
      {/* HTK-style left icon sidebar (desktop) */}
      <AppSidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-0">
        <PageHeader />

        <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {renderContent()}
        </main>

        <StatusBar />
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center py-1 pb-[env(safe-area-inset-bottom)]"
        style={{
          backgroundColor: chrome.sidebarBg,
          borderTop: `1px solid ${chrome.sidebarBorder}`,
        }}
      >
        {mobileTabs.map(({ id, label, icon }) => {
          const isActive = sidebarTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSidebarTab(id)}
              className="flex flex-col items-center p-2 min-w-[56px] cursor-pointer transition-colors"
              style={{ color: isActive ? chrome.sidebarTextActive : chrome.sidebarText }}
            >
              {icon}
              <span className="text-[9px] mt-0.5 font-semibold">{label}</span>
            </button>
          );
        })}
      </nav>

      <BreakpointDrawer />
      <ToastContainer />
    </div>
  );
};
