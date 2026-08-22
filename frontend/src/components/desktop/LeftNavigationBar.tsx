import React, { useState } from 'react';
import {
  LayoutGrid,
  Heart,
  History as HistoryIcon,
  Wrench,
  Settings as SettingsIcon,
  MessageSquare,
  BookOpen,
  Rocket,
  Sliders,
  Sun,
  Moon,
  ChevronRight,
  User,
  Bell,
  Info,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { PreferenceDialog } from './PreferenceDialog';
import { AboutDialog } from './AboutDialog';
import { useAppConfig } from '../../theme/useAppConfig';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';

export type LeftNavTab = 'interceptors' | 'requests' | 'rules' | 'favorites' | 'history' | 'toolbox';

interface LeftNavigationBarProps {
  activeTab: LeftNavTab;
  onTabChange: (tab: LeftNavTab) => void;
  requestCount?: number;
  onOpenDocs?: () => void;
}

export const LeftNavigationBar: React.FC<LeftNavigationBarProps> = ({
  activeTab,
  onTabChange,
  requestCount = 0,
  onOpenDocs,
}) => {
  const { t } = useTranslation();
  const { getActiveColorPreset, themeMode, setThemeMode, getEffectiveIsDark } = useAppConfig();
  const { toggleDrawer, unreadCount } = useNotificationStore();
  const { user, openAuthModal } = useAuthStore();
  const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const activeColor = getActiveColorPreset();
  const isDark = getEffectiveIsDark();

  const navItems: {
    id: LeftNavTab;
    label: string;
    icon: React.ReactNode;
    color: string;
    badge?: number;
  }[] = [
    {
      id: 'interceptors',
      label: 'Intercept',
      icon: (
        <Rocket className="w-[19px] h-[19px] text-amber-500 transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-12 group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(245,158,11,0.4)]" />
      ),
      color: '#F59E0B',
    },
    {
      id: 'requests',
      label: 'Traffic',
      icon: (
        <LayoutGrid className="w-[19px] h-[19px] text-emerald-500 transition-all duration-300 group-hover:scale-115 group-hover:rotate-3 drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]" />
      ),
      color: '#10B981',
      badge: requestCount > 0 ? requestCount : undefined,
    },
    {
      id: 'rules',
      label: 'Mock',
      icon: (
        <Sliders className="w-[19px] h-[19px] text-cyan-500 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(6,182,212,0.4)]" />
      ),
      color: '#06B6D4',
    },
    {
      id: 'favorites',
      label: t.favorites,
      icon: (
        <Heart className="w-[19px] h-[19px] text-rose-500 transition-all duration-300 group-hover:scale-125 group-hover:animate-pulse drop-shadow-[0_2px_8px_rgba(244,63,94,0.4)]" />
      ),
      color: '#F43F5E',
    },
    {
      id: 'history',
      label: t.history,
      icon: (
        <HistoryIcon className="w-[19px] h-[19px] text-purple-500 transition-all duration-300 group-hover:-rotate-45 group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(168,85,247,0.4)]" />
      ),
      color: '#A855F7',
    },
    {
      id: 'toolbox',
      label: t.toolbox,
      icon: (
        <Wrench className="w-[19px] h-[19px] text-indigo-500 transition-all duration-300 group-hover:rotate-45 group-hover:scale-110 drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]" />
      ),
      color: '#6366F1',
    },
  ];

  const bottomActions = [
    {
      key: 'auth',
      icon: user?.photoURL ? (
        <img
          src={user.photoURL}
          alt="Avatar"
          className="w-5 h-5 rounded-full border-2 border-emerald-500 shadow-sm transition-transform duration-300 hover:scale-115"
        />
      ) : (
        <div className="p-1 rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/30 transition-transform duration-300 group-hover:scale-115">
          <User className="w-3.5 h-3.5" />
        </div>
      ),
      label: user ? user.displayName || 'Google Account' : 'Sign In with Google',
      onClick: openAuthModal,
      colorClass: '',
    },
    {
      key: 'notifications',
      icon: (
        <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:rotate-12 group-hover:scale-115">
          <Bell className="w-4 h-4 text-amber-500" />
          {unreadCount() > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-white dark:ring-gray-900" />
          )}
        </div>
      ),
      label: `Notifications ${unreadCount() > 0 ? `(${unreadCount()})` : ''}`,
      onClick: toggleDrawer,
      colorClass: '',
    },
    {
      key: 'theme',
      icon: isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-all duration-500 group-hover:rotate-90 group-hover:scale-115 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400 transition-all duration-500 group-hover:-rotate-12 group-hover:scale-115 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      ),
      label: isDark ? 'Light Mode' : 'Dark Mode',
      onClick: () => setThemeMode(isDark ? 'light' : 'dark'),
      colorClass: '',
    },
    ...(onOpenDocs
      ? [
          {
            key: 'docs',
            icon: <BookOpen className="w-4 h-4 text-sky-400 transition-all duration-300 group-hover:scale-115" />,
            label: 'Docs (F1)',
            onClick: onOpenDocs,
            colorClass: '',
          },
        ]
      : []),
    {
      key: 'settings',
      icon: (
        <SettingsIcon className="w-4 h-4 text-slate-400 dark:text-slate-300 transition-all duration-500 group-hover:rotate-180 group-hover:scale-115" />
      ),
      label: 'Settings',
      onClick: () => setIsPreferenceOpen(true),
      colorClass: '',
    },
    {
      key: 'feedback',
      icon: (
        <MessageSquare className="w-4 h-4 text-fuchsia-400 transition-all duration-300 group-hover:scale-115 group-hover:-translate-y-0.5" />
      ),
      label: 'Feedback',
      onClick: () => window.open('https://github.com/Arslan10227/HTTPeek/issues', '_blank'),
      colorClass: '',
    },
    {
      key: 'about',
      icon: (
        <Info className="w-4 h-4 text-cyan-400 transition-all duration-300 group-hover:scale-120 group-hover:rotate-12" />
      ),
      label: 'About HTTPeek',
      onClick: () => setIsAboutOpen(true),
      colorClass: '',
    },
  ];

  const sidebarWidth = collapsed ? 'w-12' : 'w-[76px]';

  return (
    <>
      <div
        className={`flex flex-col items-center justify-between py-2 border-r select-none shrink-0 transition-[width] duration-200 relative ${sidebarWidth}`}
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {/* ── Nav Items ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-0.5 w-full pt-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="group relative w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all rounded-xl mx-1
                    ${collapsed ? 'w-9 h-9' : 'w-[58px] py-2'}`}
                  style={{
                    color: isActive ? activeColor.hex : 'var(--color-text-muted)',
                    backgroundColor: isActive ? `${activeColor.hex}18` : 'transparent',
                    boxShadow: isActive ? `0 0 12px ${activeColor.hex}25` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)';
                    if (!isActive) e.currentTarget.style.color = 'var(--color-text)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    if (!isActive) e.currentTarget.style.color = 'var(--color-text-muted)';
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <span
                      className="absolute left-0 inset-y-1/4 w-[3px] rounded-r-full animate-nav-indicator shadow-sm"
                      style={{ backgroundColor: activeColor.hex, height: '50%', top: '25%' }}
                    />
                  )}

                  <div className="flex items-center justify-center">
                    {item.icon}
                  </div>

                  {!collapsed && (
                    <span
                      className="text-[10px] font-bold leading-tight text-center"
                      style={{ color: isActive ? activeColor.hex : 'var(--color-text-muted)' }}
                    >
                      {item.label}
                    </span>
                  )}

                  {/* Badge */}
                  {item.badge !== undefined && (
                    <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold flex items-center justify-center leading-none shadow-xs">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>

                {/* Tooltip on collapse */}
                {collapsed && (
                  <div
                    className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-text)',
                      boxShadow: 'var(--shadow-md)',
                      border: '1px solid var(--color-border-strong)',
                    }}
                  >
                    {item.label}
                    {item.badge !== undefined && ` (${item.badge})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Collapse Toggle ─────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="btn-icon mb-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ color: 'var(--color-text-subtle)' }}
        >
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </button>

        {/* ── Bottom Actions ───────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 pb-1 w-full">
          {bottomActions.map((action) => (
            <div key={action.key} className="group relative w-full flex justify-center">
              <button
                type="button"
                onClick={action.onClick}
                className="btn-icon transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                title={action.label}
                style={{ color: action.colorClass ? undefined : 'var(--color-text-subtle)' }}
              >
                <span>{action.icon}</span>
              </button>

              {collapsed && (
                <div
                  className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text)',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--color-border-strong)',
                  }}
                >
                  {action.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isPreferenceOpen && (
        <PreferenceDialog onClose={() => setIsPreferenceOpen(false)} />
      )}

      {isAboutOpen && (
        <AboutDialog onClose={() => setIsAboutOpen(false)} />
      )}
    </>
  );
};
