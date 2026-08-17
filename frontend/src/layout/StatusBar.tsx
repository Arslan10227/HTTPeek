import React, { useEffect, useState } from 'react';
import { Play, Square, Shield, Globe, Pause, AlertTriangle } from 'lucide-react';
import { useProxyStore } from '../store/useProxyStore';
import { toast } from '../store/useToastStore';
import { logger } from '../store/useLogStore';
import { api } from '../store/apiAdapter';
import { chrome, spacing } from '../design/tokens';

export const StatusBar: React.FC = () => {
  const {
    status,
    setStatus,
    requests,
    capturePaused,
    getFilteredRequests,
  } = useProxyStore();
  const [port, setPort] = useState(status.port);

  useEffect(() => {
    setPort(status.port);
  }, [status.port]);

  const filteredCount = getFilteredRequests().length;

  const toggleProxy = async () => {
    try {
      if (status.running) {
        await api.stopProxy();
        setStatus({ ...status, running: false });
        toast.info('Proxy stopped');
      } else {
        const autoSystemProxy = typeof localStorage !== 'undefined'
          ? localStorage.getItem('httpeek_auto_system_proxy') !== 'false'
          : true;
        const enableSystemProxy = autoSystemProxy ? true : status.systemProxy;
        await api.startProxy(port, status.enableSsl, enableSystemProxy);
        setStatus({ ...status, running: true, port, systemProxy: enableSystemProxy });
        toast.success(`Proxy active on port ${port}`);
        logger.info('Proxy', `Started on port ${port}`);
      }
    } catch (e: any) {
      toast.error('Proxy error', e.message);
    }
  };

  const enableSystemProxy = async () => {
    if ((window as any).go?.main?.App?.SetSystemProxy) {
      await (window as any).go.main.App.SetSystemProxy(true);
    }
    setStatus({ ...status, systemProxy: true });
    toast.success('System proxy enabled');
  };

  return (
    <footer
      className="shrink-0 flex items-center gap-3 px-3 text-[11px] font-medium select-none overflow-x-auto"
      style={{
        height: spacing.statusBarHeight,
        backgroundColor: chrome.statusBarBg,
        color: chrome.statusBarText,
        borderTop: `1px solid ${chrome.statusBarBorder}`,
      }}
    >
      {/* Proxy status + toggle */}
      <button
        type="button"
        onClick={toggleProxy}
        className="flex items-center gap-2 shrink-0 hover:opacity-90 cursor-pointer transition-opacity"
        title={status.running ? 'Click to stop proxy' : 'Click to start proxy'}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: status.running ? chrome.statusRunning : chrome.statusStopped,
            boxShadow: status.running ? `0 0 6px ${chrome.statusRunning}` : undefined,
          }}
        />
        <span>
          {status.running
            ? `Proxy active on port ${status.port}`
            : 'Proxy not running'}
        </span>
        <span className="opacity-60">
          {status.running ? <Square className="w-3 h-3 inline" /> : <Play className="w-3 h-3 inline" />}
        </span>
      </button>

      <span className="opacity-30">|</span>

      {/* Port (when stopped) */}
      {!status.running && (
        <>
          <label className="flex items-center gap-1 shrink-0">
            <span className="opacity-60">Port</span>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value, 10) || 9099)}
              className="w-14 bg-transparent border rounded px-1 py-0 font-mono text-[10px] focus:outline-none"
              style={{ borderColor: chrome.statusBarBorder, color: chrome.statusBarText }}
            />
          </label>
          <span className="opacity-30">|</span>
        </>
      )}

      {/* SSL */}
      <span className="flex items-center gap-1 shrink-0" title="HTTPS decryption">
        <Shield className="w-3 h-3" style={{ color: status.enableSsl ? chrome.statusRunning : chrome.statusStopped }} />
        <span>{status.enableSsl ? 'HTTPS decrypt on' : 'HTTPS decrypt off'}</span>
      </span>

      <span className="opacity-30">|</span>

      {/* System proxy */}
      <span className="flex items-center gap-1 shrink-0" title="System proxy">
        <Globe className="w-3 h-3" style={{ color: status.systemProxy ? chrome.statusRunning : chrome.statusStopped }} />
        <span>{status.systemProxy ? 'System proxy on' : 'System proxy off'}</span>
      </span>

      {status.running && !status.systemProxy && (
        <button
          type="button"
          onClick={enableSystemProxy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer shrink-0"
          style={{ backgroundColor: '#e8a838', color: '#1a1a1a' }}
        >
          <AlertTriangle className="w-3 h-3" />
          Enable system proxy
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Capture paused */}
      {capturePaused && (
        <>
          <span className="flex items-center gap-1 text-amber-400 shrink-0">
            <Pause className="w-3 h-3" /> Capture paused
          </span>
          <span className="opacity-30">|</span>
        </>
      )}

      {/* Exchange count */}
      <span className="font-mono shrink-0 opacity-80">
        {filteredCount} / {requests.length} exchanges
      </span>
    </footer>
  );
};
