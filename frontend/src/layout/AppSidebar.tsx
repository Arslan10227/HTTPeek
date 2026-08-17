import React, { useEffect, useState } from 'react';
import { Eye, Sliders, History, Wrench, Settings, Shield } from 'lucide-react';
import { useUiStore, SidebarTab } from '../store/useUiStore';
import { useProxyStore } from '../store/useProxyStore';
import { api } from '../store/apiAdapter';
import { chrome, spacing } from '../design/tokens';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'view', label: 'View', icon: <Eye className="w-5 h-5" /> },
  { id: 'rules', label: 'Rules', icon: <Sliders className="w-5 h-5" /> },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  { id: 'toolbox', label: 'Toolbox', icon: <Wrench className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export const AppSidebar: React.FC = () => {
  const { sidebarTab, setSidebarTab } = useUiStore();
  const { requests } = useProxyStore();
  const [caReady, setCaReady] = useState<boolean | null>(null);

  useEffect(() => {
    api.getCADetails().then((d) => setCaReady(Boolean(d?.installed ?? d?.exists))).catch(() => setCaReady(null));
  }, []);

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 select-none z-20"
      style={{
        width: spacing.sidebarWidth + 8,
        backgroundColor: chrome.sidebarBg,
        borderRight: `1px solid ${chrome.sidebarBorder}`,
      }}
    >
      {/* Brand mark */}
      <div className="h-14 flex items-center justify-center border-b" style={{ borderColor: chrome.sidebarBorder }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg"
          style={{ background: `linear-gradient(135deg, ${chrome.sidebarAccent}, #2ecc71)` }}
          title="HTTPeek Go"
        >
          H
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        {tabs.map((tab) => {
          const isActive = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSidebarTab(tab.id)}
              title={tab.label}
              className="relative w-11 h-11 flex items-center justify-center rounded-lg transition-all cursor-pointer group"
              style={{
                color: isActive ? chrome.sidebarTextActive : chrome.sidebarText,
                backgroundColor: isActive ? 'rgba(74, 144, 226, 0.18)' : 'transparent',
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r"
                  style={{ backgroundColor: chrome.sidebarAccent }}
                />
              )}
              {tab.icon}
              {tab.id === 'view' && requests.length > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: chrome.sidebarAccent }}
                >
                  {requests.length > 99 ? '99+' : requests.length}
                </span>
              )}
              <span
                className="absolute left-full ml-2 px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50"
                style={{ backgroundColor: '#1e2030', color: '#fff' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* CA status */}
      <div className="py-3 flex justify-center border-t" style={{ borderColor: chrome.sidebarBorder }}>
        <button
          type="button"
          onClick={() => setSidebarTab('settings')}
          title={caReady ? 'Root CA installed' : 'Root CA not installed — open Settings'}
          className="w-11 h-11 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
          style={{ color: caReady ? '#50c878' : '#e8a838' }}
        >
          <Shield className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
