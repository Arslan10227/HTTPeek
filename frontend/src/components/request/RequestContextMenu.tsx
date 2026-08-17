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
  Download,
  Trash2,
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
  const { toggleFavorite, removeRequest } = useProxyStore();
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

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(request.url);
    toast.success(t.copied, request.url);
    onClose();
  };

  const handleCopyCurl = () => {
    let curl = `curl -X ${request.method} '${request.url}'`;
    if (request.headers) {
      Object.entries(request.headers).forEach(([k, v]) => {
        curl += ` \\\n  -H '${k}: ${v}'`;
      });
    }
    if (request.body) {
      curl += ` \\\n  --data-raw '${request.body.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard.writeText(curl);
    toast.success(t.copied, 'cURL command copied');
    onClose();
  };

  const handleRepeat = async () => {
    try {
      if (api.repeatRequest) {
        await api.repeatRequest(request.id);
      }
      toast.success(t.success, `Replaying ${request.method} ${request.url}`);
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
    onClose();
  };

  const handleFavorite = () => {
    toggleFavorite(request.id);
    toast.info(request.isFavorite ? t.removeFavorite : t.addFavorite);
    onClose();
  };

  const handleBlock = async () => {
    try {
      const urlObj = new URL(request.url);
      const pattern = `${urlObj.hostname}${urlObj.pathname}`;
      if (api.addBlockRule) {
        await api.addBlockRule({ urlPattern: pattern, enabled: true });
        toast.success(t.addSuccess, `Blocked ${pattern}`);
      }
    } catch (e: any) {
      toast.error(t.fail, e?.message);
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
      className="fixed z-50 w-52 rounded-xl shadow-2xl py-1.5 border text-xs flex flex-col animate-in fade-in zoom-in-95 duration-75 select-none"
      style={{
        left: Math.min(position.x, window.innerWidth - 220),
        top: Math.min(position.y, window.innerHeight - 340),
        backgroundColor: 'var(--md-dialog-bg)',
        borderColor: 'var(--md-sys-color-divider)',
        color: 'var(--md-sys-color-on-surface)',
      }}
    >
      <button
        type="button"
        onClick={handleCopyUrl}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Copy className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.copyUrl}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyCurl}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Terminal className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.copyCurl}</span>
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

      <button
        type="button"
        onClick={handleRepeat}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
      >
        <Play className="w-3.5 h-3.5" />
        <span>{t.repeat}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onEditAndResend(request);
        }}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Edit3 className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.edit} & {t.send}</span>
      </button>

      <button
        type="button"
        onClick={handleFavorite}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Heart
          className={`w-3.5 h-3.5 ${
            request.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-500'
          }`}
        />
        <span>{request.isFavorite ? t.removeFavorite : t.addFavorite}</span>
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenRewriteRule?.(request);
        }}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <FileCode className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.requestRewrite}</span>
      </button>

      <button
        type="button"
        onClick={handleBlock}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <Ban className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.requestBlock}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenMapLocal?.(request);
        }}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <MapPin className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.requestMap}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenBreakpoint?.(request);
        }}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
      >
        <PauseCircle className="w-3.5 h-3.5 text-gray-500" />
        <span>{t.breakpoint}</span>
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

      <button
        type="button"
        onClick={handleDelete}
        className="flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium text-red-500"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>{t.delete}</span>
      </button>
    </div>
  );
};
