import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  Download, 
  Upload,
  Search, 
  FileText,
  RefreshCw,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { useUiStore } from '../../store/useUiStore';
import { HttpRequest } from '../../types';
import { LottiePlayer } from '../common/LottiePlayer';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { MethodBadge } from '../ui/MethodBadge';
import { StatusBadge } from '../ui/StatusBadge';

interface SessionItem {
  id: string;
  name: string;
  createdAt: string;
  requestCount: number;
  fileSize: number;
}

export const HistoryView: React.FC = () => {
  const { setActiveTab, addRequest, clearRequests } = useProxyStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [sessionRequests, setSessionRequests] = useState<HttpRequest[]>([]);
  const [selectedHistoricalReq, setSelectedHistoricalReq] = useState<HttpRequest | null>(null);
  const [reqSearch, setReqSearch] = useState('');
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'request' | 'response'>('overview');
  const [exportingHar, setExportingHar] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      if ((window as any).go?.main?.App?.ListSessions) {
        const list = await (window as any).go.main.App.ListSessions();
        setSessions(list || []);
        if (list && list.length > 0 && !selectedSession) {
          handleSelectSession(list[0]);
        }
      }
    } catch (e) {
      console.error('Fetch sessions error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = async (session: SessionItem) => {
    setSelectedSession(session);
    setSelectedHistoricalReq(null);
    try {
      if ((window as any).go?.main?.App?.GetSessionRequests) {
        const reqs = await (window as any).go.main.App.GetSessionRequests(session.id);
        setSessionRequests(reqs || []);
        if (reqs && reqs.length > 0) {
          setSelectedHistoricalReq(reqs[0]);
        }
      }
    } catch (e) {
      console.error('Load session requests error:', e);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this recorded session?')) return;
    try {
      if ((window as any).go?.main?.App?.DeleteSession) {
        await (window as any).go.main.App.DeleteSession(id);
        const next = sessions.filter((s) => s.id !== id);
        setSessions(next);
        if (selectedSession?.id === id) {
          if (next.length > 0) {
            handleSelectSession(next[0]);
          } else {
            setSelectedSession(null);
            setSessionRequests([]);
            setSelectedHistoricalReq(null);
          }
        }
      }
    } catch (e) {
      console.error('Delete session error:', e);
    }
  };

  const handleCreateSession = async () => {
    const name = prompt('Enter new session name:', `Capture ${new Date().toLocaleTimeString()}`);
    if (!name) return;
    try {
      if ((window as any).go?.main?.App?.CreateNewSession) {
        const sess = await (window as any).go.main.App.CreateNewSession(name);
        if (sess) {
          setSessions([sess, ...sessions]);
          handleSelectSession(sess);
        }
      }
    } catch (e) {
      console.error('Create session error:', e);
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
            await fetchSessions();
            await handleSelectSession(sess);
          }
        }
      } catch (err: any) {
        alert('Failed to import HAR file: ' + (err.message || err));
      }
    };
    input.click();
  };

  const handleExportSessionHAR = async () => {
    if (!sessionRequests || sessionRequests.length === 0) return;
    setExportingHar(true);
    try {
      if ((window as any).go?.main?.App?.ExportHAR) {
        const harStr = await (window as any).go.main.App.ExportHAR(sessionRequests);
        const blob = new Blob([harStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedSession?.name || 'session'}.har`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert('Failed to export HAR: ' + (err.message || err));
    } finally {
      setExportingHar(false);
    }
  };

  const handleRestoreToLive = () => {
    if (!sessionRequests || sessionRequests.length === 0) return;
    if (confirm('Restore this historical session into the live Capture workspace?')) {
      clearRequests();
      sessionRequests.forEach((r) => addRequest(r));
      setActiveTab('capture');
      useUiStore.getState().setSidebarTab('view');
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRequests = useMemo(() => {
    if (!reqSearch.trim()) return sessionRequests;
    const q = reqSearch.toLowerCase();
    return sessionRequests.filter(
      (r) =>
        r.url.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        (r.hostPort?.host && r.hostPort.host.toLowerCase().includes(q))
    );
  }, [sessionRequests, reqSearch]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden font-sans select-none bg-[var(--htk-bg)]">
      <div className="w-72 bg-[var(--htk-panel)] border-r border-[var(--htk-panel-border)] flex flex-col shrink-0">
        <div className="htk-pane-header">
          <span className="flex-1">Sessions</span>
          <button type="button" onClick={handleImportHAR} title="Import .HAR File" className="htk-btn-icon">
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={handleCreateSession} title="Create New Session" className="htk-btn-icon">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={fetchSessions} title="Refresh" className="htk-btn-icon">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-2 border-b border-[var(--htk-panel-border)]">
          <div className="htk-input-wrap">
            <Search className="htk-input-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="htk-input"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="htk-empty">
              <LottiePlayer type="empty" width={75} height={75} className="mb-1" />
              <p className="htk-empty-title">No Recorded Sessions</p>
              <p className="text-[10px] mt-0.5">Captures are auto-saved to persistent SQLite archive</p>
            </div>
          ) : (
            filteredSessions.map((sess) => {
              const isSelected = selectedSession?.id === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess)}
                  className={`htk-row group ${isSelected ? 'htk-row-selected' : ''}`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold truncate">{sess.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: 'var(--htk-text-muted)' }}>
                      <span>{sess.requestCount} requests</span>
                      <span>•</span>
                      <span>{formatBytes(sess.fileSize)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    className="opacity-0 group-hover:opacity-100 htk-btn-icon"
                    style={{ color: 'var(--htk-danger)' }}
                    title="Delete Session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="w-[420px] bg-[var(--htk-panel)] border-r border-[var(--htk-panel-border)] flex flex-col shrink-0">
        <div className="htk-pane-header">
          <span className="truncate flex-1">
            {selectedSession ? selectedSession.name : 'No Session Selected'}
          </span>
          <span className="htk-count-badge">{filteredRequests.length}</span>
          {selectedSession && (
            <>
              <button
                onClick={handleExportSessionHAR}
                disabled={exportingHar || sessionRequests.length === 0}
                className="htk-btn"
                title="Export this session as .HAR archive"
              >
                <Download className="w-3 h-3" />
                <span>Export HAR</span>
              </button>
              <button
                onClick={handleRestoreToLive}
                disabled={sessionRequests.length === 0}
                className="htk-btn htk-btn-primary"
                title="Restore into active workspace"
              >
                <ArrowRight className="w-3 h-3" />
                <span>Restore</span>
              </button>
            </>
          )}
        </div>

        <div className="p-2 border-b border-[var(--htk-panel-border)]">
          <div className="htk-input-wrap">
            <Search className="htk-input-icon" />
            <input
              type="text"
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
              placeholder="Filter session requests..."
              className="htk-input"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-xs">
          {filteredRequests.length === 0 ? (
            <div className="htk-empty">
              <FileText className="w-6 h-6 mb-1" style={{ color: 'var(--htk-text-muted)' }} />
              <p className="htk-empty-title">No Requests in Session</p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isSelected = selectedHistoricalReq?.id === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedHistoricalReq(req)}
                  className={`htk-row ${isSelected ? 'htk-row-selected' : ''}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                    <MethodBadge method={req.method} />
                    <span className="truncate text-xs">{req.url}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge code={req.response?.statusCode} />
                    <span className="text-[10px] font-sans" style={{ color: 'var(--htk-text-muted)' }}>{req.durationMs}ms</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 bg-[var(--htk-panel)] flex flex-col overflow-hidden">
        {selectedHistoricalReq ? (
          <InspectorPanel key={selectedHistoricalReq.id} request={selectedHistoricalReq} />
        ) : (
          <div className="htk-empty flex-1">
            <LottiePlayer type="empty" width={100} height={100} className="mb-2" />
            <p className="htk-empty-title">Select a Request to Inspect</p>
            <p className="text-xs mt-0.5 text-center max-w-xs">View full headers, cookies, formatted JSON payload, raw hex data, and timing breakdown</p>
          </div>
        )}
      </div>
    </div>
  );
};
