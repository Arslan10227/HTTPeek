import { create } from 'zustand';
import { HttpRequest, HttpResponse, WsFrame, SSEEvent, BreakpointEvent, ProxyStatus } from '../types';
import { matchesFilter } from '../lib/httpFormat';

interface TrafficStore {
  status: ProxyStatus;
  setStatus: (status: ProxyStatus) => void;

  requests: HttpRequest[];
  requestMap: Map<string, HttpRequest>;
  favorites: HttpRequest[];
  selectedRequestId: string | null;
  selectedRequest: HttpRequest | null;

  searchQuery: string;
  showFavoritesOnly: boolean;
  capturePaused: boolean;

  maxRequests: number;
  setMaxRequests: (n: number) => void;

  addRequest: (req: HttpRequest) => void;
  updateResponse: (resp: HttpResponse) => void;
  addWsFrame: (frame: WsFrame) => void;
  addSSEEvent: (event: SSEEvent) => void;
  selectRequest: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowFavoritesOnly: (v: boolean) => void;
  setCapturePaused: (v: boolean) => void;
  clearRequests: () => void;
  deleteRequest: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setFavorites: (favorites: HttpRequest[]) => void;

  pausedBreakpoints: BreakpointEvent[];
  addBreakpoint: (event: BreakpointEvent) => void;
  removeBreakpoint: (requestId: string) => void;

  getFilteredRequests: () => HttpRequest[];
  selectNext: () => void;
  selectPrev: () => void;
}

export const useTrafficStore = create<TrafficStore>((set, get) => ({
  status: { running: false, port: 9099, enableSsl: true, systemProxy: false },
  setStatus: (status) => set({ status }),

  requests: [],
  requestMap: new Map(),
  favorites: [],
  selectedRequestId: null,
  selectedRequest: null,
  searchQuery: '',
  showFavoritesOnly: false,
  capturePaused: false,

  maxRequests: (() => {
    if (typeof localStorage === 'undefined') return 10000;
    const saved = parseInt(localStorage.getItem('httpeek_max_requests') || '10000', 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 10000;
  })(),
  setMaxRequests: (maxRequests) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('httpeek_max_requests', String(maxRequests));
    set({ maxRequests });
  },

  addRequest: (req) => {
    if (get().capturePaused) return;
    const { requests, requestMap, maxRequests } = get();
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
    if (!resp.id) return;
    const { requests, requestMap, favorites, selectedRequestId } = get();
    const req = requestMap.get(resp.id);
    if (!req) return;
    const updatedReq: HttpRequest = { ...req, response: resp, durationMs: resp.durationMs };
    const newMap = new Map(requestMap);
    newMap.set(resp.id, updatedReq);
    set({
      requests: requests.map((r) => (r.id === resp.id ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === resp.id ? updatedReq : r)),
      requestMap: newMap,
      selectedRequest: selectedRequestId === resp.id ? updatedReq : get().selectedRequest,
    });
  },

  addWsFrame: (frame) => {
    if (!frame.requestId) return;
    const { requestMap, selectedRequestId, requests, favorites } = get();
    const req = requestMap.get(frame.requestId);
    if (!req?.response) return;
    const updatedReq: HttpRequest = {
      ...req,
      response: { ...req.response, wsFrames: [...(req.response.wsFrames || []), frame] },
    };
    const newMap = new Map(requestMap);
    newMap.set(frame.requestId, updatedReq);
    set({
      requestMap: newMap,
      requests: requests.map((r) => (r.id === frame.requestId ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === frame.requestId ? updatedReq : r)),
      selectedRequest: selectedRequestId === frame.requestId ? updatedReq : get().selectedRequest,
    });
  },

  addSSEEvent: (event) => {
    if (!event.requestId) return;
    const { requestMap, selectedRequestId, requests, favorites } = get();
    const req = requestMap.get(event.requestId);
    if (!req?.response) return;
    const updatedReq: HttpRequest = {
      ...req,
      response: { ...req.response, sseEvents: [...(req.response.sseEvents || []), event] },
    };
    const newMap = new Map(requestMap);
    newMap.set(event.requestId, updatedReq);
    set({
      requestMap: newMap,
      requests: requests.map((r) => (r.id === event.requestId ? updatedReq : r)),
      favorites: favorites.map((r) => (r.id === event.requestId ? updatedReq : r)),
      selectedRequest: selectedRequestId === event.requestId ? updatedReq : get().selectedRequest,
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

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
  setCapturePaused: (capturePaused) => set({ capturePaused }),

  clearRequests: () => {
    const newMap = new Map<string, HttpRequest>();
    get().favorites.forEach((r) => newMap.set(r.id, r));
    set({ requests: [], requestMap: newMap, selectedRequestId: null, selectedRequest: null });
  },

  deleteRequest: (id) => {
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

  setFavorites: (favorites) => {
    const newMap = new Map(get().requestMap);
    favorites.forEach((f) => newMap.set(f.id, f));
    set({ favorites, requestMap: newMap });
  },

  toggleFavorite: (id) => {
    const { requests, favorites, requestMap } = get();
    const req = requestMap.get(id) || requests.find((r) => r.id === id) || favorites.find((f) => f.id === id);
    if (!req) return;
    const nextFav = !req.isFavorite;
    const updated = { ...req, isFavorite: nextFav };
    const newMap = new Map(requestMap);
    newMap.set(id, updated);
    const nextFavorites = nextFav
      ? [updated, ...favorites.filter((f) => f.id !== id)]
      : favorites.filter((f) => f.id !== id);
    if ((window as any).go?.main?.App?.ToggleFavoriteRequest) {
      (window as any).go.main.App.ToggleFavoriteRequest(id, nextFav);
    }
    set({
      requests: requests.map((r) => (r.id === id ? updated : r)),
      favorites: nextFavorites,
      requestMap: newMap,
      selectedRequest: get().selectedRequestId === id ? updated : get().selectedRequest,
    });
  },

  pausedBreakpoints: [],
  addBreakpoint: (event) => set({ pausedBreakpoints: [...get().pausedBreakpoints, event] }),
  removeBreakpoint: (requestId) =>
    set({ pausedBreakpoints: get().pausedBreakpoints.filter((b) => b.requestId !== requestId) }),

  getFilteredRequests: () => {
    const { requests, favorites, showFavoritesOnly, searchQuery } = get();
    const source = showFavoritesOnly ? favorites : requests;
    return source.filter((r) => matchesFilter(r, searchQuery));
  },

  selectNext: () => {
    const filtered = get().getFilteredRequests();
    const idx = filtered.findIndex((r) => r.id === get().selectedRequestId);
    if (idx >= 0 && idx < filtered.length - 1) get().selectRequest(filtered[idx + 1].id);
    else if (filtered.length > 0) get().selectRequest(filtered[0].id);
  },

  selectPrev: () => {
    const filtered = get().getFilteredRequests();
    const idx = filtered.findIndex((r) => r.id === get().selectedRequestId);
    if (idx > 0) get().selectRequest(filtered[idx - 1].id);
    else if (filtered.length > 0) get().selectRequest(filtered[filtered.length - 1].id);
  },
}));
