import React, { useState } from 'react';
import {
  LayoutGrid,
  Heart,
  History as HistoryIcon,
  Wrench,
  Settings as SettingsIcon,
  MessageSquare,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { PreferenceDialog } from './PreferenceDialog';
import { useAppConfig } from '../../theme/useAppConfig';

export type LeftNavTab = 'requests' | 'favorites' | 'history' | 'toolbox';

interface LeftNavigationBarProps {
  activeTab: LeftNavTab;
  onTabChange: (tab: LeftNavTab) => void;
  requestCount?: number;
}

export const LeftNavigationBar: React.FC<LeftNavigationBarProps> = ({
  activeTab,
  onTabChange,
  requestCount = 0,
}) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');
  const barWidth = isZh ? 'w-[64px]' : 'w-[72px]';

  const navItems: { id: LeftNavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'requests',
      label: t.requests,
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      id: 'favorites',
      label: t.favorites,
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'history',
      label: t.history,
      icon: <HistoryIcon className="w-5 h-5" />,
    },
    {
      id: 'toolbox',
      label: t.toolbox,
      icon: <Wrench className="w-5 h-5" />,
    },
  ];

  return (
    <>
      <div
        className={`flex flex-col items-center justify-between py-2 border-r select-none shrink-0 ${barWidth}`}
        style={{
          borderColor: 'var(--md-sys-color-divider)',
          backgroundColor: 'var(--md-sys-color-surface)',
        }}
      >
        {/* Top Navigation Destinations */}
        <div className="flex flex-col items-center gap-1 w-full pt-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className="flex flex-col items-center justify-center w-[54px] py-1.5 rounded-xl cursor-pointer transition-all relative group"
                style={{
                  color: isActive ? activeColor.hex : 'var(--md-sys-color-on-surface-variant)',
                  backgroundColor: isActive
                    ? 'rgba(0, 0, 0, 0.06)'
                    : 'transparent',
                }}
                title={item.label}
              >
                <div
                  className="p-1 rounded-full transition-colors flex items-center justify-center"
                  style={{
                    backgroundColor: isActive ? activeColor.primaryContainer : 'transparent',
                    color: isActive ? activeColor.onPrimaryContainer : 'inherit',
                  }}
                >
                  {item.icon}
                </div>
                <span className="text-[11px] mt-0.5 font-medium leading-tight">
                  {item.label}
                </span>

                {item.id === 'requests' && requestCount > 0 && (
                  <span
                    className="absolute top-1 right-2 text-[9px] font-bold px-1 rounded-full text-white"
                    style={{ backgroundColor: activeColor.hex }}
                  >
                    {requestCount > 999 ? '999+' : requestCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Actions: Preferences & Feedback */}
        <div className="flex flex-col items-center gap-2 pb-1 w-full">
          <button
            type="button"
            onClick={() => setIsPreferenceOpen(true)}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            title={t.preference}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <a
            href="https://github.com/Arslan10227/HTTPeek/issues"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            title={t.feedback}
          >
            <MessageSquare className="w-5 h-5" />
          </a>
        </div>
      </div>

      {isPreferenceOpen && (
        <PreferenceDialog onClose={() => setIsPreferenceOpen(false)} />
      )}
    </>
  );
};
