import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Globe,
  Terminal,
  Code,
  Coffee,
  Lock,
  CheckCircle,
  XCircle,
  Loader2,
  Power,
  Cpu,
  Folder,
} from 'lucide-react';
import { api } from '../../store/apiAdapter';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';

interface LaunchableApp {
  id: string;
  name: string;
  icon: string;
  path: string;
  found: boolean;
  category: string;
  description: string;
}

interface LaunchResult {
  success: boolean;
  pid?: number;
  error?: string;
  appId: string;
  appName: string;
  processName?: string;
}

interface JavaProxyStatus {
  enabled: boolean;
  trustStore?: string;
  javaHome?: string;
  proxyHost?: string;
  proxyPort?: number;
}

interface JavaInstallation {
  path: string;
  version: string;
  vendor: string;
  keytoolPath: string;
  cacertsPath: string;
  isInstalled: boolean;
}

const appIconMap: Record<string, React.ReactNode> = {
  chrome: <Globe className="w-6 h-6" />,
  edge: <Globe className="w-6 h-6" />,
  firefox: <Globe className="w-6 h-6" />,
  safari: <Globe className="w-6 h-6" />,
  chromium: <Globe className="w-6 h-6" />,
  terminal: <Terminal className="w-6 h-6" />,
  powershell: <Terminal className="w-6 h-6" />,
  node: <Code className="w-6 h-6" />,
  python: <Code className="w-6 h-6" />,
};

const categoryColors: Record<string, string> = {
  browser: '#4285f4',
  terminal: '#10b981',
  runtime: '#f59e0b',
};

export const LaunchPanel: React.FC = () => {
  const [apps, setApps] = useState<LaunchableApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<LaunchResult | null>(null);
  // Tracks what kind of interception is active so "Stop Intercepting" can take
  // the correct backend action (Java proxy can be remotely disabled; launched
  // apps keep their launch-time proxy settings until closed).
  const [activeLaunchKind, setActiveLaunchKind] = useState<'app' | 'java' | null>(null);
  const [javaStatus, setJavaStatus] = useState<JavaProxyStatus | null>(null);
  const [javaInstalls, setJavaInstalls] = useState<JavaInstallation[]>([]);
  const [javaToggling, setJavaToggling] = useState(false);
  const [stopping, setStopping] = useState(false);
  const { setProcessFilter, setActiveTab, processFilter } = useProxyStore();

  const refreshApps = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.detectLaunchableApps();
      setApps(list || []);
    } catch (e: any) {
      console.warn('Detect apps error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshJavaStatus = useCallback(async () => {
    try {
      const status = await api.getJavaGlobalProxyStatus();
      setJavaStatus(status);
    } catch (e) {
      console.warn('Java status error:', e);
    }
  }, []);

  const refreshJavaInstalls = useCallback(async () => {
    try {
      if ((window as any).go?.main?.App?.DetectJavaInstallations) {
        const list = await (window as any).go.main.App.DetectJavaInstallations();
        setJavaInstalls(list || []);
      } else {
        const list = await api.getLaunchableAppCAs();
        setJavaInstalls(list || []);
      }
    } catch (e) {
      console.warn('Java installs error:', e);
    }
  }, []);

  useEffect(() => {
    refreshApps();
    refreshJavaStatus();
    refreshJavaInstalls();
  }, [refreshApps, refreshJavaStatus, refreshJavaInstalls]);

  const handleLaunch = async (app: LaunchableApp) => {
    setLaunching(app.id);
    try {
      const result: LaunchResult = await api.launchAndIntercept(app.id);
      if (result.success) {
        toast.success('App Launched', `${result.appName} is now intercepted (PID ${result.pid}). Only this app's traffic is routed through HTTPeek.`);
        setActiveLaunch(result);
        setActiveLaunchKind('app');
        // Auto-filter by process name
        if (result.processName) {
          setProcessFilter(result.processName);
        }
        // Switch to requests tab to see the traffic
        setActiveTab('requests');
      } else {
        toast.error('Launch Failed', result.error || 'Unknown error');
      }
    } catch (e: any) {
      toast.error('Launch Failed', e?.message || String(e));
    } finally {
      setLaunching(null);
    }
  };

  const handleStopIntercepting = async () => {
    setStopping(true);
    try {
      if (activeLaunchKind === 'java') {
        // Java global proxy can be remotely disabled — new Java processes will
        // no longer route through HTTPeek.
        try {
          await api.setJavaGlobalProxy(false);
          await refreshJavaStatus();
          toast.success('Java Proxy Disabled', 'New Java processes will no longer route through HTTPeek. Restart running Java apps to fully clear the setting.');
        } catch (e: any) {
          toast.error('Failed to disable Java proxy', e?.message || String(e));
        }
      } else if (activeLaunchKind === 'app') {
        // Launched apps keep their launch-time proxy settings until closed —
        // be honest about this rather than pretending "stop" revokes routing.
        toast.info(
          'Filter Cleared',
          'The launched application keeps using the proxy settings it started with until it is closed. This only stops showing its traffic in the list.'
        );
      } else {
        toast.info('Stopped Intercepting', 'Process filter cleared. Showing all traffic.');
      }
      setProcessFilter(null);
      setActiveLaunch(null);
      setActiveLaunchKind(null);
    } finally {
      setStopping(false);
    }
  };

  const handleLaunchCustom = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.exe,.bat,.cmd,.sh,.jar';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const path = (file as any).path || file.name;
      setLaunching('custom');
      try {
        const result: LaunchResult = await api.launchCustomApp(path);
        if (result.success) {
          toast.success('App Launched', `Custom app intercepted (PID ${result.pid}). Only this app's traffic is routed through HTTPeek.`);
          setActiveLaunch(result);
          setActiveLaunchKind('app');
          if (result.processName) {
            setProcessFilter(result.processName);
          }
          setActiveTab('requests');
        } else {
          toast.error('Launch Failed', result.error || 'Unknown error');
        }
      } catch (e: any) {
        toast.error('Launch Failed', e?.message || String(e));
      } finally {
        setLaunching(null);
      }
    };
    input.click();
  };

  const handleToggleJavaProxy = async () => {
    setJavaToggling(true);
    try {
      const enable = !javaStatus?.enabled;
      await api.setJavaGlobalProxy(enable);
      await refreshJavaStatus();
      await refreshJavaInstalls();
      if (enable) {
        setActiveLaunchKind('java');
        // Switch to requests tab so user can see Java traffic as it arrives
        setActiveTab('requests');
      } else {
        // Java proxy was disabled from its own toggle — clear active session too
        setActiveLaunchKind(null);
        setProcessFilter(null);
        setActiveLaunch(null);
      }
      toast.success(
        enable ? 'Java Proxy Enabled' : 'Java Proxy Disabled',
        enable
          ? 'Proxy started, CA installed to Java cacerts, and JAVA_TOOL_OPTIONS set. Only Java apps will route through HTTPeek. Restart any running Java apps for changes to take effect.'
          : 'Java apps will no longer use the proxy. Restart running Java apps to clear the setting.'
      );
    } catch (e: any) {
      toast.error('Java Proxy Error', e?.message || String(e));
    } finally {
      setJavaToggling(false);
    }
  };

  const handleInstallJavaCert = async (javaPath: string) => {
    try {
      if ((window as any).go?.main?.App?.InstallCertToJava) {
        await (window as any).go.main.App.InstallCertToJava(javaPath);
        toast.success('Installed to Java Keystore', 'HTTPeek CA trusted in cacerts');
        await refreshJavaInstalls();
      }
    } catch (e: any) {
      toast.error('Java Install Error', e?.message || 'Failed to install cert into Java cacerts');
    }
  };

  const browsers = apps.filter((a) => a.category === 'browser');
  const terminals = apps.filter((a) => a.category === 'terminal');
  const runtimes = apps.filter((a) => a.category === 'runtime');

  const renderAppCard = (app: LaunchableApp) => {
    const isActive = activeLaunch?.appId === app.id;
    const isLaunching = launching === app.id;
    const color = categoryColors[app.category] || '#6b7280';

    return (
    <div
      key={app.id}
      className="relative flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer group"
      style={{
        borderColor: app.found ? (isActive ? color : 'var(--md-sys-color-divider)') : '#e5e7eb',
        backgroundColor: isActive ? `${color}10` : 'var(--md-sys-color-surface)',
        opacity: app.found ? 1 : 0.5,
      }}
      onClick={() => app.found && !isLaunching && handleLaunch(app)}
    >
      <div className="mb-2" style={{ color: app.found ? color : '#9ca3af' }}>
        {appIconMap[app.id] || <Rocket className="w-6 h-6" />}
      </div>
      <div className="text-xs font-bold text-center" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        {app.name}
      </div>
      <div className="text-[10px] text-center mt-0.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        {app.description}
      </div>
      <div className="mt-2 flex items-center gap-1">
        {app.found ? (
          <CheckCircle className="w-3 h-3 text-green-500" />
        ) : (
          <XCircle className="w-3 h-3 text-gray-400" />
        )}
        <span className="text-[9px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {app.found ? 'Ready' : 'Not found'}
        </span>
      </div>
      {isLaunching && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
        </div>
      )}
      {isActive && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
    );
  };

  const renderAppSection = (title: string, appList: LaunchableApp[]) => {
    if (appList.length === 0) return null;
    return (
      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {title}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {appList.map(renderAppCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#7c3aed20' }}>
            <Rocket className="w-5 h-5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              Launch & Intercept
            </h1>
            <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Click an app to launch it with automatic proxy interception. Only that app's traffic is routed through HTTPeek — your OS-wide system proxy is never touched.
            </p>
          </div>
        </div>

        {/* Active interception banner */}
        {(activeLaunch || processFilter) && (
          <div className="mb-5 flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: '#7c3aed10', borderColor: '#7c3aed40' }}>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" style={{ color: '#7c3aed' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Intercepting: <span className="font-bold">{processFilter || activeLaunch?.appName}</span>
                {activeLaunch?.pid && <span className="text-xs ml-2 opacity-60">(PID {activeLaunch.pid})</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopIntercepting}
              disabled={stopping}
              className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
              style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
            >
              {stopping && <Loader2 className="w-3 h-3 animate-spin" />}
              Stop Intercepting
            </button>
          </div>
        )}

        {/* Refresh button */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {loading ? 'Scanning for apps...' : `${apps.filter(a => a.found).length} apps found`}
          </span>
          <button
            type="button"
            onClick={refreshApps}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)', color: 'var(--md-sys-color-on-surface-variant)' }}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>

        {/* App cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#7c3aed' }} />
          </div>
        ) : (
          <>
            {renderAppSection('Browsers', browsers)}
            {renderAppSection('Terminals', terminals)}
            {renderAppSection('Runtimes', runtimes)}

            {/* Custom app launcher */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Custom Application
              </h3>
              <button
                type="button"
                onClick={handleLaunchCustom}
                disabled={launching === 'custom'}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-400"
                style={{ borderColor: 'var(--md-sys-color-divider)', width: '100%' }}
              >
                {launching === 'custom' ? (
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#7c3aed' }} />
                ) : (
                  <Folder className="w-6 h-6" style={{ color: '#7c3aed' }} />
                )}
                <div className="text-left">
                  <div className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Browse for executable
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Launch any .exe, .bat, .sh, or .jar with proxy settings
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Java Global Proxy Section */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
          <div className="flex items-center gap-3 mb-4">
            <Coffee className="w-5 h-5" style={{ color: '#f59e0b' }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Java JVM Proxy
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Set JAVA_TOOL_OPTIONS globally so all Java applications route through HTTPeek. Your OS-wide system proxy is not affected — only Java apps are intercepted.
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border mb-3" style={{ borderColor: 'var(--md-sys-color-divider)', backgroundColor: 'var(--md-sys-color-surface)' }}>
            <div className="flex items-center gap-2">
              <Power className="w-4 h-4" style={{ color: javaStatus?.enabled ? '#10b981' : '#9ca3af' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                {javaStatus?.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {javaStatus?.enabled && javaStatus?.proxyPort && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                  127.0.0.1:{javaStatus.proxyPort}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleToggleJavaProxy}
              disabled={javaToggling}
              className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
              style={{ backgroundColor: javaStatus?.enabled ? '#10b981' : '#d1d5db' }}
            >
              {javaToggling ? (
                <Loader2 className="w-3 h-3 animate-spin absolute top-1.5 left-4" />
              ) : (
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: javaStatus?.enabled ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              )}
            </button>
          </div>

          {/* Java installations */}
          {javaInstalls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Detected Java Installations
              </h4>
              {javaInstalls.map((inst, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Coffee className="w-4 h-4 shrink-0" style={{ color: '#f59e0b' }} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        {inst.vendor} Java {inst.version}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {inst.path}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inst.isInstalled ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
                        <Lock className="w-3 h-3" /> CA Trusted
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallJavaCert(inst.path)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-colors"
                        style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}
                      >
                        Install CA
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {javaStatus?.enabled && (
            <div className="mt-3 p-3 rounded-lg text-[11px] space-y-1" style={{ backgroundColor: '#f59e0b10', color: '#92400e' }}>
              <div className="font-bold">Important: Restart Java applications for changes to take effect</div>
              <div>JAVA_TOOL_OPTIONS is read when the JVM starts. Already-running Java apps will not pick up the new proxy settings.</div>
              <div>On Windows: new processes from Explorer/Taskbar will inherit the settings automatically.</div>
              <div>On macOS/Linux: run <code className="px-1 rounded bg-amber-100">source ~/.httpeek_java_env</code> in your terminal before launching Java apps.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
