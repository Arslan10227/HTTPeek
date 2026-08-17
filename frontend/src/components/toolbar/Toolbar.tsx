import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Square, 
  Trash2, 
  Search, 
  Download, 
  Upload, 
  Layers,
  ShieldCheck,
  Sliders,
  History,
  Wrench,
  Settings
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useUiStore } from '../../store/useUiStore';
import { useThemeStore, THEME_OPTIONS } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { logger } from '../../store/useLogStore';
import { api } from '../../store/apiAdapter';
import { ColorfulIcon } from '../common/ColorfulIcon';
import { RoughTrafficMeter } from '../common/RoughTrafficMeter';
import { MobileSyncModal } from '../ssl/MobileSyncModal';
import { RequestComposerModal } from '../composer/RequestComposerModal';
import { EnvironmentModal } from '../environment/EnvironmentModal';
import { HostFilterModal } from '../filter/HostFilterModal';
import { LogViewerModal } from '../logs/LogViewerModal';
import { StatusPill } from '../common/StatusPill';

export const Toolbar: React.FC = () => {
  const { 
    status, 
    setStatus, 
    searchQuery, 
    setSearchQuery, 
    clearRequests,
    requests,
    environments,
    activeEnvironmentId,
    setActiveEnvironmentId
  } = useProxyStore();
  const { openDrawer } = useUiStore();
  const { theme, setTheme } = useThemeStore();
  const [port, setPort] = useState(status.port);
  const [isMobileSyncOpen, setIsMobileSyncOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isHostFilterOpen, setIsHostFilterOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  useEffect(() => {
    setPort(status.port);
  }, [status.port]);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  const handleExportAllHAR = async () => {
    if (!requests || requests.length === 0) {
      toast.warning('No captured traffic to export');
      return;
    }
    try {
      if ((window as any).go?.main?.App?.ExportHAR) {
        const harStr = await (window as any).go.main.App.ExportHAR(requests);
        const blob = new Blob([harStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `httpeek-capture-${Date.now()}.har`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${requests.length} requests to .har`);
        logger.info('HAR', `Exported ${requests.length} captured requests to HAR archive`);
      }
    } catch (e: any) {
      toast.error('Export HAR failed', e.message || String(e));
      logger.error('HAR', `Export HAR failed: ${e.message || e}`);
    }
  };

  const handleImportHAR = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.har,application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        if ((window as any).go?.main?.App?.ImportHAR) {
          const sess = await (window as any).go.main.App.ImportHAR(text, file.name.replace(/\.har$/i, ''));
          if (sess) {
            toast.success(`Imported HAR as recorded session "${sess.name}"`);
            logger.info('HAR', `Imported HAR file "${file.name}" as recorded session ID: ${sess.id}`);
          }
        }
      } catch (err: any) {
        toast.error('Failed to import HAR file', err.message || String(err));
        logger.error('HAR', `Import HAR failed: ${err.message || err}`);
      }
    };
    input.click();
  };

  const toggleProxy = async () => {
    try {
      if (status.running) {
        await api.stopProxy();
        setStatus({ ...status, running: false });
        toast.info('Proxy server stopped');
        logger.info('Proxy', 'Proxy engine stopped');
      } else {
        const autoSystemProxy = typeof localStorage !== 'undefined'
          ? localStorage.getItem('httpeek_auto_system_proxy') !== 'false'
          : true;
        const enableSystemProxy = autoSystemProxy ? true : status.systemProxy;
        await api.startProxy(port, status.enableSsl, enableSystemProxy);
        setStatus({ ...status, running: true, port, systemProxy: enableSystemProxy });
        toast.success(`Proxy active on port ${port}`);
        logger.info('Proxy', `Proxy engine started on port ${port} (SSL: ${status.enableSsl}, System: ${enableSystemProxy})`);
      }
    } catch (e: any) {
      toast.error('Proxy operation error', e.message || String(e));
      logger.error('Proxy', `Failed to toggle proxy: ${e.message || e}`);
    }
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 select-none shrink-0 font-sans shadow-xs overflow-x-auto">
      {/* Left: Server Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Start / Stop Toggle Button with Pulse Animation */}
        <button
          onClick={toggleProxy}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95 ${
            status.running
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 ring-2 ring-emerald-500/20 animate-pulse'
          }`}
        >
          {status.running ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start</span>
            </>
          )}
        </button>

        <StatusPill status={status} />

        {/* Port Input */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-slate-400 font-mono text-[11px] mr-1.5">Port:</span>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 9099)}
            disabled={status.running}
            className="w-14 bg-transparent text-slate-800 font-mono font-bold focus:outline-none disabled:text-slate-500 cursor-text"
          />
        </div>

        {/* SSL MITM Toggle */}
        <button
          onClick={() => {
            const next = !status.enableSsl;
            setStatus({ ...status, enableSsl: next });
            toast.info(`SSL MITM Decryption ${next ? 'Enabled' : 'Disabled'}`);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            status.enableSsl
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
          title="Toggle SSL / HTTPS Decryption"
        >
          <ColorfulIcon name="shield-ssl" size={15} />
          <span className="hidden sm:inline">SSL Decrypt</span>
        </button>

        {/* Mobile Connect + HTTPS Trust (combined) */}
        <button
          onClick={() => setIsMobileSyncOpen(true)}
          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
          title="Mobile Connect & Android HTTPS Certificate"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <ColorfulIcon name="mobile" size={15} className="hidden sm:block" />
        </button>

        {/* Request Composer */}
        <button
          onClick={() => setIsComposerOpen(true)}
          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          title="Open Request Composer (Postman-style)"
        >
          <ColorfulIcon name="composer" size={15} />
        </button>

        {/* Host Filter Modal */}
        <button
          onClick={() => setIsHostFilterOpen(true)}
          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer hidden sm:flex items-center"
          title="Configure Host Whitelist / Blacklist"
        >
          <ColorfulIcon name="filter" size={15} />
        </button>

        {/* Environment Selector */}
        <button
          onClick={() => setIsEnvModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer max-w-[140px]"
          title="Manage Environments"
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{activeEnv?.name || 'Environment'}</span>
        </button>

        {/* HAR Import / Export */}
        <button
          onClick={handleImportHAR}
          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer hidden lg:flex items-center"
          title="Import HAR Archive"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          onClick={handleExportAllHAR}
          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors cursor-pointer hidden lg:flex items-center"
          title="Export All Traffic as HAR"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Clear Button */}
        <button
          onClick={clearRequests}
          title="Clear Traffic List"
          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
        >
          <ColorfulIcon name="trash" size={14} />
        </button>

        {/* Rough.js Network Throughput Meter */}
        <div className="hidden lg:block">
          <RoughTrafficMeter requestCount={requests.length} activeCount={status.running ? 1 : 0} />
        </div>
      </div>

      {/* Middle: Search & Filter Bar */}
      <div className="flex-1 max-w-xs min-w-[120px]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter: status:200 domain:api.*"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-400 transition-all font-mono"
          />
        </div>
      </div>

      {/* Right: Theme Switcher, Logs & View Mode */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Centralized Theme Switcher */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
          <ColorfulIcon name="palette" size={14} className="ml-1" />
          <select
            value={theme}
            onChange={(e) => {
              const selected = e.target.value as any;
              setTheme(selected);
              toast.info(`Theme set to ${THEME_OPTIONS.find((t) => t.id === selected)?.name || selected}`);
            }}
            className="bg-transparent text-slate-700 text-xs font-semibold px-1.5 py-1 focus:outline-none cursor-pointer"
            title="Switch UI Theme"
          >
            {THEME_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Centralized System Logs Button */}
        <button
          onClick={() => setIsLogModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          title="Open Centralized Diagnostics & Rule Logs"
        >
          <ColorfulIcon name="logs" size={14} />
          <span className="hidden sm:inline">Logs</span>
        </button>

        {/* View tools drawer shortcuts (desktop) */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          {[
            { tab: 'rules' as const, icon: Sliders, title: 'Rules' },
            { tab: 'history' as const, icon: History, title: 'History' },
            { tab: 'toolbox' as const, icon: Wrench, title: 'Toolbox' },
            { tab: 'settings' as const, icon: Settings, title: 'Settings' },
          ].map(({ tab, icon: Icon, title }) => (
            <button
              key={tab}
              type="button"
              onClick={() => openDrawer(tab)}
              className="p-1.5 rounded-md text-slate-600 hover:text-emerald-800 hover:bg-white transition-all cursor-pointer"
              title={title}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Connect & Certificate Modal */}
      <MobileSyncModal
        isOpen={isMobileSyncOpen}
        onClose={() => setIsMobileSyncOpen(false)}
      />

      {/* Request Composer Modal */}
      <RequestComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />

      {/* Environment Management Modal */}
      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
      />

      {/* Host Filter Whitelist/Blacklist Modal */}
      <HostFilterModal
        isOpen={isHostFilterOpen}
        onClose={() => setIsHostFilterOpen(false)}
      />

      {/* Centralized System Logs Modal */}
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
};
