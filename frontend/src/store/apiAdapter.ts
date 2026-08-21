import { HttpRequest, HttpResponse, WsFrame, SSEEvent, BreakpointEvent, ProxyStatus, HostRule, BlockRule, RewriteRule, MockRule, CryptoRule, ScriptRule, BreakpointRule, ThrottleConfig, FilterConfig } from '../types';

export type EventCallback = (data: any) => void;

// ApiError is a structured error thrown by httpFetch when the response is
// not ok or the request times out. Callers can inspect `status` and `message`.
export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;
  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// Default timeout for HTTP fetch calls (30 seconds).
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

class ApiAdapter {
  private isWails: boolean = false;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectTimer: any = null;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  private destroyed: boolean = false;

  constructor() {
    this.isWails = typeof window !== 'undefined' && (window as any).go?.main?.App != null;
    if (!this.isWails && typeof window !== 'undefined') {
      this.initMobileWebSocket();
    }
  }

  private getBaseUrl(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:9099';
    if (window.location.protocol === 'file:' || window.location.origin.includes('androidplatform.net') || (window as any).AndroidBridge != null) {
      return 'http://127.0.0.1:9099';
    }
    return window.location.origin.includes('5173') || window.location.origin.includes('localhost')
      ? 'http://127.0.0.1:9099'
      : window.location.origin;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('httpeek_api_token') : null;
    if (token) {
      headers['X-HTTPeek-Token'] = token;
    }
    return headers;
  }

  // httpFetch is a typed fetch wrapper that checks res.ok, enforces a
  // timeout via AbortController, and throws a structured ApiError on
  // failure. All HTTP fallback paths in the adapter should use this.
  private async httpFetch<T = any>(
    endpoint: string,
    init?: RequestInit,
    timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        ...init,
        headers: { ...this.getAuthHeaders(), ...(init?.headers || {}) },
        signal: init?.signal || controller.signal,
      });
      if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch { /* ignore */ }
        throw new ApiError(
          `HTTP ${res.status} ${res.statusText}${body ? ': ' + body.slice(0, 200) : ''}`,
          res.status,
          endpoint,
        );
      }
      const text = await res.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err?.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeoutMs}ms`, 0, endpoint);
      }
      throw new ApiError(err?.message || 'Network error', 0, endpoint);
    } finally {
      clearTimeout(timer);
    }
  }

  // httpText is like httpFetch but returns the raw text body (for non-JSON
  // responses like PEM certificates or HAR text).
  private async httpText(
    endpoint: string,
    init?: RequestInit,
    timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        ...init,
        headers: { ...this.getAuthHeaders(), ...(init?.headers || {}) },
        signal: init?.signal || controller.signal,
      });
      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status, endpoint);
      }
      return await res.text();
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err?.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeoutMs}ms`, 0, endpoint);
      }
      throw new ApiError(err?.message || 'Network error', 0, endpoint);
    } finally {
      clearTimeout(timer);
    }
  }

  private getWsUrl(): string {
    const base = this.getBaseUrl().replace('http://', 'ws://').replace('https://', 'wss://');
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('httpeek_api_token') : null;
    const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}/ws/events${suffix}`;
  }

  private initMobileWebSocket() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.getWsUrl());

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event) {
            this.emit(parsed.event, parsed.data);
          }
        } catch (e) {
          console.error('WS Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.destroyed) return;
        clearTimeout(this.reconnectTimer);
        // Exponential backoff with jitter to avoid thundering herd.
        const jitter = Math.random() * 0.3 * this.reconnectDelay;
        const delay = this.reconnectDelay + jitter;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.initMobileWebSocket();
        }, delay);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.warn('WebSocket init deferred:', e);
    }
  }

  // destroy cleans up the WebSocket connection and reconnect timer.
  // Called on app shutdown / hot-module-reload to prevent leaks.
  public destroy() {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.listeners.clear();
  }

  public on(event: string, callback: EventCallback) {
    if (this.isWails && (window as any).runtime?.EventsOn) {
      (window as any).runtime.EventsOn(event, callback);
      return;
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: EventCallback) {
    if (this.isWails && (window as any).runtime?.EventsOff) {
      (window as any).runtime.EventsOff(event);
      return;
    }
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  private isWailsApp(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).go?.main?.App !== 'undefined';
  }

  public async getStatus(): Promise<ProxyStatus> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetStatus) {
      return await (window as any).go.main.App.GetStatus();
    }
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetProxyStatus) {
      return await (window as any).go.main.App.GetProxyStatus();
    }
    return this.httpFetch<ProxyStatus>(`${this.getBaseUrl()}/api/proxy/status`);
  }

  public async start(): Promise<void> {
    if (this.isWailsApp()) {
      if ((window as any).go.main.App.Start) {
        await (window as any).go.main.App.Start();
        return;
      }
      if ((window as any).go.main.App.StartProxy) {
        await (window as any).go.main.App.StartProxy(0, true, false);
        return;
      }
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/start`, { method: 'POST' });
  }

  public async stop(): Promise<void> {
    if (this.isWailsApp()) {
      if ((window as any).go.main.App.Stop) {
        await (window as any).go.main.App.Stop();
        return;
      }
      if ((window as any).go.main.App.StopProxy) {
        await (window as any).go.main.App.StopProxy();
        return;
      }
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/stop`, { method: 'POST' });
  }

  public async setPort(port: number): Promise<void> {
    if (this.isWailsApp()) {
      if ((window as any).go.main.App.SetProxyPort) {
        await (window as any).go.main.App.SetProxyPort(port);
        return;
      }
      if ((window as any).go.main.App.SetPort) {
        await (window as any).go.main.App.SetPort(port);
        return;
      }
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/port`, {
      method: 'POST',
      body: JSON.stringify({ port }),
    });
  }

  public async setSslEnabled(enabled: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go.main.App.SetSSLEnabled) {
      await (window as any).go.main.App.SetSSLEnabled(enabled);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/ssl`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  public async setSystemProxy(enabled: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go.main.App.SetSystemProxy) {
      await (window as any).go.main.App.SetSystemProxy(enabled);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/system_proxy`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  public async checkCaInstalled(): Promise<boolean> {
    if (this.isWailsApp()) {
      if ((window as any).go.main.App.CheckCAInstalled) {
        return await (window as any).go.main.App.CheckCAInstalled();
      }
      if ((window as any).go.main.App.IsCAInstalled) {
        return await (window as any).go.main.App.IsCAInstalled();
      }
    }
    const details = await this.getCADetails();
    return details?.installed ?? false;
  }

  public async installCA(): Promise<void> {
    if (this.isWailsApp() && (window as any).go.main.App.InstallRootCA) {
      return await (window as any).go.main.App.InstallRootCA();
    }
  }

  public async getCADetails(): Promise<any> {
    if (this.isWailsApp() && (window as any).go.main.App.GetCADetails) {
      return await (window as any).go.main.App.GetCADetails();
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/ca/details`);
  }

  public async repeatRequest(requestId: string): Promise<any> {
    if (this.isWails && (window as any).go?.main?.App?.RepeatRequest) {
      return await (window as any).go.main.App.RepeatRequest(requestId);
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/requests/${requestId}/repeat`, {
      method: 'POST',
    });
  }

  public async sendWsFrame(requestId: string, payload: string): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SendWsFrame) {
      await (window as any).go.main.App.SendWsFrame(requestId, payload);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/requests/${requestId}/ws/send`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
  }

  public async resumeBreakpoint(
    requestId: string,
    isResponse: boolean,
    modifiedRequest?: HttpRequest,
    modifiedResponse?: HttpResponse,
    modifiedJson?: string
  ): Promise<void> {
    const jsonStr = modifiedJson || (isResponse ? JSON.stringify(modifiedResponse || {}) : JSON.stringify(modifiedRequest || {}));
    if (this.isWailsApp() && (window as any).go?.main?.App?.ResumeBreakpoint) {
      await (window as any).go.main.App.ResumeBreakpoint(requestId, isResponse, jsonStr);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/breakpoint/resume`, {
      method: 'POST',
      body: JSON.stringify({ requestId, isResponse, modifiedJson: jsonStr }),
    });
  }

  public async abortBreakpoint(requestId: string, isResponse: boolean = false): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.AbortBreakpoint) {
      await (window as any).go.main.App.AbortBreakpoint(requestId, isResponse);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/breakpoint/abort`, {
      method: 'POST',
      body: JSON.stringify({ requestId, isResponse }),
    });
  }

  // Interceptor Rules API
  public async setFilterConfig(cfg: FilterConfig): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetHostFilterConfig) {
      await (window as any).go.main.App.SetHostFilterConfig(cfg);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/filter`, {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
  }

  public async setHostsRules(rules: HostRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetHostsRules) {
      await (window as any).go.main.App.SetHostsRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/hosts`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async setBlockRules(rules: BlockRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetBlockRules) {
      await (window as any).go.main.App.SetBlockRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/block`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async addBlockRule(rule: Partial<BlockRule>): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.AddBlockRule) {
      await (window as any).go.main.App.AddBlockRule(rule);
      return;
    }
  }

  public async setRewriteRules(rules: RewriteRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetRewriteRules) {
      await (window as any).go.main.App.SetRewriteRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/rewrite`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async setMockRules(rules: MockRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetMockRules) {
      await (window as any).go.main.App.SetMockRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/mock`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async setCryptoRules(rules: CryptoRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetCryptoRules) {
      await (window as any).go.main.App.SetCryptoRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/crypto`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async setScripts(scripts: ScriptRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetScriptRules) {
      await (window as any).go.main.App.SetScriptRules(scripts);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/script`, {
      method: 'POST',
      body: JSON.stringify(scripts),
    });
  }

  public async setBreakpointRules(rules: BreakpointRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetBreakpointRules) {
      await (window as any).go.main.App.SetBreakpointRules(rules);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/breakpoint`, {
      method: 'POST',
      body: JSON.stringify(rules),
    });
  }

  public async setThrottleConfig(cfg: ThrottleConfig): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetThrottleConfig) {
      await (window as any).go.main.App.SetThrottleConfig(cfg);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/throttle`, {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
  }

  public async setExternalProxy(cfg: { host: string; port: number; enabled: boolean; type?: string; username?: string; password?: string }): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.SetExternalProxy) {
      await (window as any).go.main.App.SetExternalProxy(cfg);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/proxy/external`, {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
  }

  public async startProxy(port?: number, enableSsl?: boolean, systemProxy?: boolean): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.StartProxy) {
      return await (window as any).go.main.App.StartProxy(port, enableSsl, systemProxy);
    }
    return this.start();
  }

  public async stopProxy(): Promise<void> {
    return this.stop();
  }

  public async exportRootCA(): Promise<string> {
    if (this.isWails && (window as any).go?.main?.App?.ExportRootCA) {
      return await (window as any).go.main.App.ExportRootCA();
    }
    return this.httpText(`${this.getBaseUrl()}/api/ca/export`);
  }

  public async installDesktopRootCA(): Promise<void> {
    return this.installCA();
  }

  public async installAndroidRootCA(deviceSerial = ''): Promise<any> {
    if (this.isWails && (window as any).go?.main?.App?.InstallAndroidRootCA) {
      return await (window as any).go.main.App.InstallAndroidRootCA(deviceSerial);
    }
    return { success: false, message: 'Available in desktop mode' };
  }

  public async getReportConfigs(): Promise<any[]> {
    if (this.isWails && (window as any).go?.main?.App?.GetReportConfigs) {
      return await (window as any).go.main.App.GetReportConfigs();
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/report/configs`);
  }

  public async setReportConfigs(configs: any[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetReportConfigs) {
      await (window as any).go.main.App.SetReportConfigs(configs);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/report/configs`, {
      method: 'PUT',
      body: JSON.stringify(configs),
    });
  }

  public async getFavorites(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetFavorites) {
      return await (window as any).go.main.App.GetFavorites();
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/favorites`);
  }

  public async toggleFavorite(requestId: string, isFavorite: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToggleFavoriteRequest) {
      return await (window as any).go.main.App.ToggleFavoriteRequest(requestId, isFavorite);
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/favorites/toggle`, {
      method: 'POST',
      body: JSON.stringify({ id: requestId, isFavorite }),
    }).catch(() => {});
  }

  public async listSessions(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListSessions) {
      return await (window as any).go.main.App.ListSessions();
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/sessions`);
  }

  public async getSessionRequests(sessionId: string): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetSessionRequests) {
      return await (window as any).go.main.App.GetSessionRequests(sessionId);
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/sessions/${sessionId}/requests`);
  }

  public async deleteSession(sessionId: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DeleteSession) {
      return await (window as any).go.main.App.DeleteSession(sessionId);
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/sessions/${sessionId}`, { method: 'DELETE' });
  }

  public async createSession(name: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.CreateNewSession) {
      return await (window as any).go.main.App.CreateNewSession(name);
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  public async exportHAR(requests: any[]): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ExportHAR) {
      return await (window as any).go.main.App.ExportHAR(requests);
    }
    return this.httpText(`${this.getBaseUrl()}/api/sessions/har/export`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }

  public async importHAR(harJSON: string, sessionName?: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ImportHAR) {
      return await (window as any).go.main.App.ImportHAR(harJSON, sessionName || '');
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/sessions/har/import`, {
      method: 'POST',
      body: JSON.stringify({ har: harJSON, name: sessionName }),
    });
  }

  public async getAllRules(): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetAllRules) {
      return await (window as any).go.main.App.GetAllRules();
    }
    return this.httpFetch(`${this.getBaseUrl()}/api/rules/all`);
  }

  public async exportRules(): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ExportRules) {
      return await (window as any).go.main.App.ExportRules();
    }
    const resp = await this.httpFetch(`${this.getBaseUrl()}/api/rules/export`);
    return resp?.rules || '';
  }

  public async importRules(jsonData: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ImportRules) {
      await (window as any).go.main.App.ImportRules(jsonData);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/rules/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: jsonData }),
    });
  }

  public async toolboxRSA(action: string, input: string, keyPEM: string): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxRSA) {
      return await (window as any).go.main.App.ToolboxRSA(action, input, keyPEM);
    }
    return '';
  }

  // ==================== App Launcher (Phase 9-C) ====================

  public async detectLaunchableApps(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DetectLaunchableApps) {
      return await (window as any).go.main.App.DetectLaunchableApps();
    }
    return await this.httpFetch(`${this.getBaseUrl()}/api/apps/detect`);
  }

  public async launchAndIntercept(appId: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchAndIntercept) {
      return await (window as any).go.main.App.LaunchAndIntercept(appId);
    }
    return await this.httpFetch(`${this.getBaseUrl()}/api/apps/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId }),
    });
  }

  public async launchCustomApp(path: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchCustomApp) {
      return await (window as any).go.main.App.LaunchCustomApp(path);
    }
    return await this.httpFetch(`${this.getBaseUrl()}/api/apps/launch-custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  }

  public async setJavaGlobalProxy(enable: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.SetJavaGlobalProxy) {
      await (window as any).go.main.App.SetJavaGlobalProxy(enable);
      return;
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/java/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable }),
    });
  }

  public async getJavaGlobalProxyStatus(): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetJavaGlobalProxyStatus) {
      return await (window as any).go.main.App.GetJavaGlobalProxyStatus();
    }
    return await this.httpFetch(`${this.getBaseUrl()}/api/java/proxy/status`);
  }

  public async getLaunchableAppCAs(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetLaunchableAppCAs) {
      return await (window as any).go.main.App.GetLaunchableAppCAs();
    }
    return [];
  }

  public async resolveADBPath(): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ResolveADBPath) {
      return await (window as any).go.main.App.ResolveADBPath();
    }
    try {
      const r = await this.httpFetch(`${this.getBaseUrl()}/api/adb/resolve`);
      return r?.path || '';
    } catch {
      return '';
    }
  }

  public async downloadADBIfMissing(): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DownloadADBIfMissing) {
      return await (window as any).go.main.App.DownloadADBIfMissing();
    }
    const r = await this.httpFetch(`${this.getBaseUrl()}/api/adb/download`, {
      method: 'POST',
    });
    return r?.path || '';
  }

  public async toolboxAES(action: string, mode: string, input: string, key: string, iv: string): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxAES) {
      return await (window as any).go.main.App.ToolboxAES(action, mode, input, key, iv);
    }
    return '';
  }

  public async toolboxEncode(action: string, input: string): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxEncode) {
      return await (window as any).go.main.App.ToolboxEncode(action, input);
    }
    return '';
  }

  public async toolboxCertHash(certPEM: string = ''): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxCertHash) {
      return await (window as any).go.main.App.ToolboxCertHash(certPEM);
    }
    return null;
  }

  public async toolboxRunJS(code: string, mockContextJSON: string = '{}'): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxRunJS) {
      return await (window as any).go.main.App.ToolboxRunJS(code, mockContextJSON);
    }
    return null;
  }

  public async writeLog(level: string, category: string, message: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.WriteLog) {
      return await (window as any).go.main.App.WriteLog(level, category, message);
    }
    try {
      await this.httpFetch(`${this.getBaseUrl()}/api/logs/write`, {
        method: 'POST',
        body: JSON.stringify({ level, category, message, caller: 'UI:Frontend' }),
      });
    } catch {
      // safe fallback — logging must never throw
    }
  }

  public async getLogFilePath(): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetLogFilePath) {
      return await (window as any).go.main.App.GetLogFilePath();
    }
    try {
      const data = await this.httpFetch<any>(`${this.getBaseUrl()}/api/logs`);
      return data?.filePath || '';
    } catch {
      return '';
    }
  }

  public async openLogFolder(): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.OpenLogFolder) {
      return await (window as any).go.main.App.OpenLogFolder();
    }
  }

  public async getRecentLogs(limit: number = 100): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetRecentLogs) {
      return await (window as any).go.main.App.GetRecentLogs(limit);
    }
    try {
      const data = await this.httpFetch<any>(`${this.getBaseUrl()}/api/logs?limit=${limit}`);
      return data?.entries || [];
    } catch {
      return [];
    }
  }

  public async clearLogs(): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ClearLogs) {
      return await (window as any).go.main.App.ClearLogs();
    }
    try {
      await this.httpFetch(`${this.getBaseUrl()}/api/logs/clear`, { method: 'POST' });
    } catch {
      // safe fallback
    }
  }

  public async listJVMTargets(): Promise<Array<{ pid: string; name: string }>> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListJVMTargets) {
      return await (window as any).go.main.App.ListJVMTargets();
    }
    return [];
  }

  public async attachJVM(pid: number, nonProxyHosts: string = ''): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.AttachJVM) {
      return await (window as any).go.main.App.AttachJVM(pid, nonProxyHosts);
    }
  }

  public async launchJVMApp(jarPath: string, args: string[] = [], nonProxyHosts: string = ''): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchJVMApp) {
      return await (window as any).go.main.App.LaunchJVMApp(jarPath, args, nonProxyHosts);
    }
    return '';
  }

  public async launchTerminal(shellType: string = 'powershell', nonProxyHosts: string = ''): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchTerminal) {
      return await (window as any).go.main.App.LaunchTerminal(shellType, nonProxyHosts);
    }
    return '';
  }

  public async launchBrowserInterceptor(browserPath: string, bType: string, url: string = ''): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchBrowserInterceptor) {
      return await (window as any).go.main.App.LaunchBrowserInterceptor(browserPath, bType, url);
    }
    return '';
  }

  public async launchElectronApp(appPath: string, args: string[] = []): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchElectronApp) {
      return await (window as any).go.main.App.LaunchElectronApp(appPath, args);
    }
    return '';
  }

  public async listExternalRuns(): Promise<any[]> {
    // ListActiveExternalRuns only returns runs that are still running (no stopped_at),
    // preventing stale sessions from previous launches from reappearing in the UI.
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListActiveExternalRuns) {
      return await (window as any).go.main.App.ListActiveExternalRuns();
    }
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListExternalRuns) {
      return await (window as any).go.main.App.ListExternalRuns();
    }
    return [];
  }

  public async deleteFavorite(requestId: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DeleteFavorite) {
      return await (window as any).go.main.App.DeleteFavorite(requestId);
    }
    await this.httpFetch(`${this.getBaseUrl()}/api/favorites/${requestId}`, {
      method: 'DELETE',
    }).catch(() => {});
  }

  public async listADBDevices(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListADBDevices) {
      return await (window as any).go.main.App.ListADBDevices();
    }
    return [];
  }

  public async startADBInterception(serial: string): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.StartADBInterception) {
      return await (window as any).go.main.App.StartADBInterception(serial);
    }
    return '';
  }

  public async stopADBInterception(serial: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.StopADBInterception) {
      return await (window as any).go.main.App.StopADBInterception(serial);
    }
  }

  public async launchFrida(app: string, scriptPath: string = '', deviceSerial: string = ''): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchFrida) {
      return await (window as any).go.main.App.LaunchFrida(app, scriptPath, deviceSerial);
    }
    return '';
  }

  public async launchFridaAttach(targetAppOrPid: string, scriptPath: string = '', deviceSerial: string = ''): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.LaunchFridaAttach) {
      return await (window as any).go.main.App.LaunchFridaAttach(targetAppOrPid, scriptPath, deviceSerial);
    }
    return '';
  }

  public async stopFrida(runId: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.StopFrida) {
      return await (window as any).go.main.App.StopFrida(runId);
    }
  }

  public async listAndroidInstalledApps(serial: string): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListAndroidInstalledApps) {
      return await (window as any).go.main.App.ListAndroidInstalledApps(serial);
    }
    return [];
  }

  public async listAndroidRunningApps(serial: string): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListAndroidRunningApps) {
      return await (window as any).go.main.App.ListAndroidRunningApps(serial);
    }
    return [];
  }

  public async deployFridaServer(serial: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DeployFridaServer) {
      return await (window as any).go.main.App.DeployFridaServer(serial);
    }
  }

  public async decodeGrpcPayload(base64Payload: string): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DecodeGrpcPayload) {
      return await (window as any).go.main.App.DecodeGrpcPayload(base64Payload);
    }
    return [];
  }

  public isMobile(): boolean {
    return !this.isWails || (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }
}

export const api = new ApiAdapter();
