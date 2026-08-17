import React from 'react';
import { Star, Shield, Cpu, Clock, HardDrive } from 'lucide-react';
import { HttpRequest } from '../../types';

interface MobileRequestCardProps {
  request: HttpRequest;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onLongPress?: () => void;
}

export const MobileRequestCard: React.FC<MobileRequestCardProps> = ({
  request,
  isSelected,
  onSelect,
  onToggleFavorite,
  onLongPress,
}) => {
  const getMethodBadge = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'POST': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PUT': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DELETE': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'PATCH': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (code?: number) => {
    if (!code) return 'bg-slate-300 text-slate-600';
    if (code >= 200 && code < 300) return 'bg-emerald-500 text-white';
    if (code >= 300 && code < 400) return 'bg-sky-500 text-white';
    if (code >= 400 && code < 500) return 'bg-amber-500 text-white';
    return 'bg-rose-500 text-white';
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
      className={`p-3.5 border-b border-slate-100 transition-all active:scale-[0.99] select-none cursor-pointer ${
        isSelected
          ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600 shadow-xs'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      {/* Header Row: Method + Status + Host + Time + Favorite */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${getMethodBadge(request.method)}`}>
            {request.method}
          </span>

          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${getStatusColor(request.response?.statusCode)}`}>
            {request.response?.statusCode || '...'}
          </span>

          <span className="font-semibold text-xs text-slate-800 truncate font-sans">
            {request.hostPort?.host || 'unknown'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            {formatTime(request.startTime)}
          </span>

          <button
            onClick={onToggleFavorite}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                request.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Path & Query Line */}
      <p className="text-xs text-slate-600 font-mono truncate mb-2">
        {request.path || request.url || '/'}
      </p>

      {/* Footer Metrics Row: Duration, Size, SSL, Process */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-50 font-sans">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="font-mono">{request.durationMs ? `${request.durationMs}ms` : 'pending'}</span>
          </span>

          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-slate-400" />
            <span className="font-mono">{formatSize(request.response?.bodySize)}</span>
          </span>

          {request.hostPort?.ssl && (
            <span className="flex items-center gap-0.5 text-emerald-600 font-semibold">
              <Shield className="w-3 h-3" />
              <span>SSL</span>
            </span>
          )}
        </div>

        {request.process?.name && (
          <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] truncate max-w-[120px]">
            <Cpu className="w-2.5 h-2.5 text-slate-400" />
            <span className="truncate">{request.process.name}</span>
          </span>
        )}
      </div>
    </div>
  );
};
