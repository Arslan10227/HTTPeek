import React, { useEffect, useState } from 'react';
import { useProxyStore } from '../../store/useProxyStore';
import { ColorfulIcon, IconName } from '../common/ColorfulIcon';
import { api } from '../../store/apiAdapter';

interface NavItem {
  id: 'capture' | 'favorites' | 'history' | 'rules' | 'toolbox' | 'settings';
  label: string;
  mobileLabel?: string;
  iconName: IconName;
  badge?: number;
  hideOnMobile?: boolean;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, requests, favorites } = useProxyStore();
  const [caInstalled, setCaInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    api.getCADetails().then((details) => {
      setCaInstalled(Boolean(details?.installed ?? details?.subject));
    }).catch(() => setCaInstalled(null));
  }, []);

  const navItems: NavItem[] = [
    { id: 'capture', label: 'Capture', mobileLabel: 'Capture', iconName: 'capture', badge: requests.length },
    { id: 'favorites', label: 'Favorites', mobileLabel: 'Saved', iconName: 'favorites', badge: favorites.length },
    { id: 'history', label: 'History', mobileLabel: 'History', iconName: 'history', hideOnMobile: true },
    { id: 'rules', label: 'Rules & Mock', mobileLabel: 'Rules', iconName: 'rules' },
    { id: 'toolbox', label: 'Toolbox', mobileLabel: 'Tools', iconName: 'toolbox', hideOnMobile: true },
    { id: 'settings', label: 'Settings', mobileLabel: 'Settings', iconName: 'settings' },
  ];

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex w-56 bg-slate-50 border-r border-slate-200 flex-col justify-between select-none shrink-0 font-sans">
        {/* Top: App Brand & Navigation */}
        <div>
          {/* Brand Header */}
          <div className="h-14 border-b border-slate-200 flex items-center px-4 gap-2.5 bg-white">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-500/20">
              H
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-1.5 truncate">
                <span>HTTPeek</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-bold">GO</span>
              </h1>
              <p className="text-[10px] text-slate-400 truncate">Traffic Proxy Interceptor</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-2.5 space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-emerald-950 font-bold shadow-sm border border-slate-200/80 translate-x-0.5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:translate-x-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ColorfulIcon name={item.iconName} size={18} animate={isActive && item.id === 'capture'} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ml-1.5 ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'
                    }`}>
                      {item.badge > 999 ? '999+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: CA Certificate Status Widget */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <ColorfulIcon name="shield-ssl" size={22} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-700 truncate">
                {caInstalled === null ? 'Checking CA…' : caInstalled ? 'Root CA Ready' : 'Root CA Not Installed'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {caInstalled ? 'HTTPS decryption available' : 'Install CA for HTTPS inspection'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (<768px Viewports / Android App) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1 px-1 flex justify-around items-center shadow-lg pb-[env(safe-area-inset-bottom)]">
        {navItems.filter((item) => !item.hideOnMobile).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] p-1.5 rounded-lg transition-colors relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <ColorfulIcon name={item.iconName} size={20} animate={isActive && item.id === 'capture'} />
              <span className="text-[9px] mt-0.5 leading-tight text-center">{item.mobileLabel || item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.2 rounded-full text-[8px] font-mono font-bold bg-emerald-600 text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
