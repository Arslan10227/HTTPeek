import React, { useState, useEffect } from 'react';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { NetworkTabController } from '../panel/NetworkTabController';
import { History as HistoryIcon, Download, Upload, Trash2, Calendar, Search } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';

interface HistorySession {
  id: string;
  name: string;
  timestamp: number;
  count: number;
  requests?: HttpRequest[];
}

interface HistoryPageProps {
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const { t } = useTranslation();
  const { panelRatio, getActiveColorPreset } = useAppConfig();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);
  const [selectedReq, setSelectedReq] = useState<HttpRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const activeColor = getActiveColorPreset();

  const fetchSessions = async () => {
    try {
      const list = await api.listSessions();
      if (list && Array.isArray(list)) {
        setSessions(list);
        if (list.length > 0 && !selectedSession) setSelectedSession(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = async (sess: HistorySession) => {
    setSelectedSession(sess);
    try {
      const reqs = await api.getSessionRequests(sess.id);
      setSessions((prev) => prev.map((s) => (s.id === sess.id ? { ...s, requests: reqs } : s)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async () => {
    try {
      await api.createSession(`Session ${new Date().toLocaleString()}`);
      toast.success('Session created');
      fetchSessions();
    } catch (e: any) {
      toast.error('Create failed', e?.message);
    }
  };

  const handleImportHAR = async () => {
    try {
      await api.importHAR('');
      toast.success('HAR imported');
      fetchSessions();
    } catch (e: any) {
      toast.error('Import failed', e?.message);
    }
  };

  const handleExportSessionHAR = async (session: HistorySession) => {
    try {
      await api.exportHAR(session.requests || []);
      toast.success(t.exportSuccess, `${session.name}.har`);
    } catch (e: any) {
      toast.error(t.exportFailed, e?.message);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      const next = sessions.filter((s) => s.id !== sessionId);
      setSessions(next);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(next[0] || null);
      }
      toast.info(t.deleteSuccess);
    } catch (e: any) {
      toast.error('Delete failed', e?.message);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 select-none">
      {/* Sessions & Requests Split */}
      <div
        className="flex flex-col border-r overflow-hidden min-h-0"
        style={{
          width: `${panelRatio * 100}%`,
          minWidth: '260px',
          maxWidth: '80%',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        {/* Top Actions */}
        <div
          className="flex items-center justify-between p-2.5 border-b shrink-0 text-xs"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <div className="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
            <HistoryIcon className="w-4 h-4" style={{ color: activeColor.hex }} />
            <span>History Sessions</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreateSession}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
              title="Save Current Traffic as New Session"
            >
              <HistoryIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleImportHAR}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              title="Import HAR File"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-1 min-h-0 font-mono text-xs">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
              <Calendar className="w-8 h-8 opacity-30 mb-2" />
              <span>No recorded sessions</span>
            </div>
          ) : (
            sessions.map((sess) => {
              const isSelected = selectedSession?.id === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-sans font-medium text-xs">{sess.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(sess.timestamp).toLocaleDateString()}  •  {sess.count} requests
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSessionHAR(sess);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 cursor-pointer"
                      title="Export HAR"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(sess.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Inspector */}
      <NetworkTabController
        request={selectedReq}
        onEditAndResend={onEditAndResend}
        onOpenRewriteRule={onOpenRewriteRule}
        onOpenMapLocal={onOpenMapLocal}
        onOpenBreakpoint={onOpenBreakpoint}
      />
    </div>
  );
};
