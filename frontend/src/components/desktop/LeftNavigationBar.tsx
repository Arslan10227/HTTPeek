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
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { PreferenceDialog } from './PreferenceDialog';
import { useAppConfig } from '../../theme/useAppConfig';

import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { User, Bell } from 'lucide-react';

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
  const { t, language } = useTranslation();
  const { getActiveColorPreset, themeMode, setThemeMode, getEffectiveIsDark } = useAppConfig();
  const { toggleDrawer, unreadCount } = useNotificationStore();
  const { user, openAuthModal } = useAuthStore();
  const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const activeColor = getActiveColorPreset();
  const isDark = getEffectiveIsDark();

  const navItems: { id: LeftNavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'interceptors', label: 'Intercept', icon: <Rocket className="w-[18px] h-[18px]" /> },
    { id: 'requests', label: 'View', icon: <LayoutGrid className="w-[18px] h-[18px]" />, badge: requestCount > 0 ? requestCount : undefined },
    { id: 'rules', label: 'Mock', icon: <Sliders className="w-[18px] h-[18px]" /> },
    { id: 'favorites', label: t.favorites, icon: <Heart className="w-[18px] h-[18px]" /> },
    { id: 'history', label: t.history, icon: <HistoryIcon className="w-[18px] h-[18px]" /> },
    { id: 'toolbox', label: t.toolbox, icon: <Wrench className="w-[18px] h-[18px]" /> },
  ];

  const bottomActions = [
    {
      key: 'auth',
      icon: user?.photoURL ? (
        <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full border border-emerald-500 shadow-xs" />
      ) : (
        <User className="w-4 h-4" />
      ),
      label: user ? user.displayName || 'Google Account' : 'Sign In with Google',
      onClick: openAuthModal,
      colorClass: user ? 'text-emerald-500' : 'text-gray-400',
    },
    {
      key: 'notifications',
      icon: (
        <div className="relative flex items-center justify-center">
          <Bell className="w-4 h-4" />
          {unreadCount() > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </div>
      ),
      label: `Notifications ${unreadCount() > 0 ? `(${unreadCount()})` : ''}`,
      onClick: toggleDrawer,
      colorClass: unreadCount() > 0 ? 'text-emerald-500' : '',
    },
    {
      key: 'theme',
      icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      label: isDark ? 'Light Mode' : 'Dark Mode',
      onClick: () => setThemeMode(isDark ? 'light' : 'dark'),
      colorClass: 'text-amber-500',
    },
    ...(onOpenDocs
      ? [{
          key: 'docs',
          icon: <BookOpen className="w-4 h-4" />,
          label: 'Docs (F1)',
          onClick: onOpenDocs,
          colorClass: 'text-blue-400',
        }]
      : []),
    {
      key: 'settings',
      icon: <SettingsIcon className="w-4 h-4" />,
      label: 'Settings',
      onClick: () => setIsPreferenceOpen(true),
      colorClass: '',
    },
    {
      key: 'feedback',
      icon: <MessageSquare className="w-4 h-4" />,
      label: 'Feedback',
      onClick: () => window.open('https://github.com/Arslan10227/HTTPeek/issues', '_blank'),
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
                    backgroundColor: isActive ? 'rgba(0, 229, 163, 0.12)' : 'transparent',
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
                      className="absolute left-0 inset-y-1/4 w-[3px] rounded-r-full animate-nav-indicator"
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
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 text-[9px] font-bold px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: activeColor.hex, color: '#0a2e1e' }}
                    >
                      {item.badge > 999 ? '999+' : item.badge}
                    </span>
                  )}
                </button>

                {/* Collapsed tooltip */}
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
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className="ml-1.5 px-1 rounded-full text-[9px]"
                        style={{ backgroundColor: activeColor.hex, color: '#0a2e1e' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Collapse / Expand Toggle ─────────────────────────── */}
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
        <div className="flex flex-col items-center gap-0.5 pb-1 w-full">
          {bottomActions.map((action) => (
            <div key={action.key} className="group relative w-full flex justify-center">
              <button
                type="button"
                onClick={action.onClick}
                className="btn-icon"
                title={action.label}
                style={{ color: action.colorClass ? undefined : 'var(--color-text-subtle)' }}
              >
                <span className={action.colorClass}>{action.icon}</span>
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
    </>
  );
};
