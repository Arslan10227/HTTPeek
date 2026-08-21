import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Globe,
  Terminal,
  Code,
  Coffee,
  Smartphone,
  Shield,
  Box,
  FolderOpen,
  Play,
  Square,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  Radio,
  Cpu,
  ArrowRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../store/apiAdapter';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { Dialog, FormInput, FormLabel } from '../ui/Dialog';
import { AndroidFridaModal } from './AndroidFridaModal';

interface LaunchableApp {
  id: string;
  name: string;
  icon: string;
  path: string;
  found: boolean;
  category: string;
  description: string;
}

interface JVMTarget {
  pid: string;
  name: string;
}

interface ADBDevice {
  serial: string;
  state: string;
  model: string;
}

interface ActiveRun {
  id: string;
  name: string;
  pid: number;
  type: string;
  details: string;
}

export const InterceptorsPage: React.FC = () => {
  const { status, requests, setActiveTab, setProcessFilter, addActiveInterceptor, removeActiveInterceptor } = useProxyStore();
  const { getActiveColorPreset, getEffectiveIsDark } = useAppConfig();
  const activeColor = getActiveColorPreset();
  const isDark = getEffectiveIsDark();

  const isRunning = status.running;
  const proxyPort = status.port || 9099;
  const isEverythingActive = status.running && status.systemProxyEnabled;

  // State
  const [apps, setApps] = useState<LaunchableApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [togglingSystemProxy, setTogglingSystemProxy] = useState(false);

  // Active per-app runs
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);

  // Java Global Proxy
  const [javaGlobalEnabled, setJavaGlobalEnabled] = useState(false);
  const [javaToggling, setJavaToggling] = useState(false);

  // JVM Attach Modal
  const [isJvmModalOpen, setIsJvmModalOpen] = useState(false);
  const [jvmTargets, setJvmTargets] = useState<JVMTarget[]>([]);
  const [loadingJvm, setLoadingJvm] = useState(false);
  const [selectedJvmPid, setSelectedJvmPid] = useState<string>('');
  const [jvmFilter, setJvmFilter] = useState('');
  const [attachingJvm, setAttachingJvm] = useState(false);

  // Android & Frida Modal
  const [isAndroidFridaOpen, setIsAndroidFridaOpen] = useState(false);
  const [androidFridaMode, setAndroidFridaMode] = useState<'frida' | 'adb'>('frida');

  // Frida Modal (legacy fallback)
  const [isFridaModalOpen, setIsFridaModalOpen] = useState(false);
  const [fridaApp, setFridaApp] = useState('');
  const [fridaSerial, setFridaSerial] = useState('');
  const [fridaScript, setFridaScript] = useState('');
  const [spawningFrida, setSpawningFrida] = useState(false);

  // ADB Devices
  const [adbDevices, setAdbDevices] = useState<ADBDevice[]>([]);
  const [activeAdbSerial, setActiveAdbSerial] = useState<string | null>(null);
  const [loadingAdb, setLoadingAdb] = useState(false);

  // Custom App Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [launchingCustom, setLaunchingCustom] = useState(false);

  // Refresh discovered launchable apps
  const refreshApps = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.detectLaunchableApps();
      setApps(list || []);
    } catch (e) {
      console.warn('Failed to detect launchable apps:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh Java global status
  const refreshJavaStatus = useCallback(async () => {
    try {
      const jStatus = await api.getJavaGlobalProxyStatus();
      setJavaGlobalEnabled(!!jStatus?.enabled);
    } catch {
      setJavaGlobalEnabled(false);
    }
  }, []);

  // Refresh Active Runs — only syncs runs marked active in the DB; never clobbers
  // in-memory runs that were just added by the current session.
  const refreshActiveRuns = useCallback(async () => {
    try {
      const runs = await api.listExternalRuns();
      if (runs && Array.isArray(runs)) {
        const dbRuns: ActiveRun[] = runs.map((r: any) => ({
          id: r.id || String(r.ID || r.pid),
          name: r.target || r.name || r.interceptor_type || 'Interceptor Target',
          pid: r.pid || 0,
          type: r.interceptor_type || r.type || 'app',
          details: r.details || r.status || `Port ${proxyPort}`,
        }));
        setActiveRuns((prev) => {
          // Only add DB runs that are not already tracked locally
          const existingIds = new Set(prev.map((r) => r.id));
          const newRuns = dbRuns.filter((r) => !existingIds.has(r.id));
          return newRuns.length > 0 ? [...prev, ...newRuns] : prev;
        });
      }
    } catch {
      // ignore polling errors
    }
  }, [proxyPort]);


  useEffect(() => {
    refreshApps();
    refreshJavaStatus();
    refreshActiveRuns();

    const interval = setInterval(() => {
      refreshActiveRuns();
      refreshJavaStatus();
    }, 2500);

    return () => clearInterval(interval);
  }, [refreshApps, refreshJavaStatus, refreshActiveRuns]);


  // Master "Intercept Everything" toggle
  const handleToggleSystemProxy = async () => {
    setTogglingSystemProxy(true);
    try {
      if (isEverythingActive) {
        await api.stopProxy();
        toast.info('System Proxy Disabled', 'OS-wide traffic interception stopped');
      } else {
        await api.startProxy(proxyPort, true, true);
        toast.success('System Proxy Active', `Intercepting all traffic on 127.0.0.1:${proxyPort}`);
      }
    } catch (err: any) {
      toast.error('Failed to toggle system proxy', err?.message || String(err));
    } finally {
      setTogglingSystemProxy(false);
    }
  };

  // Launch isolated browser
  const handleLaunchBrowser = async (app: LaunchableApp) => {
    try {
      toast.info(`Launching ${app.name}...`, 'Opening clean isolated profile');
      const res = await api.launchAndIntercept(app.id);
      if (res.success) {
        toast.success(`${app.name} Launched`, `PID: ${res.pid || 'Active'}`);
        if (res.pid) {
          setActiveRuns((prev) => [
            ...prev.filter((r) => r.pid !== res.pid),
            {
              id: `browser-${res.pid}`,
              name: app.name,
              pid: res.pid,
              type: 'browser',
              details: `Port ${proxyPort}`,
            },
          ]);
          addActiveInterceptor({
            id: `browser-${res.pid}`,
            type: 'browser',
            name: app.name,
          });
        }
      } else {
        toast.error(`Failed to launch ${app.name}`, res.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error(`Error launching ${app.name}`, err?.message || String(err));
    }
  };


  // Launch interactive terminal
  const handleLaunchTerminal = async (shellType: string) => {
    try {
      toast.info(`Spawning ${shellType}...`, 'Injected HTTP_PROXY & SSL_CERT_FILE');
      const runId = await api.launchTerminal(shellType);
      toast.success(`${shellType} Active`, 'All CLI tools (curl, npm, python, git) will route through HTTPeek');
      const termId = runId || `term-${Date.now()}`;
      setActiveRuns((prev) => [
        ...prev,
        {
          id: termId,
          name: shellType.toUpperCase(),
          pid: 0,
          type: 'terminal',
          details: 'Env Vars Injected',
        },
      ]);
      addActiveInterceptor({
        id: termId,
        type: 'terminal',
        name: `Terminal: ${shellType.toUpperCase()}`,
        runId: runId,
      });
    } catch (err: any) {
      toast.error(`Failed to start ${shellType}`, err?.message || String(err));
    }
  };

  // Toggle Java Global Proxy
  const handleToggleJavaGlobal = async () => {
    setJavaToggling(true);
    try {
      const nextState = !javaGlobalEnabled;
      await api.setJavaGlobalProxy(nextState);
      setJavaGlobalEnabled(nextState);
      if (nextState) {
        toast.success('Java Global Proxy Enabled', 'All JVM apps using JAVA_TOOL_OPTIONS will route through HTTPeek');
        addActiveInterceptor({
          id: 'java-global',
          type: 'jvm',
          name: 'Java Global Proxy',
        });
      } else {
        toast.info('Java Global Proxy Disabled', 'JAVA_TOOL_OPTIONS removed');
        removeActiveInterceptor('java-global');
      }
    } catch (err: any) {
      toast.error('Failed to set Java global proxy', err?.message || String(err));
    } finally {
      setJavaToggling(false);
    }
  };

  // Open JVM attach modal and list targets
  const handleOpenJvmModal = async () => {
    setIsJvmModalOpen(true);
    setLoadingJvm(true);
    try {
      const targets = await api.listJVMTargets();
      setJvmTargets(targets || []);
      if (targets && targets.length > 0) {
        setSelectedJvmPid(targets[0].pid);
      }
    } catch (err: any) {
      toast.error('Failed to scan JVM targets', err?.message || String(err));
    } finally {
      setLoadingJvm(false);
    }
  };

  const handleAttachJvm = async () => {
    if (!selectedJvmPid) return;
    setAttachingJvm(true);
    try {
      await api.attachJVM(parseInt(selectedJvmPid, 10));
      toast.success('JVM Agent Attached', `Target PID: ${selectedJvmPid}`);
      const target = jvmTargets.find((t) => t.pid === selectedJvmPid);
      const jvmName = target?.name || `JVM PID ${selectedJvmPid}`;
      setActiveRuns((prev) => [
        ...prev,
        {
          id: `jvm-${selectedJvmPid}`,
          name: jvmName,
          pid: parseInt(selectedJvmPid, 10),
          type: 'jvm',
          details: 'Dynamic Agent Injected',
        },
      ]);
      addActiveInterceptor({
        id: `jvm-${selectedJvmPid}`,
        type: 'jvm',
        name: `Java: ${jvmName}`,
      });
      setIsJvmModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to attach JVM agent', err?.message || String(err));
    } finally {
      setAttachingJvm(false);
    }
  };

  // ADB Android Interception
  const handleStartADB = async (serial: string) => {
    setLoadingAdb(true);
    try {
      await api.startADBInterception(serial);
      setActiveAdbSerial(serial);
      toast.success('Android ADB Interception Active', `Device ${serial}: Reverse proxy configured`);
      setActiveRuns((prev) => [
        ...prev,
        {
          id: `adb-${serial}`,
          name: `Android (${serial})`,
          pid: 0,
          type: 'android',
          details: 'Reverse Port Forward :9099',
        },
      ]);
      addActiveInterceptor({
        id: `adb-${serial}`,
        type: 'adb',
        name: `ADB: ${serial}`,
        deviceSerial: serial,
      });
    } catch (err: any) {
      toast.error('ADB Interception Failed', err?.message || String(err));
    } finally {
      setLoadingAdb(false);
    }
  };

  const handleStopADB = async (serial: string) => {
    try {
      await api.stopADBInterception(serial);
      setActiveAdbSerial(null);
      toast.info('ADB Interception Stopped', `Device ${serial} proxy cleared`);
      setActiveRuns((prev) => prev.filter((r) => r.id !== `adb-${serial}`));
      removeActiveInterceptor(`adb-${serial}`);
    } catch (err: any) {
      toast.error('Failed to stop ADB', err?.message || String(err));
    }
  };

  // Frida Spawn
  const handleSpawnFrida = async () => {
    if (!fridaApp.trim()) {
      toast.warning('Frida App Required', 'Please enter package name or executable');
      return;
    }

    setSpawningFrida(true);
    try {
      const runId = await api.launchFrida(fridaApp.trim(), fridaScript, fridaSerial);
      toast.success('Frida Injected', `App: ${fridaApp} (SSL Pinning Bypass Active)`);
      setActiveRuns((prev) => [
        ...prev,
        {
          id: runId,
          name: `Frida: ${fridaApp}`,
          pid: 0,
          type: 'frida',
          details: 'SSL Bypass Active',
        },
      ]);
      addActiveInterceptor({
        id: runId,
        type: 'frida',
        name: `Frida: ${fridaApp}`,
        runId: runId,
        deviceSerial: fridaSerial,
      });
      setIsFridaModalOpen(false);
    } catch (err: any) {
      toast.error('Frida Spawn Failed', err?.message || String(err));
    } finally {
      setSpawningFrida(false);
    }
  };

  // Custom App Launch
  const handleLaunchCustom = async () => {
    if (!customPath.trim()) return;
    setLaunchingCustom(true);
    try {
      const res = await api.launchCustomApp(customPath.trim());
      if (res.success) {
        toast.success('Custom App Launched', `PID: ${res.pid}`);
        if (res.pid) {
          setActiveRuns((prev) => [
            ...prev,
            {
              id: `custom-${res.pid}`,
              name: customPath.split(/[\\/]/).pop() || 'Custom App',
              pid: res.pid,
              type: 'custom',
              details: 'Proxy Flags Injected',
            },
          ]);
        }
        setIsCustomModalOpen(false);
      } else {
        toast.error('Launch Failed', res.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Launch Error', err?.message || String(err));
    } finally {
      setLaunchingCustom(false);
    }
  };

  // Filter apps by category and search
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      className="flex-1 h-full overflow-y-auto p-5 flex flex-col gap-4 select-none font-sans"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* 1. ACTIVE PER-APP RUNS HUB */}
      {activeRuns.length > 0 && (
        <div
          className="flex flex-col gap-2.5 p-4 rounded-2xl border transition-all shadow-xs"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: `${activeColor.hex}44`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
                Active Interceptors ({activeRuns.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveRuns([])}
              className="text-[11px] font-semibold hover:text-red-400 cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 rounded-xl border shadow-xs transition-all"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-raised)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    {run.type === 'browser' ? (
                      <Globe className="w-4 h-4" />
                    ) : run.type === 'terminal' ? (
                      <Terminal className="w-4 h-4" />
                    ) : run.type === 'jvm' ? (
                      <Coffee className="w-4 h-4" />
                    ) : run.type === 'android' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : run.type === 'frida' ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <Cpu className="w-4 h-4" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      <span className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
                        {run.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                      {run.pid > 0 && <span className="font-mono">PID: {run.pid}</span>}
                      <span>{run.details}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProcessFilter(run.name);
                      setActiveTab('requests');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 cursor-pointer transition-colors"
                    title="Filter Traffic to this app"
                  >
                    View Traffic
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (run.type === 'android') {
                        await handleStopADB(run.id.replace('adb-', ''));
                      } else if (run.type === 'frida') {
                        try {
                          await api.stopFrida(run.id);
                        } catch { /* non-fatal */ }
                        removeActiveInterceptor(run.id);
                      } else {
                        removeActiveInterceptor(run.id);
                      }
                      setActiveRuns((prev) => prev.filter((r) => r.id !== run.id));
                    }}
                    className="p-1 rounded-lg text-neutral-400 hover:text-red-400 cursor-pointer transition-colors"
                    title="Stop / Remove"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CATEGORY SELECTOR & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: 'All Interceptors', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'browser', label: 'Browsers', icon: <Globe className="w-3.5 h-3.5" /> },
            { id: 'terminal', label: 'Terminals & CLI', icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: 'java', label: 'Java / JVM', icon: <Coffee className="w-3.5 h-3.5" /> },
            { id: 'mobile', label: 'Mobile & ADB', icon: <Smartphone className="w-3.5 h-3.5" /> },
            { id: 'desktop', label: 'Custom Binary', icon: <Box className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`chip ${isActive ? 'chip-active' : ''}`}
                style={
                  isActive
                    ? {
                        background: `${activeColor.hex}18`,
                        color: activeColor.hex,
                        borderColor: `${activeColor.hex}40`,
                      }
                    : {}
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search interceptors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-9 text-xs"
          />
        </div>
      </div>

      {/* 3. NORMALIZED 3-COLUMN INTERCEPTORS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* === BROWSERS CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'browser') && (
          <>
            {apps
              .filter((a) => a.category === 'browser')
              .map((app) => (
                <div
                  key={app.id}
                  className="card group flex flex-col justify-between p-5 card-hover-lift"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl flex items-center justify-center text-blue-400 bg-blue-500/10 shadow-xs">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                            {app.name}
                          </h3>
                          <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                            Isolated Profile
                          </span>
                        </div>
                      </div>
                      <span className="badge-status badge-2xx">
                        Detected
                      </span>
                    </div>

                    <p
                      className="text-xs mt-3 line-clamp-2 leading-relaxed"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {app.description || 'Launches an isolated browser instance with proxy and certificates pre-configured.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <button
                      type="button"
                      onClick={() => handleLaunchBrowser(app)}
                      className="btn-primary w-full"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Launch {app.name}
                    </button>
                  </div>
                </div>
              ))}
          </>
        )}

        {/* === TERMINALS CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'terminal') && (
          <>
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-emerald-400 bg-emerald-500/10 shadow-xs">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        PowerShell / Terminal
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Environment Injected
                      </span>
                    </div>
                  </div>
                  <span className="badge-status badge-2xx">
                    Ready
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Spawns a shell with HTTP_PROXY, SSL_CERT_FILE, and Node/Python/Git CA variables pre-configured.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t flex gap-2" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => handleLaunchTerminal('powershell')}
                  className="btn-primary flex-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  PowerShell
                </button>
                <button
                  type="button"
                  onClick={() => handleLaunchTerminal('cmd')}
                  className="btn-ghost flex-1"
                >
                  CMD
                </button>
              </div>
            </div>
          </>
        )}

        {/* === JAVA / JVM CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'java') && (
          <>
            {/* Java Global Proxy Card */}
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-amber-400 bg-amber-500/10 shadow-xs">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        Java Global Proxy
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        JAVA_TOOL_OPTIONS
                      </span>
                    </div>
                  </div>
                  <span className={javaGlobalEnabled ? 'badge-status badge-2xx' : 'badge-status badge-pending'}>
                    {javaGlobalEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Sets JAVA_TOOL_OPTIONS and injects HTTPeek Root CA into Java truststores for all running JVMs.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={handleToggleJavaGlobal}
                  disabled={javaToggling}
                  className={javaGlobalEnabled ? 'btn-danger w-full' : 'btn-primary w-full'}
                >
                  {javaToggling ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : javaGlobalEnabled ? (
                    'Disable Java Global Proxy'
                  ) : (
                    'Enable Java Global Proxy'
                  )}
                </button>
              </div>
            </div>

            {/* Attach JVM Agent to Process Card */}
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-purple-400 bg-purple-500/10 shadow-xs">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        Attach JVM Agent
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Byte Buddy In-Process
                      </span>
                    </div>
                  </div>
                  <span className="badge-status badge-3xx">
                    v1.3.9 Agent
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Dynamically inject HTTPeek Java Agent into any running Java process, Tomcat, IDE, or Spring app.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={handleOpenJvmModal}
                  className="btn-ghost w-full"
                >
                  <Search className="w-3.5 h-3.5" />
                  Select Java Process...
                </button>
              </div>
            </div>
          </>
        )}

        {/* === MOBILE & ANDROID CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'mobile') && (
          <>
            {/* Android ADB Reverse Proxy Card */}
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-teal-400 bg-teal-500/10 shadow-xs">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        Android via ADB
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Reverse Port Forward
                      </span>
                    </div>
                  </div>
                  <span className="badge-status badge-2xx">
                    One-Click
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Connects to Android devices via ADB, configures adb reverse and automatically sets global proxy.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAndroidFridaMode('adb');
                    setIsAndroidFridaOpen(true);
                  }}
                  className="btn-primary w-full"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Connect via ADB...
                </button>
              </div>
            </div>

            {/* Frida SSL Pinning Bypass Card */}
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-rose-400 bg-rose-500/10 shadow-xs">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        Frida SSL Unpinning
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Mobile & Desktop Injection
                      </span>
                    </div>
                  </div>
                  <span className="badge-status badge-5xx">
                    Script Runner
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Inspect installed/running Android apps and dynamically inject Frida SSL unpinning scripts into apps or processes.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAndroidFridaMode('frida');
                    setIsAndroidFridaOpen(true);
                  }}
                  className="btn-ghost w-full"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Configure & Inject Frida...
                </button>
              </div>
            </div>
          </>
        )}

        {/* === CONTAINERS & CUSTOM EXECUTABLES === */}
        {(selectedCategory === 'all' || selectedCategory === 'desktop') && (
          <>
            <div className="card group flex flex-col justify-between p-5 card-hover-lift">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center text-indigo-400 bg-indigo-500/10 shadow-xs">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                        Custom Executable / Electron
                      </h3>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                        Binary Launcher
                      </span>
                    </div>
                  </div>
                  <span className="badge-status badge-3xx">
                    Custom
                  </span>
                </div>

                <p
                  className="text-xs mt-3 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Launch custom desktop apps, Slack, VS Code, or custom binary with injected proxy arguments.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="btn-ghost w-full"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Launch Custom App...
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === MODAL: JVM TARGET SELECTOR === */}
      {isJvmModalOpen && (
        <Dialog
          isOpen={isJvmModalOpen}
          onClose={() => setIsJvmModalOpen(false)}
          title="Attach JVM Agent to Process"
          subtitle="Select a running JVM process to dynamically instrument its HTTP/HTTPS client sockets."
          icon={<Coffee className="w-5 h-5 text-purple-400" />}
          iconColor="#c084fc"
          maxWidth="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsJvmModalOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachJvm}
                disabled={!selectedJvmPid || attachingJvm}
                className="btn-primary"
              >
                {attachingJvm ? 'Attaching...' : 'Attach Agent'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter Java processes by name or PID..."
                value={jvmFilter}
                onChange={(e) => setJvmFilter(e.target.value)}
                className="input-base pl-9"
              />
            </div>

            <div
              className="max-h-60 overflow-y-auto rounded-xl border flex flex-col divide-y"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-raised)' }}
            >
              {loadingJvm ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Scanning running JVM instances...</span>
                </div>
              ) : jvmTargets.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  No attachable JVM processes found. Make sure target Java app is running.
                </div>
              ) : (
                jvmTargets
                  .filter((t) => t.name.toLowerCase().includes(jvmFilter.toLowerCase()) || t.pid.includes(jvmFilter))
                  .map((target) => (
                    <div
                      key={target.pid}
                      onClick={() => setSelectedJvmPid(target.pid)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedJvmPid === target.pid
                          ? 'bg-purple-500/15 text-purple-400 font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="truncate" style={{ color: 'var(--color-text)' }}>{target.name || 'Unnamed Java App'}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>PID: {target.pid}</span>
                      </div>
                      {selectedJvmPid === target.pid && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                    </div>
                  ))
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* === MODAL: FRIDA INJECTION === */}
      {isFridaModalOpen && (
        <Dialog
          isOpen={isFridaModalOpen}
          onClose={() => setIsFridaModalOpen(false)}
          title="Frida SSL Unpinning Injection"
          subtitle="Dynamic SSL certificate pinning bypass for Android & desktop apps."
          icon={<Shield className="w-5 h-5 text-rose-500" />}
          iconColor="#f43f5e"
          maxWidth="max-w-md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsFridaModalOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSpawnFrida}
                disabled={!fridaApp.trim() || spawningFrida}
                className="btn-primary"
              >
                {spawningFrida ? 'Injecting...' : 'Inject & Launch'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <FormLabel label="Target Application Package / Executable" required />
              <FormInput
                type="text"
                placeholder="e.g. com.example.app or Twitter"
                value={fridaApp}
                onChange={(e) => setFridaApp(e.target.value)}
              />
            </div>

            <div>
              <FormLabel label="Device Serial (Optional, defaults to USB device)" />
              <FormInput
                type="text"
                placeholder="e.g. emulator-5554 or leave blank for -U"
                value={fridaSerial}
                onChange={(e) => setFridaSerial(e.target.value)}
              />
            </div>

            <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
              Uses bundled universal SSL unpinning script (`assets/frida/ssl_unpinning.js`) covering OkHttp, TrustKit, and Conscrypt.
            </p>
          </div>
        </Dialog>
      )}

      {/* === MODAL: CUSTOM APP LAUNCHER === */}
      {isCustomModalOpen && (
        <Dialog
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          title="Launch Custom Application"
          subtitle="Start any desktop binary or Electron app with proxy parameters injected."
          icon={<Box className="w-5 h-5 text-indigo-400" />}
          iconColor="#818cf8"
          maxWidth="max-w-md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchCustom}
                disabled={!customPath.trim() || launchingCustom}
                className="btn-primary"
              >
                {launchingCustom ? 'Launching...' : 'Launch & Intercept'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <FormLabel label="Executable Absolute Path" required />
              <FormInput
                type="text"
                placeholder="e.g. C:\Program Files\App\app.exe"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
            </div>

            <div>
              <FormLabel label="Extra Arguments (Optional)" />
              <FormInput
                type="text"
                placeholder="e.g. --enable-logging"
                value={customArgs}
                onChange={(e) => setCustomArgs(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* === MODAL: ANDROID & FRIDA STUDIO === */}
      {isAndroidFridaOpen && (
        <AndroidFridaModal
          isOpen={isAndroidFridaOpen}
          onClose={() => setIsAndroidFridaOpen(false)}
          initialMode={androidFridaMode}
          onInterceptionStarted={(run) => {
            setActiveRuns((prev) => [...prev, run]);
          }}
        />
      )}
    </div>
  );
};

