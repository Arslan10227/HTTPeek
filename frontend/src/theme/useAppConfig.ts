import { create } from 'zustand';
import { ColorMapping, ColorPreset } from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppConfigState {
  themeMode: ThemeMode;
  useMaterial3: boolean;
  themeColor: string;
  panelRatio: number;
  autoStartup: boolean;
  clearConfirm: boolean;
  minimizeToTray: boolean;
  memoryCleanupThreshold: number | null;
  headerViewMode: 'table' | 'text';
  enableSocks5: boolean;
  enabledHttp2: boolean;
  proxyPassDomains: string;
  confirmOnClose: boolean;
  domainListDefaultCollapsed: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setUseMaterial3: (use: boolean) => void;
  setThemeColor: (colorName: string) => void;
  setPanelRatio: (ratio: number) => void;
  setAutoStartup: (auto: boolean) => void;
  setClearConfirm: (confirm: boolean) => void;
  setMinimizeToTray: (minimize: boolean) => void;
  setMemoryCleanupThreshold: (threshold: number | null) => void;
  setHeaderViewMode: (mode: 'table' | 'text') => void;
  setEnableSocks5: (enable: boolean) => void;
  setEnabledHttp2: (enable: boolean) => void;
  setProxyPassDomains: (domains: string) => void;
  setConfirmOnClose: (confirm: boolean) => void;
  setDomainListDefaultCollapsed: (v: boolean) => void;
  
  getActiveColorPreset: () => ColorPreset;
  getEffectiveIsDark: () => boolean;
}

export const useAppConfig = create<AppConfigState>((set, get) => {
  const savedThemeMode = (localStorage.getItem('proxypin_themeMode') as ThemeMode) || 'dark';
  const savedUseMaterial3 = localStorage.getItem('proxypin_useMaterial3') !== 'false';
  const savedThemeColor = localStorage.getItem('proxypin_themeColor') || 'Teal';

  const savedPanelRatio = parseFloat(localStorage.getItem('proxypin_panelRatio') || '0.35');
  const savedAutoStartup = localStorage.getItem('proxypin_autoStartup') === 'true';
  const savedClearConfirm = localStorage.getItem('proxypin_clearConfirm') === 'true';
  const savedMinimizeToTray = localStorage.getItem('proxypin_minimizeToTray') === 'true';
  const savedThreshold = localStorage.getItem('proxypin_memoryCleanup') ? parseInt(localStorage.getItem('proxypin_memoryCleanup')!, 10) : null;
  const savedHeaderMode = (localStorage.getItem('proxypin_headerViewMode') as 'table' | 'text') || 'table';
  const savedProxyPass = localStorage.getItem('proxypin_proxyPassDomains') || 'localhost;127.0.0.1;';
  const savedConfirmOnClose = localStorage.getItem('httpeek_confirmOnClose') !== 'false';
  const savedHttp2 = localStorage.getItem('httpeek_enabledHttp2') !== 'false';
  const savedDomainCollapsed = localStorage.getItem('httpeek_domainListDefaultCollapsed') === 'true';

  return {
    themeMode: savedThemeMode,
    useMaterial3: savedUseMaterial3,
    themeColor: savedThemeColor,
    panelRatio: savedPanelRatio,
    autoStartup: savedAutoStartup,
    clearConfirm: savedClearConfirm,
    minimizeToTray: savedMinimizeToTray,
    memoryCleanupThreshold: savedThreshold,
    headerViewMode: savedHeaderMode,
    enableSocks5: false,
    enabledHttp2: savedHttp2,
    proxyPassDomains: savedProxyPass,
    confirmOnClose: savedConfirmOnClose,
    domainListDefaultCollapsed: savedDomainCollapsed,

    setThemeMode: (mode) => {
      localStorage.setItem('proxypin_themeMode', mode);
      set({ themeMode: mode });
    },
    setUseMaterial3: (use) => {
      localStorage.setItem('proxypin_useMaterial3', String(use));
      set({ useMaterial3: use });
    },
    setThemeColor: (colorName) => {
      localStorage.setItem('proxypin_themeColor', colorName);
      set({ themeColor: colorName });
    },
    setPanelRatio: (ratio) => {
      localStorage.setItem('proxypin_panelRatio', String(ratio));
      set({ panelRatio: ratio });
    },
    setAutoStartup: (auto) => {
      localStorage.setItem('proxypin_autoStartup', String(auto));
      set({ autoStartup: auto });
    },
    setClearConfirm: (confirm) => {
      localStorage.setItem('proxypin_clearConfirm', String(confirm));
      set({ clearConfirm: confirm });
    },
    setMinimizeToTray: (minimize) => {
      localStorage.setItem('proxypin_minimizeToTray', String(minimize));
      set({ minimizeToTray: minimize });
    },
    setMemoryCleanupThreshold: (threshold) => {
      if (threshold === null) {
        localStorage.removeItem('proxypin_memoryCleanup');
      } else {
        localStorage.setItem('proxypin_memoryCleanup', String(threshold));
      }
      set({ memoryCleanupThreshold: threshold });
    },
    setHeaderViewMode: (mode) => {
      localStorage.setItem('proxypin_headerViewMode', mode);
      set({ headerViewMode: mode });
    },
    setEnableSocks5: (enable) => set({ enableSocks5: enable }),
    setEnabledHttp2: (enable) => {
      localStorage.setItem('httpeek_enabledHttp2', String(enable));
      set({ enabledHttp2: enable });
    },
    setProxyPassDomains: (domains) => {
      localStorage.setItem('proxypin_proxyPassDomains', domains);
      set({ proxyPassDomains: domains });
    },
    setConfirmOnClose: (confirm) => {
      localStorage.setItem('httpeek_confirmOnClose', String(confirm));
      set({ confirmOnClose: confirm });
    },
    setDomainListDefaultCollapsed: (v) => {
      localStorage.setItem('httpeek_domainListDefaultCollapsed', String(v));
      set({ domainListDefaultCollapsed: v });
    },

    getActiveColorPreset: () => {
      const { themeColor } = get();
      return ColorMapping[themeColor] || ColorMapping.Pink;
    },

    getEffectiveIsDark: () => {
      const { themeMode } = get();
      if (themeMode === 'dark') return true;
      if (themeMode === 'light') return false;
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    },
  };
});
