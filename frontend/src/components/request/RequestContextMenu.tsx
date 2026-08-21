import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Terminal,
  Play,
  Edit3,
  Heart,
  Ban,
  FileCode,
  MapPin,
  PauseCircle,
  Shield,
  ShieldAlert,
  Trash2,
  Share2,
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface RequestContextMenuProps {
  request: HttpRequest;
  position: ContextMenuPosition;
  onClose: () => void;
  onEditAndResend: (req: HttpRequest) => void;
  onOpenRewriteRule?: (req: HttpRequest) => void;
  onOpenMapLocal?: (req: HttpRequest) => void;
  onOpenBreakpoint?: (req: HttpRequest) => void;
}

export const RequestContextMenu: React.FC<RequestContextMenuProps> = ({
  request,
  position,
  onClose,
  onEditAndResend,
  onOpenRewriteRule,
  onOpenMapLocal,
  onOpenBreakpoint,
}) => {
  const { t } = useTranslation();
  const { toggleFavorite, removeRequest, filterConfig, setFilterConfig } = useProxyStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const hostDomain = request.hostPort?.host || '';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(request.url);
    toast.success(t.copied || 'Copied', request.url);
    onClose();
  };

  const handleCopyCurl = () => {
    let curl = `curl -X ${request.method} '${request.url}'`;
    if (request.headers) {
      Object.entries(request.headers).forEach(([k, v]) => {
        curl += ` \\\n  -H '${k}: ${v}'`;
      });
    }
    if (request.body || request.bodyString) {
      const b = request.bodyString || request.body || '';
      curl += ` \\\n  --data-raw '${b.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard.writeText(curl);
    toast.success(t.copied || 'Copied', 'cURL command copied');
    onClose();
  };

  const handleRepeat = async () => {
    try {
      if ((window as any).go?.main?.App?.ReplayRequest) {
        await (window as any).go.main.App.ReplayRequest(request);
      } else if (api.repeatRequest) {
        await api.repeatRequest(request.id);
      }
      toast.success(t.success || 'Success', `Replaying ${request.method} ${request.url}`);
    } catch (e: any) {
      toast.error(t.fail || 'Failed', e?.message);
    }
    onClose();
  };

  const handleFavorite = () => {
    toggleFavorite(request.id);
    toast.info(request.isFavorite ? (t.removeFavorite || 'Removed Favorite') : (t.addFavorite || 'Added Favorite'));
    onClose();
  };

  const handleBlockUrl = async () => {
    try {
      let pattern = request.url;
      try {
        const u = new URL(request.url);
        pattern = `${u.hostname}${u.pathname}`;
      } catch { /* ignore */ }

      if (api.addBlockRule) {
        await api.addBlockRule({ urlPattern: pattern, statusCode: 403, enabled: true });
        toast.success('Blocked URL', pattern);
      }
    } catch (e: any) {
      toast.error(t.fail || 'Failed', e?.message);
    }
    onClose();
  };

  const handleAddHostFilter = async (mode: 'whitelist' | 'blacklist') => {
    if (!hostDomain) return;
    const rulePattern = `*.${hostDomain}`;
    const currentRules = filterConfig.rules || [];
    if (currentRules.includes(rulePattern)) {
      toast.info('Rule already exists', rulePattern);
      onClose();
      return;
    }
    const nextRules = [...currentRules, rulePattern];
    const newCfg = { mode, rules: nextRules };
    try {
      if (api.setFilterConfig) {
        await api.setFilterConfig(newCfg);
      }
      setFilterConfig(newCfg);
      toast.success(
        mode === 'whitelist' ? 'Added to Whitelist' : 'Added to Blacklist',
        rulePattern
      );
    } catch (e: any) {
      toast.error('Filter update failed', e?.message);
    }
    onClose();
  };

  const handleDelete = () => {
    removeRequest(request.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-56 rounded-2xl shadow-2xl p-1.5 border text-xs flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-75 select-none"
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y, window.innerHeight - 420),
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border-strong)',
        color: 'var(--color-text)',
      }}
    >
      <span className="section-label px-2.5 py-1">Quick Actions</span>

      <button
        type="button"
        onClick={handleCopyUrl}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Copy className="w-3.5 h-3.5 text-neutral-400" />
        <span>{t.copyUrl || 'Copy URL'}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyCurl}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Terminal className="w-3.5 h-3.5 text-neutral-400" />
        <span>{t.copyCurl || 'Copy as cURL'}</span>
      </button>

      <button
        type="button"
        onClick={handleRepeat}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-emerald-400"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>{t.repeat || 'Replay Request'}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onEditAndResend(request);
        }}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
        <span>Edit in Composer</span>
      </button>

      <button
        type="button"
        onClick={handleFavorite}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Heart
          className={`w-3.5 h-3.5 ${
            request.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'
          }`}
        />
        <span>{request.isFavorite ? (t.removeFavorite || 'Remove Favorite') : (t.addFavorite || 'Add Favorite')}</span>
      </button>

      <div className="h-px my-1" style={{ backgroundColor: 'var(--color-border)' }} />
      <span className="section-label px-2.5 py-1">Rule Builders</span>

      {/* Rewrite Rule from Request */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenRewriteRule?.(request);
        }}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-blue-400"
      >
        <FileCode className="w-3.5 h-3.5" />
        <span>Create Rewrite Rule...</span>
      </button>

      {/* Breakpoint from Request */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenBreakpoint?.(request);
        }}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-purple-400"
      >
        <PauseCircle className="w-3.5 h-3.5" />
        <span>Set Breakpoint on URL...</span>
      </button>

      {/* Mock / Map Local from Request */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenMapLocal?.(request);
        }}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-amber-400"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>Mock Response (Map Local)...</span>
      </button>

      {/* Block URL */}
      <button
        type="button"
        onClick={handleBlockUrl}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-rose-400"
      >
        <Ban className="w-3.5 h-3.5" />
        <span>Block / Drop URL (403)</span>
      </button>

      {/* Whitelist / Blacklist Host */}
      {hostDomain && (
        <>
          <button
            type="button"
            onClick={() => handleAddHostFilter('whitelist')}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-teal-400"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">Whitelist *.{hostDomain}</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddHostFilter('blacklist')}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-amber-400"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="truncate">Blacklist *.{hostDomain}</span>
          </button>
        </>
      )}

      <div className="h-px my-1" style={{ backgroundColor: 'var(--color-border)' }} />

      <button
        type="button"
        onClick={handleDelete}
        className="flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-xl hover:bg-rose-500/10 cursor-pointer font-medium text-rose-400"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete from List</span>
      </button>
    </div>
  );
};
