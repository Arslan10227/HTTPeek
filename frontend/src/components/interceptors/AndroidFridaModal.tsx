import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Shield,
  Play,
  Zap,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Layers,
  Activity,
  Cpu,
  Terminal,
  ArrowRight,
  Download,
  Check,
  XCircle,
  FileText,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { api } from '../../store/apiAdapter';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { Dialog, FormLabel, FormInput, FormMonospaceInput } from '../ui/Dialog';

export interface AndroidAppItem {
  package: string;
  name: string;
  pid: number;
  isRunning: boolean;
  isSystem: boolean;
}

export interface ADBDeviceItem {
  serial: string;
  state: string;
  model: string;
  rooted: boolean;
}

interface AndroidFridaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'frida' | 'adb';
  onInterceptionStarted?: (run: { id: string; name: string; pid: number; type: string; details: string }) => void;
}

export const AndroidFridaModal: React.FC<AndroidFridaModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'frida',
  onInterceptionStarted,
}) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<'frida' | 'adb'>(initialMode);
  const [devices, setDevices] = useState<ADBDeviceItem[]>([]);
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [scanningDevices, setScanningDevices] = useState(false);

  // App listing
  const [appTab, setAppTab] = useState<'installed' | 'running' | 'manual'>('installed');
  const [installedApps, setInstalledApps] = useState<AndroidAppItem[]>([]);
  const [runningApps, setRunningApps] = useState<AndroidAppItem[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Manual input
  const [manualPackage, setManualPackage] = useState('');
  const [customScript, setCustomScript] = useState('');

  // Live action progress state
  const [injecting, setInjecting] = useState(false);
  const [activeStepText, setActiveStepText] = useState<string>('');
  const [executionError, setExecutionError] = useState<string | null>(null);

  // 1. Scan devices on mount
  const refreshDevices = async () => {
    setScanningDevices(true);
    setExecutionError(null);
    try {
      const devs = await api.listADBDevices();
      setDevices(devs || []);
      if (devs && devs.length > 0) {
        if (!selectedSerial || !devs.find((d: any) => d.serial === selectedSerial)) {
          setSelectedSerial(devs[0].serial);
        }
      } else {
        setSelectedSerial('');
      }
    } catch (e: any) {
      toast.error('ADB Scan Failed', e?.message || String(e));
    } finally {
      setScanningDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDevices();
    }
  }, [isOpen]);

  // 2. Fetch installed & running apps when device is selected
  const fetchApps = async (serial: string) => {
    if (!serial) {
      setInstalledApps([]);
      setRunningApps([]);
      return;
    }
    setLoadingApps(true);
    setExecutionError(null);
    try {
      const [installed, running] = await Promise.all([
        api.listAndroidInstalledApps(serial).catch(() => []),
        api.listAndroidRunningApps(serial).catch(() => []),
      ]);
      setInstalledApps(installed || []);
      setRunningApps(running || []);
    } catch (e: any) {
      console.warn('App discovery error:', e);
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    if (selectedSerial && isOpen && mode === 'frida') {
      fetchApps(selectedSerial);
    }
  }, [selectedSerial, isOpen, mode]);

  // 3. Deploy Frida Server Manually
  const handleDeployFridaServer = async () => {
    if (!selectedSerial) return;
    setInjecting(true);
    setExecutionError(null);
    setActiveStepText('1/3: Detecting device architecture & pushing bundled frida-server...');
    try {
      await api.deployFridaServer(selectedSerial);
      setActiveStepText('2/3: Booting frida-server daemon & forwarding port 27042...');
      await new Promise((r) => setTimeout(r, 600));
      setActiveStepText('3/3: Frida daemon active and ready!');
      toast.success('Frida Server Ready', `Deployed and active on ${selectedSerial}`);
      fetchApps(selectedSerial);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setExecutionError(msg);
      toast.error('Frida Deployment Failed', msg);
    } finally {
      setInjecting(false);
    }
  };

  // 4. Handle Frida Spawn (New App Instance)
  const handleSpawnApp = async (targetPackage: string) => {
    if (!targetPackage) return;
    setInjecting(true);
    setExecutionError(null);
    setActiveStepText(`1/3: Preparing target ${targetPackage} and checking Frida daemon...`);
    try {
      await new Promise((r) => setTimeout(r, 300));
      setActiveStepText(`2/3: Injecting SSL unpinning script into ${targetPackage}...`);
      const runId = await api.launchFrida(targetPackage, customScript, selectedSerial);
      setActiveStepText(`3/3: Successfully hooked ${targetPackage}!`);
      toast.success('Frida Active', `Spawned ${targetPackage} with SSL unpinning`);
      useProxyStore.getState().addActiveInterceptor({
        id: runId || `frida-${targetPackage}-${Date.now()}`,
        type: 'frida',
        name: `Frida: ${targetPackage}`,
        runId: runId,
        deviceSerial: selectedSerial,
      });
      if (onInterceptionStarted) {
        onInterceptionStarted({
          id: runId || `frida-${targetPackage}-${Date.now()}`,
          name: `Frida: ${targetPackage}`,
          pid: 0,
          type: 'frida',
          details: 'SSL Unpinning (Spawned)',
        });
      }
      onClose();
    } catch (e: any) {
      const msg = e?.message || String(e);
      setExecutionError(msg);
      toast.error('Frida Spawn Failed', msg);
    } finally {
      setInjecting(false);
    }
  };

  // 5. Handle Frida Attach (Inject into Running App)
  const handleAttachApp = async (target: AndroidAppItem) => {
    setInjecting(true);
    setExecutionError(null);
    const identifier = target.pid > 0 ? String(target.pid) : target.package;
    setActiveStepText(`1/3: Connecting to process ${target.name || identifier} (PID: ${target.pid})...`);
    try {
      await new Promise((r) => setTimeout(r, 300));
      setActiveStepText(`2/3: Injecting SSL unpinning script into PID ${target.pid}...`);
      const runId = await api.launchFridaAttach(identifier, customScript, selectedSerial);
      setActiveStepText(`3/3: Successfully hooked ${target.name || identifier}!`);
      toast.success('Frida Attached', `Attached to ${target.name || target.package} (PID: ${target.pid})`);
      useProxyStore.getState().addActiveInterceptor({
        id: runId || `frida-attach-${target.package}-${Date.now()}`,
        type: 'frida',
        name: `Frida: ${target.name || target.package}`,
        runId: runId,
        deviceSerial: selectedSerial,
      });
      if (onInterceptionStarted) {
        onInterceptionStarted({
          id: runId || `frida-attach-${target.package}-${Date.now()}`,
          name: `Frida: ${target.name || target.package}`,
          pid: target.pid,
          type: 'frida',
          details: `SSL Hook (PID: ${target.pid})`,
        });
      }
      onClose();
    } catch (e: any) {
      const msg = e?.message || String(e);
      setExecutionError(msg);
      toast.error('Frida Attach Failed', msg);
    } finally {
      setInjecting(false);
    }
  };

  // 6. Handle ADB Reverse Proxy Interception
  const handleStartADB = async () => {
    if (!selectedSerial) return;
    setInjecting(true);
    setExecutionError(null);
    setActiveStepText('1/3: Configuring ADB reverse port forward tcp:9099...');
    try {
      await new Promise((r) => setTimeout(r, 300));
      setActiveStepText('2/3: Applying Android global proxy settings...');
      const runId = await api.startADBInterception(selectedSerial);
      setActiveStepText('3/3: Android ADB Interception Active!');
      toast.success('Android Interception Active', `Device ${selectedSerial} reverse port forward configured`);
      useProxyStore.getState().addActiveInterceptor({
        id: runId || `adb-${selectedSerial}`,
        type: 'adb',
        name: `ADB: ${selectedSerial}`,
        deviceSerial: selectedSerial,
      });
      if (onInterceptionStarted) {
        onInterceptionStarted({
          id: runId || `adb-${selectedSerial}`,
          name: `Android: ${selectedSerial}`,
          pid: 0,
          type: 'android',
          details: 'Reverse Proxy :9099 Active',
        });
      }
      onClose();
    } catch (e: any) {
      const msg = e?.message || String(e);
      setExecutionError(msg);
      toast.error('ADB Interception Failed', msg);
    } finally {
      setInjecting(false);
    }
  };

  const filteredInstalled = installedApps.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.package.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRunning = runningApps.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.package.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(a.pid).includes(searchQuery)
  );

  const selectedDeviceObj = devices.find((d) => d.serial === selectedSerial);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Android Interception & Frida Studio"
      subtitle="Connect to Android via ADB, inspect installed/running apps, and inject Frida SSL unpinning scripts."
      icon={<Smartphone className="w-5 h-5 text-emerald-400" />}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {selectedDeviceObj ? (
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{selectedDeviceObj.model || selectedDeviceObj.serial}</span>
                {selectedDeviceObj.rooted && <span className="badge-status badge-2xx text-[10px]">Rooted</span>}
              </span>
            ) : (
              <span>No device connected</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* ── 1. DEVICE SELECTOR BAR ─────────────────────────── */}
        <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs block" style={{ color: 'var(--color-text)' }}>
                Target Android Device
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {devices.length === 0 ? (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No ADB devices detected. Plug in via USB or start an emulator.
                  </span>
                ) : (
                  <select
                    value={selectedSerial}
                    onChange={(e) => setSelectedSerial(e.target.value)}
                    className="input-base py-1 px-2 text-xs font-mono w-full sm:w-auto min-w-[220px] cursor-pointer"
                  >
                    {devices.map((d) => (
                      <option key={d.serial} value={d.serial}>
                        {d.model ? `${d.model} (${d.serial})` : d.serial} {d.rooted ? '[ROOT]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshDevices}
              disabled={scanningDevices || injecting}
              className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
              title="Rescan ADB Devices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningDevices ? 'animate-spin' : ''}`} />
              <span>Scan Devices</span>
            </button>

            {mode === 'frida' && selectedSerial && (
              <button
                type="button"
                onClick={handleDeployFridaServer}
                disabled={injecting}
                className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5 text-rose-400 hover:text-rose-300"
                title="Push and start bundled frida-server on device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Deploy Frida Daemon</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 2. LIVE PROGRESS & STATUS OVERLAY ──────────────── */}
        {injecting && (
          <div className="p-3.5 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs">Operation in Progress</div>
              <div className="font-mono text-[11px] truncate text-emerald-400/90">{activeStepText}</div>
            </div>
          </div>
        )}

        {/* ── 3. DIAGNOSTIC ERROR ALERT ──────────────────────── */}
        {executionError && (
          <div className="p-3.5 rounded-2xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-rose-300">Interception Operation Failed</div>
                <div className="font-mono text-[11px] mt-0.5 text-rose-200/90 break-all">{executionError}</div>
              </div>
            </div>
            <div className="text-[11px] text-rose-400/80 bg-black/20 p-2 rounded-xl flex items-center justify-between">
              <span>💡 Check USB Debugging is ON & verify <code className="font-mono text-rose-300">proxypin.log</code> for full details.</span>
              <button
                type="button"
                onClick={() => setExecutionError(null)}
                className="text-[10px] text-rose-300 underline cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── 4. INTERCEPTION MODE SELECTOR ─────────────────── */}
        <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => {
              setMode('frida');
              setExecutionError(null);
            }}
            className={`chip cursor-pointer transition-all ${mode === 'frida' ? 'chip-active' : ''}`}
            style={mode === 'frida' ? { background: 'rgba(244,63,94,0.12)', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' } : {}}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Frida SSL Pinning Bypass</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('adb');
              setExecutionError(null);
            }}
            className={`chip cursor-pointer transition-all ${mode === 'adb' ? 'chip-active' : ''}`}
            style={mode === 'adb' ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', borderColor: 'rgba(16,185,129,0.3)' } : {}}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>ADB Reverse Proxy</span>
          </button>
        </div>

        {/* ── MODE: FRIDA APP SELECTOR & INJECTOR ─────────────── */}
        {mode === 'frida' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-100">
            {/* Sub-tabs: Installed Apps vs Running Apps vs Manual */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAppTab('installed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    appTab === 'installed'
                      ? 'bg-black/10 dark:bg-white/10 text-emerald-400 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Installed Apps ({installedApps.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAppTab('running')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    appTab === 'running'
                      ? 'bg-black/10 dark:bg-white/10 text-emerald-400 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Running Apps ({runningApps.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAppTab('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    appTab === 'manual'
                      ? 'bg-black/10 dark:bg-white/10 text-emerald-400 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Manual Entry
                </button>
              </div>

              {appTab !== 'manual' && (
                <div className="relative w-full sm:w-48">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search package..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-base pl-7 py-1 text-xs"
                  />
                </div>
              )}
            </div>

            {/* TAB: INSTALLED APPS LIST */}
            {appTab === 'installed' && (
              <div
                className="max-h-64 overflow-y-auto border rounded-2xl p-1.5 flex flex-col gap-1"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-raised)',
                }}
              >
                {loadingApps ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Loading installed Android packages...</span>
                  </div>
                ) : filteredInstalled.length === 0 ? (
                  <div className="text-center text-neutral-400 py-10 italic text-xs">
                    {devices.length === 0
                      ? 'Connect an Android device via USB to inspect packages'
                      : 'No installed packages found matching query'}
                  </div>
                ) : (
                  filteredInstalled.map((app) => (
                    <div
                      key={app.package}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="truncate min-w-0">
                          <div className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
                            {app.name}
                          </div>
                          <div className="font-mono text-[10px] truncate" style={{ color: 'var(--color-text-subtle)' }}>
                            {app.package}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSpawnApp(app.package)}
                        disabled={injecting}
                        className="btn-primary py-1 px-3 text-xs shrink-0 flex items-center gap-1.5 shadow-xs"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Spawn & Hook</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: RUNNING APPS LIST */}
            {appTab === 'running' && (
              <div
                className="max-h-64 overflow-y-auto border rounded-2xl p-1.5 flex flex-col gap-1"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-raised)',
                }}
              >
                {loadingApps ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Querying active Android processes...</span>
                  </div>
                ) : filteredRunning.length === 0 ? (
                  <div className="text-center text-neutral-400 py-10 italic text-xs">
                    {devices.length === 0
                      ? 'Connect an Android device via USB to inspect running processes'
                      : 'No active running app processes found matching query'}
                  </div>
                ) : (
                  filteredRunning.map((app) => (
                    <div
                      key={`${app.package}-${app.pid}`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="truncate min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate" style={{ color: 'var(--color-text)' }}>
                              {app.name}
                            </span>
                            {app.pid > 0 && (
                              <span className="badge-status badge-2xx font-mono text-[9px] py-0 px-1.5">
                                PID: {app.pid}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] truncate" style={{ color: 'var(--color-text-subtle)' }}>
                            {app.package}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAttachApp(app)}
                        disabled={injecting}
                        className="btn-primary py-1 px-3 text-xs shrink-0 flex items-center gap-1.5 shadow-xs"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Inject & Hook</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: MANUAL ENTRY */}
            {appTab === 'manual' && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <FormLabel label="Target Application Package or Process Name" required />
                  <FormMonospaceInput
                    placeholder="e.g. com.twitter.android or Twitter"
                    value={manualPackage}
                    onChange={(e) => setManualPackage(e.target.value)}
                  />
                </div>

                <div>
                  <FormLabel label="Custom Frida Script Path (Optional, defaults to bundled SSL unpinning)" />
                  <FormMonospaceInput
                    placeholder="Leave empty for bundled ssl_unpinning.js"
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSpawnApp(manualPackage.trim())}
                    disabled={!manualPackage.trim() || injecting}
                    className="btn-primary flex-1"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Spawn New Instance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAttachApp({
                        package: manualPackage.trim(),
                        name: manualPackage.trim(),
                        pid: 0,
                        isRunning: true,
                        isSystem: false,
                      })
                    }
                    disabled={!manualPackage.trim() || injecting}
                    className="btn-ghost flex-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Attach to Running Process</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MODE: ADB REVERSE PROXY ─────────────────────────── */}
        {mode === 'adb' && (
          <div className="flex flex-col gap-4 p-5 rounded-2xl border bg-black/5 dark:bg-white/5 animate-in fade-in duration-100" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                  One-Click ADB Reverse Proxy Interception
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Configures <code className="font-mono text-teal-400">adb reverse tcp:9099 tcp:9099</code> with automated fallback to Host LAN IP for Wi-Fi devices, and sets global Android proxy settings.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-black/10 dark:bg-white/5 flex items-center justify-between text-xs" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-neutral-400">Target Device Serial:</span>
              <span className="font-mono font-bold text-emerald-400">{selectedSerial || 'None Selected'}</span>
            </div>

            <button
              type="button"
              onClick={handleStartADB}
              disabled={!selectedSerial || injecting}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Connect & Intercept Device via ADB</span>
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
