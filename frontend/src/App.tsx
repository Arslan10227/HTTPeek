import React, { useEffect, useState } from 'react';
import { DesktopHome } from './components/desktop/DesktopHome';
import { MobileHome } from './components/mobile/MobileHome';
import { RequestEditor } from './components/editor/RequestEditor';
import { ToastContainer } from './components/common/ToastContainer';
import { useProxyStore } from './store/useProxyStore';
import { useAppConfig } from './theme/useAppConfig';
import { useLogStore } from './store/useLogStore';
import { toast } from './store/useToastStore';
import { api } from './store/apiAdapter';
import { HttpRequest, HttpResponse, WsFrame, SSEEvent, BreakpointEvent } from './types';

export const App: React.FC = () => {
  const {
    setStatus,
    addRequest,
    updateResponse,
    addWsFrame,
    addSSEEvent,
    addBreakpoint,
    setFavorites,
  } = useProxyStore();

  const { themeMode, themeColor, autoStartup, getActiveColorPreset, getEffectiveIsDark } = useAppConfig();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || api.isMobile());
  const [activeBreakpoint, setActiveBreakpoint] = useState<BreakpointEvent | null>(null);

  // Responsive listener
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setIsMobile(window.innerWidth < 768 || api.isMobile());
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(debounceTimer);
    };
  }, []);

  // Theme & CSS Variables
  useEffect(() => {
    const isDark = getEffectiveIsDark();
    const activeColor = getActiveColorPreset();

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    document.documentElement.style.setProperty('--md-primary', activeColor.hex);
    document.documentElement.style.setProperty(
      '--md-primary-container',
      isDark ? activeColor.darkPrimaryContainer : activeColor.primaryContainer
    );
    document.documentElement.style.setProperty(
      '--md-on-primary-container',
      isDark ? activeColor.darkOnPrimaryContainer : activeColor.onPrimaryContainer
    );
  }, [themeMode, themeColor, getActiveColorPreset, getEffectiveIsDark]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;
      
      switch (e.key) {
        case 'k': // Ctrl/Cmd+K - focus search
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[placeholder*="Search"], input[placeholder*="Filter"]')?.focus();
          break;
        case 'l': // Ctrl/Cmd+L - clear requests
          if (e.shiftKey) {
            e.preventDefault();
            if (confirm('Clear all captured requests?')) {
              useProxyStore.getState().clearRequests();
            }
          }
          break;
        case 'ArrowDown': // Ctrl/Cmd+Down - select next
          e.preventDefault();
          useProxyStore.getState().selectNext();
          break;
        case 'ArrowUp': // Ctrl/Cmd+Up - select prev
          e.preventDefault();
          useProxyStore.getState().selectPrev();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Memory cleanup monitoring
  useEffect(() => {
    const { memoryCleanupThreshold } = useAppConfig.getState();
    if (!memoryCleanupThreshold) return;
    
    const interval = setInterval(() => {
      const { requests, clearRequests, maxRequests } = useProxyStore.getState();
      const threshold = memoryCleanupThreshold;
      if (requests.length > threshold) {
        // Keep the newest `maxRequests * 0.7` requests, discard oldest
        const keepCount = Math.floor(maxRequests * 0.7);
        const { selectedRequestId } = useProxyStore.getState();
        const kept = requests.slice(0, keepCount);
        const keptMap = new Map(kept.map(r => [r.id, r]));
        useProxyStore.setState({ 
          requests: kept, 
          requestMap: keptMap,
          selectedRequestId: keptMap.has(selectedRequestId || '') ? selectedRequestId : null,
          selectedRequest: keptMap.has(selectedRequestId || '') ? useProxyStore.getState().selectedRequest : null,
        });
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Backend Events & Initial Status Sync
  useEffect(() => {
    const initStatus = async () => {
      try {
        const s = await api.getStatus();
        const isCaInst = await api.checkCaInstalled();
        const updatedStatus = {
          ...(s || {}),
          caInstalled: isCaInst,
          isCaInstalled: isCaInst,
          running: s?.running ?? false,
        };
        setStatus(updatedStatus);

        if (autoStartup && !s?.running) {
          await api.start();
          setStatus({ ...updatedStatus, running: true });
        }
      } catch (e) {
        console.warn('Initial status fetch error:', e);
      }
    };
    initStatus();

    api.getFavorites().then((favs: HttpRequest[]) => {
      if (favs && Array.isArray(favs)) {
        setFavorites(favs.map((req) => ({ ...req, isFavorite: true })));
      }
    }).catch(console.error);

    api.on('proxy:request', (req: HttpRequest) => addRequest(req));
    api.on('proxy:response', (resp: HttpResponse) => updateResponse(resp));
    api.on('proxy:ws_frame', (frame: WsFrame) => addWsFrame(frame));
    api.on('proxy:sse_event', (event: SSEEvent) => addSSEEvent(event));
    api.on('breakpoint:paused', (event: BreakpointEvent) => {
      addBreakpoint(event);
      setActiveBreakpoint(event);
      toast.warning('Breakpoint Paused', `${event.request?.method} ${event.request?.url}`);
    });
    api.on('log:event', (entry: any) => {
      if (entry) {
        useLogStore.getState().addLog(entry.level || 'INFO', entry.category || 'Proxy', entry.message || '', entry.details);
      }
    });
    api.on('app:init_error', (entry: { message?: string }) => {
      if (entry?.message) {
        toast.error('Startup Error', entry.message);
      }
    });
  }, [addRequest, updateResponse, addWsFrame, addSSEEvent, addBreakpoint, setStatus, setFavorites]);

  return (
    <>
      {isMobile ? <MobileHome /> : <DesktopHome />}

      {/* Breakpoint Interceptor Popup */}
      {activeBreakpoint && (
        <RequestEditor
          request={activeBreakpoint.request}
          response={activeBreakpoint.response}
          source={
            (activeBreakpoint.stage === 'response' || activeBreakpoint.type === 'response')
              ? 'breakpointResponse'
              : 'breakpointRequest'
          }
          breakpointId={activeBreakpoint.requestId || activeBreakpoint.id || ''}
          onExecuteRequest={(modifiedReq) => {
            const bId = activeBreakpoint.requestId || activeBreakpoint.id || '';
            if (api.resumeBreakpoint) {
              api.resumeBreakpoint(bId, false, modifiedReq);
            }
            setActiveBreakpoint(null);
          }}
          onExecuteResponse={(modifiedResp) => {
            const bId = activeBreakpoint.requestId || activeBreakpoint.id || '';
            if (api.resumeBreakpoint) {
              api.resumeBreakpoint(bId, true, undefined, modifiedResp);
            }
            setActiveBreakpoint(null);
          }}
          onAbortBreakpoint={() => {
            const bId = activeBreakpoint.requestId || activeBreakpoint.id || '';
            const isResp = activeBreakpoint.stage === 'response' || activeBreakpoint.type === 'response';
            if (api.abortBreakpoint) {
              api.abortBreakpoint(bId, isResp);
            }
            setActiveBreakpoint(null);
          }}
          onClose={() => {
            const bId = activeBreakpoint.requestId || activeBreakpoint.id || '';
            const isResp = activeBreakpoint.stage === 'response' || activeBreakpoint.type === 'response';
            if (api.abortBreakpoint) {
              api.abortBreakpoint(bId, isResp);
            }
            setActiveBreakpoint(null);
          }}
        />
      )}

      <ToastContainer />
    </>
  );
};

export default App;
