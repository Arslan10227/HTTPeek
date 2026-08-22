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
  const getStored = (key: string, legacyKey: string, fallback: string): string => {
    return localStorage.getItem(key) || localStorage.getItem(legacyKey) || fallback;
  };

  const savedThemeMode = (getStored('httpeek_themeMode', 'proxypin_themeMode', 'dark') as ThemeMode);
  const savedUseMaterial3 = getStored('httpeek_useMaterial3', 'proxypin_useMaterial3', 'true') !== 'false';
  const savedThemeColor = getStored('httpeek_themeColor', 'proxypin_themeColor', 'Teal');

  const savedPanelRatio = parseFloat(getStored('httpeek_panelRatio', 'proxypin_panelRatio', '0.35'));
  const savedAutoStartup = getStored('httpeek_autoStartup', 'proxypin_autoStartup', 'false') === 'true';
  const savedClearConfirm = getStored('httpeek_clearConfirm', 'proxypin_clearConfirm', 'false') === 'true';
  const savedMinimizeToTray = getStored('httpeek_minimizeToTray', 'proxypin_minimizeToTray', 'false') === 'true';
  const savedThresholdVal = getStored('httpeek_memoryCleanup', 'proxypin_memoryCleanup', '');
  const savedThreshold = savedThresholdVal ? parseInt(savedThresholdVal, 10) : null;
  const savedHeaderMode = (getStored('httpeek_headerViewMode', 'proxypin_headerViewMode', 'table') as 'table' | 'text');
  const savedProxyPass = getStored('httpeek_proxyPassDomains', 'proxypin_proxyPassDomains', 'localhost;127.0.0.1;');
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
      localStorage.setItem('httpeek_themeMode', mode);
      set({ themeMode: mode });
    },
    setUseMaterial3: (use) => {
      localStorage.setItem('httpeek_useMaterial3', String(use));
      set({ useMaterial3: use });
    },
    setThemeColor: (colorName) => {
      localStorage.setItem('httpeek_themeColor', colorName);
      set({ themeColor: colorName });
    },
    setPanelRatio: (ratio) => {
      localStorage.setItem('httpeek_panelRatio', String(ratio));
      set({ panelRatio: ratio });
    },
    setAutoStartup: (auto) => {
      localStorage.setItem('httpeek_autoStartup', String(auto));
      set({ autoStartup: auto });
    },
    setClearConfirm: (confirm) => {
      localStorage.setItem('httpeek_clearConfirm', String(confirm));
      set({ clearConfirm: confirm });
    },
    setMinimizeToTray: (minimize) => {
      localStorage.setItem('httpeek_minimizeToTray', String(minimize));
      set({ minimizeToTray: minimize });
    },
    setMemoryCleanupThreshold: (threshold) => {
      if (threshold === null) {
        localStorage.removeItem('httpeek_memoryCleanup');
      } else {
        localStorage.setItem('httpeek_memoryCleanup', String(threshold));
      }
      set({ memoryCleanupThreshold: threshold });
    },
    setHeaderViewMode: (mode) => {
      localStorage.setItem('httpeek_headerViewMode', mode);
      set({ headerViewMode: mode });
    },
    setEnableSocks5: (enable) => set({ enableSocks5: enable }),
    setEnabledHttp2: (enable) => {
      localStorage.setItem('httpeek_enabledHttp2', String(enable));
      set({ enabledHttp2: enable });
    },
    setProxyPassDomains: (domains) => {
      localStorage.setItem('httpeek_proxyPassDomains', domains);
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
