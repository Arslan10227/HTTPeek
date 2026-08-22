import { create } from 'zustand';
import { api } from './apiAdapter';
import {
  HttpRequest,
  HttpResponse,
  WsFrame,
  SSEEvent,
  BreakpointEvent,
  ProxyStatus,
  HostRule,
  BlockRule,
  RewriteRule,
  MockRule,
  CryptoRule,
  ScriptRule,
  BreakpointRule,
  ThrottleConfig,
  FilterConfig,
} from '../types';

export interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  isGlobal?: boolean;
  variables: EnvVariable[];
}

interface ProxyStore {
  // Runtime status
  status: ProxyStatus;
  setStatus: (status: ProxyStatus) => void;

  // Active view & navigation
  activeTab: 'requests' | 'favorites' | 'history' | 'toolbox' | 'settings' | 'capture' | 'rules' | 'interceptors';
  setActiveTab: (tab: 'requests' | 'favorites' | 'history' | 'toolbox' | 'settings' | 'capture' | 'rules' | 'interceptors') => void;

  viewMode: 'sequence' | 'tree';
  setViewMode: (mode: 'sequence' | 'tree') => void;

  // Traffic state
  requests: HttpRequest[];
  requestMap: Map<string, HttpRequest>;
  favorites: HttpRequest[];
  selectedRequestId: string | null;
  selectedRequest: HttpRequest | null;
  searchQuery: string;
  showFavoritesOnly: boolean;
  capturePaused: boolean;
  processFilter: string | null; // Phase 9-C: filter request list by process name

  maxRequests: number;
  setMaxRequests: (n: number) => void;

  // Environments
  environments: Environment[];
  activeEnvironmentId: string | null;
  setEnvironments: (envs: Environment[]) => void;
  setActiveEnvironment: (id: string | null) => void;
  setActiveEnvironmentId: (id: string | null) => void;
  renderTemplate: (text: string) => string;

  // Interceptor Rules State
  hostRules: HostRule[];
  setHostRules: (rules: HostRule[]) => void;

  blockRules: BlockRule[];
  setBlockRules: (rules: BlockRule[]) => void;

  rewriteRules: RewriteRule[];
  setRewriteRules: (rules: RewriteRule[]) => void;

  mockRules: MockRule[];
  setMockRules: (rules: MockRule[]) => void;

  cryptoRules: CryptoRule[];
  setCryptoRules: (rules: CryptoRule[]) => void;

  scripts: ScriptRule[];
  setScripts: (scripts: ScriptRule[]) => void;

  breakpointRules: BreakpointRule[];
  setBreakpointRules: (rules: BreakpointRule[]) => void;

  throttleConfig: ThrottleConfig;
  setThrottleConfig: (cfg: ThrottleConfig) => void;

  filterConfig: FilterConfig;
  setFilterConfig: (cfg: FilterConfig) => void;

  // Mobile Devices
  connectedMobileDevices: MobileDeviceInfo[];
  setConnectedMobileDevices: (devices: MobileDeviceInfo[]) => void;

  // Active External Interceptors
  activeInterceptors: ActiveInterceptorInfo[];
  addActiveInterceptor: (interceptor: ActiveInterceptorInfo) => void;
  removeActiveInterceptor: (idOrType: string) => void;
  clearActiveInterceptors: () => void;

  // Actions
  addRequest: (req: HttpRequest) => void;
  updateResponse: (resp: HttpResponse) => void;
  addWsFrame: (frame: WsFrame) => void;
  addSSEEvent: (event: SSEEvent) => void;
  selectRequest: (id: string | null) => void;
  setSelectedRequestId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowFavoritesOnly: (v: boolean) => void;
  setCapturePaused: (v: boolean) => void;
  setProcessFilter: (name: string | null) => void;
  setRequests: (requests: HttpRequest[]) => void;
  clearRequests: () => void;
  deleteRequest: (id: string) => void;
  removeRequest: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setFavorites: (favorites: HttpRequest[]) => void;

  // Breakpoint pause queue
  pausedBreakpoints: BreakpointEvent[];
  addBreakpoint: (event: BreakpointEvent) => void;
  removeBreakpoint: (requestId: string) => void;

  getFilteredRequests: () => HttpRequest[];
  selectNext: () => void;
  selectPrev: () => void;
}

export interface ActiveInterceptorInfo {
  id: string;
  type: 'adb' | 'frida' | 'browser' | 'jvm' | 'electron' | 'terminal' | 'system';
  name: string;
  target?: string;
  runId?: string;
  deviceSerial?: string;
}

export interface MobileDeviceInfo {
  deviceId: string;
  deviceName: string;
  osVersion: string;
  isRooted: boolean;
  remoteIp: string;
  connectedAt: string;
  lastPing: string;
  packetCount: number;
}

export const useProxyStore = create<ProxyStore>((set, get) => ({
  activeInterceptors: [],
  addActiveInterceptor: (interceptor) =>
    set((state) => ({
      activeInterceptors: [
        ...state.activeInterceptors.filter((i) => i.id !== interceptor.id),
        interceptor,
      ],
    })),
  removeActiveInterceptor: (idOrType) =>
    set((state) => ({
      activeInterceptors: state.activeInterceptors.filter(
        (i) => i.id !== idOrType && i.type !== idOrType && i.runId !== idOrType
      ),
    })),
  clearActiveInterceptors: () => set({ activeInterceptors: [] }),

  connectedMobileDevices: [],
  setConnectedMobileDevices: (connectedMobileDevices) => set({ connectedMobileDevices }),

  maxRequests: 10000,
  setMaxRequests: (maxRequests) => set({ maxRequests }),

  status: {
    running: false,
    port: 9099,
    sslEnabled: true,
    systemProxyEnabled: false,
    caInstalled: false,
    isCaInstalled: false,
  },
  setStatus: (status) => set({ status }),

  activeTab: 'interceptors',
  setActiveTab: (activeTab) => set({ activeTab }),

  viewMode: 'sequence',
  setViewMode: (viewMode) => set({ viewMode }),

  requests: [],
  requestMap: new Map(),
  favorites: [],
  selectedRequestId: null,
  selectedRequest: null,
  searchQuery: '',
  showFavoritesOnly: false,
  capturePaused: false,
  processFilter: null,

  environments: [
    {
      id: 'env-prod',
      name: 'Production',
      variables: [{ key: 'BASE_URL', value: 'https://api.example.com', enabled: true }],
    },
    {
      id: 'env-dev',
      name: 'Development',
      variables: [{ key: 'BASE_URL', value: 'http://localhost:8080', enabled: true }],
    },
  ],
  activeEnvironmentId: null,
  setEnvironments: (environments) => set({ environments }),
  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),
  renderTemplate: (text) => {
    const { environments, activeEnvironmentId } = get();
    if (!text || !activeEnvironmentId) return text;
    const env = environments.find((e) => e.id === activeEnvironmentId);
    if (!env) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const variable = env.variables.find((v) => v.enabled && v.key === key.trim());
      return variable ? variable.value : match;
    });
  },

  // Rule State initializers
  hostRules: [],
  setHostRules: (hostRules) => set({ hostRules }),

  blockRules: [],
  setBlockRules: (blockRules) => set({ blockRules }),

  rewriteRules: [],
  setRewriteRules: (rewriteRules) => set({ rewriteRules }),

  mockRules: [],
  setMockRules: (mockRules) => set({ mockRules }),

  cryptoRules: [],
  setCryptoRules: (cryptoRules) => set({ cryptoRules }),

  scripts: [],
  setScripts: (scripts) => set({ scripts }),

  breakpointRules: [],
  setBreakpointRules: (breakpointRules) => set({ breakpointRules }),

  throttleConfig: {
    enabled: false,
    profile: {
      name: 'Weak Network',
      latencyUpMs: 200,
      latencyDownMs: 200,
      kbpsUp: 300,
      kbpsDown: 300,
      packetLossRate: 0.15,
    },
  },
  setThrottleConfig: (throttleConfig) => set({ throttleConfig }),

  filterConfig: {
    mode: 'blacklist',
    rules: ['*.apple.com', '*.icloud.com'],
  },
  setFilterConfig: (filterConfig) => set({ filterConfig }),

  addRequest: (req) => {
    const { capturePaused, requests, requestMap, maxRequests } = get();
    if (capturePaused) return;
    const newMap = new Map(requestMap);
    newMap.set(req.id, req);
    let nextRequests = [req, ...requests];
    if (nextRequests.length > maxRequests) {
      nextRequests.slice(maxRequests).forEach((r) => newMap.delete(r.id));
      nextRequests = nextRequests.slice(0, maxRequests);
    }
    set({ requests: nextRequests, requestMap: newMap });
  },

  updateResponse: (resp) => {
    const { requestMap, requests, favorites, selectedRequestId } = get();
    const targetId = resp.id;
    if (!targetId) return;
    const req = requestMap.get(targetId);
    if (!req) return;
    const updatedReq: HttpRequest = { ...req, response: resp, durationMs: resp.durationMs };
    const newMap = new Map(requestMap);
    newMap.set(targetId, updatedReq);
    set({
      requests: requests.map((r) => (r.id === targetId ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === targetId ? updatedReq : r)),
      requestMap: newMap,
      selectedRequest: selectedRequestId === targetId ? updatedReq : get().selectedRequest,
    });
  },

  addWsFrame: (frame) => {
    const { requestMap, requests, favorites, selectedRequestId } = get();
    const targetId = frame.requestId;
    if (!targetId) return;
    const req = requestMap.get(targetId);
    if (!req) return;
    const updatedReq: HttpRequest = {
      ...req,
      wsFrames: [...(req.wsFrames || []), frame],
    };
    const newMap = new Map(requestMap);
    newMap.set(targetId, updatedReq);
    set({
      requestMap: newMap,
      requests: requests.map((r) => (r.id === targetId ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === targetId ? updatedReq : r)),
      selectedRequest: selectedRequestId === targetId ? updatedReq : get().selectedRequest,
    });
  },

  addSSEEvent: (event) => {
    const { requestMap, requests, favorites, selectedRequestId } = get();
    const targetId = event.requestId;
    if (!targetId) return;
    const req = requestMap.get(targetId);
    if (!req) return;
    const updatedReq: HttpRequest = {
      ...req,
      sseEvents: [...(req.sseEvents || []), event],
    };
    const newMap = new Map(requestMap);
    newMap.set(targetId, updatedReq);
    set({
      requestMap: newMap,
      requests: requests.map((r) => (r.id === targetId ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === targetId ? updatedReq : r)),
      selectedRequest: selectedRequestId === targetId ? updatedReq : get().selectedRequest,
    });
  },

  selectRequest: (id) => {
    if (!id) {
      set({ selectedRequestId: null, selectedRequest: null });
      return;
    }
    const { requestMap, favorites } = get();
    const req = requestMap.get(id) || favorites.find((f) => f.id === id) || null;
    set({ selectedRequestId: id, selectedRequest: req });
  },

  setSelectedRequestId: (id) => {
    if (!id) {
      set({ selectedRequestId: null, selectedRequest: null });
      return;
    }
    const { requestMap, favorites } = get();
    const req = requestMap.get(id) || favorites.find((f) => f.id === id) || null;
    set({ selectedRequestId: id, selectedRequest: req });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
  setCapturePaused: (capturePaused) => set({ capturePaused }),
  setProcessFilter: (processFilter) => set({ processFilter }),
  setRequests: (requests) => {
    const newMap = new Map<string, HttpRequest>();
    requests.forEach((r) => newMap.set(r.id, r));
    get().favorites.forEach((r) => newMap.set(r.id, r));
    set({ requests, requestMap: newMap, selectedRequestId: requests[0]?.id || null, selectedRequest: requests[0] || null });
  },

  clearRequests: () => {
    const newMap = new Map<string, HttpRequest>();
    get().favorites.forEach((r) => newMap.set(r.id, r));
    set({ requests: [], requestMap: newMap, selectedRequestId: null, selectedRequest: null });
  },
  deleteRequest: (id) => {
    const { requests, requestMap, favorites, selectedRequestId } = get();
    const req = requestMap.get(id) || requests.find((r) => r.id === id) || favorites.find((f) => f.id === id);
    const newMap = new Map(requestMap);
    newMap.delete(id);
    set({
      requests: requests.filter((r) => r.id !== id),
      favorites: favorites.filter((r) => r.id !== id),
      requestMap: newMap,
      selectedRequestId: selectedRequestId === id ? null : selectedRequestId,
      selectedRequest: selectedRequestId === id ? null : get().selectedRequest,
    });
    // If this request was a favorite, remove it permanently from the database
    // so it does not reappear on the next software launch.
    if (req?.isFavorite) {
      api.deleteFavorite(id).catch((err) => {
        console.error('Failed to permanently delete favorite from database:', err);
      });
    }
  },
  removeRequest: (id) => {
    const { requests, requestMap, favorites, selectedRequestId } = get();
    const newMap = new Map(requestMap);
    newMap.delete(id);
    set({
      requests: requests.filter((r) => r.id !== id),
      favorites: favorites.filter((r) => r.id !== id),
      requestMap: newMap,
      selectedRequestId: selectedRequestId === id ? null : selectedRequestId,
      selectedRequest: selectedRequestId === id ? null : get().selectedRequest,
    });
  },

  toggleFavorite: (id) => {
    const { requests, favorites, requestMap } = get();
    const req = requests.find((r) => r.id === id) || favorites.find((f) => f.id === id) || requestMap.get(id);
    if (!req) return;

    const isFav = !req.isFavorite;
    const nextRequests = requests.map((r) => (r.id === id ? { ...r, isFavorite: isFav } : r));

    let nextFavs = favorites;
    if (isFav) {
      if (!favorites.some((f) => f.id === id)) {
        nextFavs = [{ ...req, isFavorite: true }, ...favorites];
      }
    } else {
      nextFavs = favorites.filter((f) => f.id !== id);
    }

    // Persist to backend database so favorites survive software restarts
    api.toggleFavorite(id, isFav).catch((err) => {
      console.error('Failed to toggle favorite in database:', err);
    });

    set({ requests: nextRequests, favorites: nextFavs });
  },

  setFavorites: (favorites) => set({ favorites }),

  pausedBreakpoints: [],
  addBreakpoint: (event) => {
    set({ pausedBreakpoints: [...get().pausedBreakpoints, event] });
  },
  removeBreakpoint: (id) => {
    set({ pausedBreakpoints: get().pausedBreakpoints.filter((b) => b.id !== id && b.requestId !== id) });
  },

  getFilteredRequests: () => {
    const { requests, searchQuery } = get();
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((r) =>
      String(r.url || '').toLowerCase().includes(q) ||
      String(r.method || '').toLowerCase().includes(q) ||
      String(r.response?.statusCode || '').includes(q) ||
      String(r.response?.contentType || '').toLowerCase().includes(q) ||
      String(r.hostPort?.host || '').toLowerCase().includes(q) ||
      String(r.process?.name || '').toLowerCase().includes(q)
    );
  },

  selectNext: () => {
    const { requests, selectedRequestId } = get();
    if (requests.length === 0) return;
    const idx = requests.findIndex((r) => r.id === selectedRequestId);
    if (idx === -1 || idx === requests.length - 1) {
      set({ selectedRequestId: requests[0].id, selectedRequest: requests[0] });
    } else {
      set({ selectedRequestId: requests[idx + 1].id, selectedRequest: requests[idx + 1] });
    }
  },

  selectPrev: () => {
    const { requests, selectedRequestId } = get();
    if (requests.length === 0) return;
    const idx = requests.findIndex((r) => r.id === selectedRequestId);
    if (idx <= 0) {
      set({ selectedRequestId: requests[requests.length - 1].id, selectedRequest: requests[requests.length - 1] });
    } else {
      set({ selectedRequestId: requests[idx - 1].id, selectedRequest: requests[idx - 1] });
    }
  },
}));
