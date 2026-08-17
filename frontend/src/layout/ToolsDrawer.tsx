import React from 'react';
import { X, Sliders, History, Wrench, Settings } from 'lucide-react';
import { useUiStore, ToolsDrawerTab } from '../store/useUiStore';
import { RulesModal } from '../components/rules/RulesModal';
import { HistoryView } from '../components/history/HistoryView';
import { ToolboxView } from '../components/toolbox/ToolboxView';
import { SettingsView } from '../components/settings/SettingsView';
import { spacing } from '../design/tokens';

const tabs: { id: ToolsDrawerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'rules', label: 'Rules', icon: <Sliders className="w-4 h-4" /> },
  { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  { id: 'toolbox', label: 'Toolbox', icon: <Wrench className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export const ToolsDrawer: React.FC = () => {
  const { drawerOpen, drawerTab, openDrawer, closeDrawer } = useUiStore();

  if (!drawerOpen || !drawerTab) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={closeDrawer} />
      <aside
        className="fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right"
        style={{ width: spacing.drawerWidth, maxWidth: '95vw' }}
      >
        <div className="h-12 border-b border-slate-200 flex items-center px-3 gap-1 shrink-0 bg-slate-50">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openDrawer(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${drawerTab === t.id ? 'bg-white text-emerald-800 shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
          <button type="button" onClick={closeDrawer} className="ml-auto p-2 text-slate-400 hover:bg-slate-200 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {drawerTab === 'rules' && <RulesModal isOpen isEmbedded onClose={closeDrawer} />}
          {drawerTab === 'history' && <HistoryView />}
          {drawerTab === 'toolbox' && <ToolboxView />}
          {drawerTab === 'settings' && <SettingsView />}
        </div>
      </aside>
    </>
  );
};
