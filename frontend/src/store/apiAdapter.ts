import { HttpRequest, HttpResponse, WsFrame, SSEEvent, BreakpointEvent, ProxyStatus, HostRule, BlockRule, RewriteRule, MockRule, CryptoRule, ScriptRule, BreakpointRule, ThrottleConfig, FilterConfig } from '../types';

export type EventCallback = (data: any) => void;

class ApiAdapter {
  private isWails: boolean = false;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectTimer: any = null;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;

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

  private getWsUrl(): string {
    const base = this.getBaseUrl().replace('http://', 'ws://').replace('https://', 'wss://');
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('httpeek_api_token') : null;
    const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}/ws/events${suffix}`;
  }

  private initMobileWebSocket() {
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
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.initMobileWebSocket();
        }, this.reconnectDelay);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.warn('WebSocket init deferred:', e);
    }
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
    const res = await fetch(`${this.getBaseUrl()}/api/proxy/status`, { headers: this.getAuthHeaders() });
    return await res.json();
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
    await fetch(`${this.getBaseUrl()}/api/proxy/start`, { method: 'POST', headers: this.getAuthHeaders() });
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
    await fetch(`${this.getBaseUrl()}/api/proxy/stop`, { method: 'POST', headers: this.getAuthHeaders() });
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
    await fetch(`${this.getBaseUrl()}/api/proxy/port`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ port }),
    });
  }

  public async setSslEnabled(enabled: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go.main.App.SetSSLEnabled) {
      await (window as any).go.main.App.SetSSLEnabled(enabled);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/proxy/ssl`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ enabled }),
    });
  }

  public async setSystemProxy(enabled: boolean): Promise<void> {
    if (this.isWailsApp() && (window as any).go.main.App.SetSystemProxy) {
      await (window as any).go.main.App.SetSystemProxy(enabled);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/proxy/system_proxy`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
    const res = await fetch(`${this.getBaseUrl()}/api/ca/details`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async repeatRequest(requestId: string): Promise<any> {
    if (this.isWails && (window as any).go?.main?.App?.RepeatRequest) {
      return await (window as any).go.main.App.RepeatRequest(requestId);
    }
    const res = await fetch(`${this.getBaseUrl()}/api/requests/${requestId}/repeat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    return await res.json();
  }

  public async sendWsFrame(requestId: string, payload: string): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SendWsFrame) {
      await (window as any).go.main.App.SendWsFrame(requestId, payload);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/requests/${requestId}/ws/send`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
    await fetch(`${this.getBaseUrl()}/api/breakpoint/resume`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requestId, isResponse, modifiedJson: jsonStr }),
    });
  }

  public async abortBreakpoint(requestId: string, isResponse: boolean = false): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.AbortBreakpoint) {
      await (window as any).go.main.App.AbortBreakpoint(requestId, isResponse);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/breakpoint/abort`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requestId, isResponse }),
    });
  }

  // Interceptor Rules API
  public async setFilterConfig(cfg: FilterConfig): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetHostFilterConfig) {
      await (window as any).go.main.App.SetHostFilterConfig(cfg);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/filter`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(cfg),
    });
  }

  public async setHostsRules(rules: HostRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetHostsRules) {
      await (window as any).go.main.App.SetHostsRules(rules);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/hosts`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(rules),
    });
  }

  public async setBlockRules(rules: BlockRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetBlockRules) {
      await (window as any).go.main.App.SetBlockRules(rules);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/block`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
    await fetch(`${this.getBaseUrl()}/api/rules/rewrite`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(rules),
    });
  }

  public async setMockRules(rules: MockRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetMockRules) {
      await (window as any).go.main.App.SetMockRules(rules);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/mock`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(rules),
    });
  }

  public async setCryptoRules(rules: CryptoRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetCryptoRules) {
      await (window as any).go.main.App.SetCryptoRules(rules);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/crypto`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(rules),
    });
  }

  public async setScripts(scripts: ScriptRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetScriptRules) {
      await (window as any).go.main.App.SetScriptRules(scripts);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/script`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(scripts),
    });
  }

  public async setBreakpointRules(rules: BreakpointRule[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetBreakpointRules) {
      await (window as any).go.main.App.SetBreakpointRules(rules);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/breakpoint`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(rules),
    });
  }

  public async setThrottleConfig(cfg: ThrottleConfig): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetThrottleConfig) {
      await (window as any).go.main.App.SetThrottleConfig(cfg);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/rules/throttle`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(cfg),
    });
  }

  public async setExternalProxy(cfg: { host: string; port: number; enabled: boolean; type?: string; username?: string; password?: string }): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.SetExternalProxy) {
      await (window as any).go.main.App.SetExternalProxy(cfg);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/proxy/external`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
    const res = await fetch(`${this.getBaseUrl()}/api/ca/export`);
    return await res.text();
  }

  public async installDesktopRootCA(): Promise<void> {
    return this.installCA();
  }

  public async listADBDevices(): Promise<any[]> {
    if (this.isWails && (window as any).go?.main?.App?.ListADBDevices) {
      return await (window as any).go.main.App.ListADBDevices();
    }
    return [];
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
    const res = await fetch(`${this.getBaseUrl()}/api/report/configs`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async setReportConfigs(configs: any[]): Promise<void> {
    if (this.isWails && (window as any).go?.main?.App?.SetReportConfigs) {
      await (window as any).go.main.App.SetReportConfigs(configs);
      return;
    }
    await fetch(`${this.getBaseUrl()}/api/report/configs`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(configs),
    });
  }

  public async getFavorites(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetFavorites) {
      return await (window as any).go.main.App.GetFavorites();
    }
    const res = await fetch(`${this.getBaseUrl()}/api/favorites`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async listSessions(): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ListSessions) {
      return await (window as any).go.main.App.ListSessions();
    }
    const res = await fetch(`${this.getBaseUrl()}/api/sessions`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async getSessionRequests(sessionId: string): Promise<any[]> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetSessionRequests) {
      return await (window as any).go.main.App.GetSessionRequests(sessionId);
    }
    const res = await fetch(`${this.getBaseUrl()}/api/sessions/${sessionId}/requests`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async deleteSession(sessionId: string): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.DeleteSession) {
      return await (window as any).go.main.App.DeleteSession(sessionId);
    }
    await fetch(`${this.getBaseUrl()}/api/sessions/${sessionId}`, { method: 'DELETE', headers: this.getAuthHeaders() });
  }

  public async createSession(name: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.CreateNewSession) {
      return await (window as any).go.main.App.CreateNewSession(name);
    }
    const res = await fetch(`${this.getBaseUrl()}/api/sessions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    return await res.json();
  }

  public async exportHAR(requests: any[]): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ExportHAR) {
      return await (window as any).go.main.App.ExportHAR(requests);
    }
    const res = await fetch(`${this.getBaseUrl()}/api/sessions/har/export`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requests }),
    });
    return await res.text();
  }

  public async importHAR(harJSON: string, sessionName?: string): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ImportHAR) {
      return await (window as any).go.main.App.ImportHAR(harJSON, sessionName || '');
    }
    const res = await fetch(`${this.getBaseUrl()}/api/sessions/har/import`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ har: harJSON, name: sessionName }),
    });
    return await res.json();
  }

  public async getAllRules(): Promise<any> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetAllRules) {
      return await (window as any).go.main.App.GetAllRules();
    }
    const res = await fetch(`${this.getBaseUrl()}/api/rules/all`, { headers: this.getAuthHeaders() });
    return await res.json();
  }

  public async toolboxRSA(action: string, input: string, keyPEM: string): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ToolboxRSA) {
      return await (window as any).go.main.App.ToolboxRSA(action, input, keyPEM);
    }
    return '';
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
      await fetch(`${this.getBaseUrl()}/api/logs/write`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ level, category, message, caller: 'UI:Frontend' }),
      });
    } catch {
      // safe fallback
    }
  }

  public async getLogFilePath(): Promise<string> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.GetLogFilePath) {
      return await (window as any).go.main.App.GetLogFilePath();
    }
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/logs`, { headers: this.getAuthHeaders() });
      const data = await res.json();
      return data.filePath || '';
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
      const res = await fetch(`${this.getBaseUrl()}/api/logs?limit=${limit}`, { headers: this.getAuthHeaders() });
      const data = await res.json();
      return data.entries || [];
    } catch {
      return [];
    }
  }

  public async clearLogs(): Promise<void> {
    if (this.isWailsApp() && (window as any).go?.main?.App?.ClearLogs) {
      return await (window as any).go.main.App.ClearLogs();
    }
    try {
      await fetch(`${this.getBaseUrl()}/api/logs/clear`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // safe fallback
    }
  }

  public isMobile(): boolean {
    return !this.isWails || (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }
}

export const api = new ApiAdapter();
