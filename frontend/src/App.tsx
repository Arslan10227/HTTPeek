import React, { useEffect, useState } from 'react';
import { DesktopHome } from './components/desktop/DesktopHome';
import { MobileHome } from './components/mobile/MobileHome';
import { RequestEditor } from './components/editor/RequestEditor';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmModal } from './components/common/ConfirmModal';
import { confirm } from './store/useConfirmDialog';
import { useProxyStore } from './store/useProxyStore';
import { useAppConfig } from './theme/useAppConfig';
import { useLogStore } from './store/useLogStore';
import { toast } from './store/useToastStore';
import { api } from './store/apiAdapter';
import { HttpRequest, HttpResponse, WsFrame, SSEEvent, BreakpointEvent } from './types';
import { parseHarOrJsonContent } from './utils/exportHelper';

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

  const { themeMode, themeColor, useMaterial3, autoStartup, getActiveColorPreset, getEffectiveIsDark } = useAppConfig();
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

    // Material 3 / Classic UI toggle
    if (useMaterial3) {
      document.documentElement.classList.add('m3-theme');
      document.documentElement.setAttribute('data-theme-style', 'm3');
    } else {
      document.documentElement.classList.remove('m3-theme');
      document.documentElement.setAttribute('data-theme-style', 'classic');
    }

    const root = document.documentElement;

    // Primary brand color — propagate to ALL CSS custom properties so every
    // component using var(--color-primary) immediately reflects the new color.
    root.style.setProperty('--color-primary', activeColor.hex);
    root.style.setProperty('--color-primary-dim', isDark
      ? `${activeColor.hex}1F`   // ~12% alpha
      : `${activeColor.hex}26`); // ~15% alpha
    root.style.setProperty('--color-primary-border', isDark
      ? `${activeColor.hex}40`   // ~25% alpha
      : `${activeColor.hex}4D`); // ~30% alpha

    // Material 3 aliases kept in sync
    root.style.setProperty('--md-primary', activeColor.hex);
    root.style.setProperty(
      '--md-primary-container',
      isDark ? activeColor.darkPrimaryContainer : activeColor.primaryContainer
    );
    root.style.setProperty(
      '--md-on-primary-container',
      isDark ? activeColor.darkOnPrimaryContainer : activeColor.onPrimaryContainer
    );
  }, [themeMode, themeColor, useMaterial3, getActiveColorPreset, getEffectiveIsDark]);

  // Core System-level Drag & Drop HAR / JSON file ingestion
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file.name.endsWith('.har') || file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const reqs = parseHarOrJsonContent(text);
          if (reqs.length > 0) {
            useProxyStore.getState().setRequests(reqs);
            useProxyStore.getState().setActiveTab('requests');
            toast.success(`Imported ${reqs.length} requests from dropped file`, file.name);
          }
        } catch (err: any) {
          toast.error('Failed to import dropped file', err?.message || String(err));
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

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
            confirm({
              title: 'Clear Requests',
              message: 'Clear all captured requests in current session?',
              type: 'warning',
              confirmText: 'Clear',
            }).then((ok) => {
              if (ok) useProxyStore.getState().clearRequests();
            });
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
    const onBreakpoint = (event: BreakpointEvent) => {
      addBreakpoint(event);
      setActiveBreakpoint(event);
      toast.warning('Breakpoint Paused', `${event.request?.method} ${event.request?.url}`);
    };
    api.on('breakpoint:paused', onBreakpoint);
    const onLogEvent = (entry: any) => {
      if (entry) {
        useLogStore.getState().addLog(entry.level || 'INFO', entry.category || 'Proxy', entry.message || '', entry.details);
      }
    };
    api.on('log:event', onLogEvent);
    const onInitError = (entry: { message?: string }) => {
      if (entry?.message) {
        toast.error('Startup Error', entry.message);
      }
    };
    api.on('app:init_error', onInitError);

    // Cleanup event listeners on unmount / strict-mode re-run (DEEP-039).
    return () => {
      api.off('proxy:request', addRequest);
      api.off('proxy:response', updateResponse);
      api.off('proxy:ws_frame', addWsFrame);
      api.off('proxy:sse_event', addSSEEvent);
      api.off('breakpoint:paused', onBreakpoint);
      api.off('log:event', onLogEvent);
      api.off('app:init_error', onInitError);
    };
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
      <ConfirmModal />
    </>
  );
};

export default App;
