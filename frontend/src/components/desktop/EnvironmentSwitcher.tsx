import React, { useState, useRef, useEffect } from 'react';
import { Layers, Check, Plus, Settings } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';

interface EnvironmentSwitcherProps {
  onManageEnvironments: () => void;
}

export const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({
  onManageEnvironments,
}) => {
  const { environments, activeEnvironmentId, setActiveEnvironment } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeColor = getActiveColorPreset();

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
        title="Environment Switcher"
      >
        <Layers className="w-3.5 h-3.5" style={{ color: activeColor.hex }} />
        <span className="max-w-[80px] truncate">{activeEnv?.name || 'No Env'}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-48 rounded-xl shadow-xl py-1 border z-50 text-xs flex flex-col animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveEnvironment('');
              setIsOpen(false);
            }}
            className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <span>No Environment</span>
            {!activeEnvironmentId && <Check className="w-3.5 h-3.5 text-green-500" />}
          </button>

          {environments.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => {
                setActiveEnvironment(env.id);
                setIsOpen(false);
              }}
              className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer truncate"
            >
              <span className="truncate">{env.name}</span>
              {activeEnvironmentId === env.id && (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              )}
            </button>
          ))}

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onManageEnvironments();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage Environments</span>
          </button>
        </div>
      )}
    </div>
  );
};
