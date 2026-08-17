import React, { useState } from 'react';
import {
  Search,
  ShieldCheck,
  Layers,
  Eye,
  Sliders,
  History,
  Wrench,
  Settings,
} from 'lucide-react';
import { useUiStore, SidebarTab } from '../store/useUiStore';
import { useProxyStore } from '../store/useProxyStore';
import { useThemeStore, THEME_OPTIONS } from '../store/useThemeStore';
import { toast } from '../store/useToastStore';
import { ColorfulIcon } from '../components/common/ColorfulIcon';
import { MobileSyncModal } from '../components/ssl/MobileSyncModal';
import { RequestComposerModal } from '../components/composer/RequestComposerModal';
import { EnvironmentModal } from '../components/environment/EnvironmentModal';
import { HostFilterModal } from '../components/filter/HostFilterModal';
import { LogViewerModal } from '../components/logs/LogViewerModal';
import { spacing } from '../design/tokens';

const titles: Record<SidebarTab, { label: string; icon: React.ReactNode }> = {
  view: { label: 'View', icon: <Eye className="w-4 h-4" /> },
  rules: { label: 'Rules & Mock', icon: <Sliders className="w-4 h-4" /> },
  history: { label: 'History', icon: <History className="w-4 h-4" /> },
  toolbox: { label: 'Toolbox', icon: <Wrench className="w-4 h-4" /> },
  settings: { label: 'Settings', icon: <Settings className="w-4 h-4" /> },
};

export const PageHeader: React.FC = () => {
  const { sidebarTab } = useUiStore();
  const { searchQuery, setSearchQuery, environments, activeEnvironmentId } = useProxyStore();
  const { theme, setTheme } = useThemeStore();
  const [isMobileSyncOpen, setIsMobileSyncOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isHostFilterOpen, setIsHostFilterOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const page = titles[sidebarTab];

  return (
    <>
      <header
        className="shrink-0 flex items-center gap-3 px-4 border-b select-none"
        style={{
          height: spacing.pageHeaderHeight,
          backgroundColor: 'var(--htk-panel)',
          borderColor: 'var(--htk-panel-border)',
        }}
      >
        <div className="flex items-center gap-2 shrink-0 min-w-[120px]">
          <span style={{ color: 'var(--htk-accent)' }}>{page.icon}</span>
          <h1 className="text-sm font-bold" style={{ color: 'var(--htk-text)' }}>{page.label}</h1>
        </div>

        {/* View-only search */}
        {sidebarTab === 'view' && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter: status:200 method:GET domain:api.*"
                className="w-full text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none font-mono border"
                style={{
                  background: 'var(--htk-surface)',
                  borderColor: 'var(--htk-panel-border)',
                  color: 'var(--htk-text)',
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileSyncOpen(true)}
            className="p-1.5 rounded-md cursor-pointer htk-btn-icon"
            title="Mobile Connect & Certificate"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="p-1.5 rounded-md cursor-pointer htk-btn-icon"
            title="Request Composer"
          >
            <ColorfulIcon name="composer" size={15} />
          </button>
          <button
            type="button"
            onClick={() => setIsHostFilterOpen(true)}
            className="p-1.5 rounded-md cursor-pointer htk-btn-icon hidden sm:block"
            title="Host Filter"
          >
            <ColorfulIcon name="filter" size={15} />
          </button>
          <button
            type="button"
            onClick={() => setIsEnvModalOpen(true)}
            className="hidden md:flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer htk-btn max-w-[120px]"
            title="Environment"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{activeEnv?.name || 'Env'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            className="p-1.5 rounded-md cursor-pointer htk-btn-icon"
            title="Logs"
          >
            <ColorfulIcon name="logs" size={14} />
          </button>
          <select
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value as any);
              toast.info(`Theme: ${THEME_OPTIONS.find((t) => t.id === e.target.value)?.name}`);
            }}
            className="text-[10px] font-semibold rounded-md px-1.5 py-1 cursor-pointer focus:outline-none htk-btn"
            style={{ minWidth: 72 }}
            title="Theme"
          >
            {THEME_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      <MobileSyncModal isOpen={isMobileSyncOpen} onClose={() => setIsMobileSyncOpen(false)} />
      <RequestComposerModal isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} />
      <EnvironmentModal isOpen={isEnvModalOpen} onClose={() => setIsEnvModalOpen(false)} />
      <HostFilterModal isOpen={isHostFilterOpen} onClose={() => setIsHostFilterOpen(false)} />
      <LogViewerModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} />
    </>
  );
};
