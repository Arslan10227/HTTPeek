import { create } from 'zustand';

export type SidebarTab = 'view' | 'rules' | 'history' | 'toolbox' | 'settings';
export type ToolsDrawerTab = 'rules' | 'history' | 'toolbox' | 'settings' | null;
export type ViewListMode = 'list' | 'tree';

interface UiStore {
  sidebarTab: SidebarTab;
  drawerOpen: boolean;
  drawerTab: ToolsDrawerTab;
  viewListMode: ViewListMode;
  isMobile: boolean;

  setSidebarTab: (tab: SidebarTab) => void;
  openDrawer: (tab: ToolsDrawerTab) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: ToolsDrawerTab) => void;
  setViewListMode: (mode: ViewListMode) => void;
  setIsMobile: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarTab: 'view',
  drawerOpen: false,
  drawerTab: null,
  viewListMode: 'list',
  isMobile: false,

  setSidebarTab: (sidebarTab) => set({ sidebarTab, drawerOpen: false, drawerTab: null }),
  openDrawer: (tab) => set({ drawerOpen: true, drawerTab: tab, sidebarTab: tab || 'view' }),
  closeDrawer: () => set({ drawerOpen: false, drawerTab: null }),
  setDrawerTab: (drawerTab) => set({ drawerTab, drawerOpen: drawerTab !== null }),
  setViewListMode: (viewListMode) => set({ viewListMode }),
  setIsMobile: (isMobile) => set({ isMobile }),
}));
