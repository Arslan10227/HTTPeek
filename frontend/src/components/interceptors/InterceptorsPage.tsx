import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Rocket,
  Globe,
  Terminal,
  Coffee,
  Smartphone,
  Shield,
  Box,
  FolderOpen,
  Play,
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
  Flame,
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

  // Refresh Active Runs
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

  // Open JVM attach modal
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
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [apps, searchQuery, selectedCategory]);

  // Categories list with counts
  const categories = useMemo(() => {
    const browserCount = apps.filter((a) => a.category === 'browser').length;
    return [
      { id: 'all', label: 'All Targets', icon: <Layers className="w-3.5 h-3.5" />, count: apps.length + 5 },
      { id: 'browser', label: 'Browsers', icon: <Globe className="w-3.5 h-3.5" />, count: browserCount },
      { id: 'terminal', label: 'Terminals & CLI', icon: <Terminal className="w-3.5 h-3.5" />, count: 2 },
      { id: 'java', label: 'Java / JVM', icon: <Coffee className="w-3.5 h-3.5" />, count: 2 },
      { id: 'mobile', label: 'Mobile & ADB', icon: <Smartphone className="w-3.5 h-3.5" />, count: 2 },
      { id: 'desktop', label: 'Custom App', icon: <Box className="w-3.5 h-3.5" />, count: 1 },
    ];
  }, [apps]);

  return (
    <div
      className="flex-1 h-full overflow-y-auto p-6 flex flex-col gap-6 select-none font-sans"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* ── 1. ACTIVE PER-APP RUNS HUB ────────────────────────────────────────── */}
      {activeRuns.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-slate-900/40 to-slate-900/60 p-4 shadow-xl backdrop-blur-xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Active Interceptors ({activeRuns.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveRuns([])}
              className="text-[11px] font-medium text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
            >
              Dismiss All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 shadow-sm transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0 border border-emerald-500/20 shadow-xs">
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
                      <span className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
                        {run.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                      {run.pid > 0 && <span>PID: {run.pid}</span>}
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
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 cursor-pointer transition-colors"
                  >
                    View Traffic
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (run.type === 'frida') {
                        try {
                          await api.stopFrida(run.id);
                        } catch { /* non-fatal */ }
                      }
                      removeActiveInterceptor(run.id);
                      setActiveRuns((prev) => prev.filter((r) => r.id !== run.id));
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                    title="Stop Interceptor"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. CATEGORY SELECTOR & SEARCH BAR ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
          {categories.map((tab) => {
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search launch targets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-sans bg-white/5 hover:bg-white/8 focus:bg-white/10 border border-white/10 focus:border-emerald-500/50 text-slate-200 placeholder-slate-500 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. REFINED 3-COLUMN INTERCEPTORS GRID ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* === BROWSERS CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'browser') && (
          <>
            {apps
              .filter((a) => a.category === 'browser')
              .map((app) => {
                const isChrome = app.name.toLowerCase().includes('chrome');
                const isEdge = app.name.toLowerCase().includes('edge');
                const isFirefox = app.name.toLowerCase().includes('firefox');

                return (
                  <div
                    key={app.id}
                    className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 backdrop-blur-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl flex items-center justify-center shadow-lg border ${
                            isChrome
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : isEdge
                              ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                              : isFirefox
                              ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          }`}>
                            {isFirefox ? <Flame className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors">
                              {app.name}
                            </h3>
                            <span className="text-[11px] text-slate-400">
                              Isolated Profile & Proxy
                            </span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Detected
                        </span>
                      </div>

                      <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                        {app.description || 'Launches an isolated browser instance with proxy and certificates pre-configured.'}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleLaunchBrowser(app)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-emerald-500 hover:text-slate-950 border border-white/10 hover:border-emerald-400 cursor-pointer transition-all duration-200 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Launch {app.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </>
        )}

        {/* === TERMINALS CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'terminal') && (
          <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/5 transition-all duration-300 backdrop-blur-xl">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                      PowerShell / Terminal
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Environment Injected Shell
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ready
                </span>
              </div>

              <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                Spawns a shell with HTTP_PROXY, SSL_CERT_FILE, and Node/Python/Git CA variables pre-configured.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/10 flex gap-2.5">
              <button
                type="button"
                onClick={() => handleLaunchTerminal('powershell')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-cyan-500 hover:text-slate-950 border border-white/10 hover:border-cyan-400 cursor-pointer transition-all duration-200"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PowerShell</span>
              </button>
              <button
                type="button"
                onClick={() => handleLaunchTerminal('cmd')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/15 border border-white/10 cursor-pointer transition-all duration-200"
              >
                <span>CMD</span>
              </button>
            </div>
          </div>
        )}

        {/* === JAVA / JVM CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'java') && (
          <>
            {/* Java Global Proxy Card */}
            <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300 backdrop-blur-xl">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-amber-500/10 border-amber-500/20 text-amber-400">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                        Java Global Proxy
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        JAVA_TOOL_OPTIONS
                      </span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    javaGlobalEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${javaGlobalEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    {javaGlobalEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  Sets JAVA_TOOL_OPTIONS and injects HTTPeek Root CA into Java truststores for all running JVMs.
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleToggleJavaGlobal}
                  disabled={javaToggling}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 border ${
                    javaGlobalEnabled
                      ? 'bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border-rose-500/30'
                      : 'bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border-white/10 hover:border-amber-400'
                  }`}
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

            {/* Attach JVM Agent Card */}
            <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/5 transition-all duration-300 backdrop-blur-xl">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-purple-500/10 border-purple-500/20 text-purple-400">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 group-hover:text-purple-400 transition-colors">
                        Attach JVM Agent
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Byte Buddy In-Process
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    v1.3.9 Agent
                  </span>
                </div>

                <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  Dynamically inject HTTPeek Java Agent into any running Java process, Tomcat, IDE, or Spring app.
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleOpenJvmModal}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-purple-500 hover:text-white border border-white/10 hover:border-purple-400 cursor-pointer transition-all duration-200"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Select Java Process...</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* === MOBILE & ANDROID CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'mobile') && (
          <>
            {/* Android ADB Card */}
            <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-teal-500/30 hover:shadow-2xl hover:shadow-teal-500/5 transition-all duration-300 backdrop-blur-xl">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-teal-500/10 border-teal-500/20 text-teal-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 group-hover:text-teal-400 transition-colors">
                        Android via ADB
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Reverse Port Forward
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    One-Click
                  </span>
                </div>

                <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  Connects to Android devices via ADB, configures adb reverse and automatically sets global proxy.
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setAndroidFridaMode('adb');
                    setIsAndroidFridaOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-teal-500 hover:text-slate-950 border border-white/10 hover:border-teal-400 cursor-pointer transition-all duration-200"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Connect via ADB...</span>
                </button>
              </div>
            </div>

            {/* Frida SSL Pinning Card */}
            <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/5 transition-all duration-300 backdrop-blur-xl">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-rose-500/10 border-rose-500/20 text-rose-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 group-hover:text-rose-400 transition-colors">
                        Frida SSL Unpinning
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Mobile & Desktop Injection
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Script Runner
                  </span>
                </div>

                <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  Inspect installed/running Android apps and dynamically inject Frida SSL unpinning scripts into apps or processes.
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setAndroidFridaMode('frida');
                    setIsAndroidFridaOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-rose-500 hover:text-white border border-white/10 hover:border-rose-400 cursor-pointer transition-all duration-200"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Configure & Inject Frida...</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* === CUSTOM EXECUTABLES CATEGORY === */}
        {(selectedCategory === 'all' || selectedCategory === 'desktop') && (
          <div className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 backdrop-blur-xl">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl flex items-center justify-center shadow-lg border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                      Custom Executable / Electron
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Binary Launcher
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Custom
                </span>
              </div>

              <p className="text-xs mt-3.5 text-slate-400 line-clamp-2 leading-relaxed font-sans">
                Launch custom desktop apps, Slack, VS Code, or custom binary with injected proxy arguments.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-indigo-500 hover:text-white border border-white/10 hover:border-indigo-400 cursor-pointer transition-all duration-200"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Launch Custom App...</span>
              </button>
            </div>
          </div>
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
