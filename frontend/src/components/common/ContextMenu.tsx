import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { 
  Copy, 
  Terminal, 
  Play, 
  RotateCw, 
  Edit3, 
  Star, 
  Sliders, 
  Trash2,
  Globe,
  PauseCircle,
  FileCode,
  Check,
  ShieldAlert,
  Layers,
  FileJson,
  Download
} from 'lucide-react';
import { HttpRequest } from '../../types';
import { toast } from '../../store/useToastStore';
import { exportRequests } from '../../utils/exportHelper';

interface ContextMenuProps {
  x: number;
  y: number;
  request: HttpRequest;
  onClose: () => void;
  onReplay: (req: HttpRequest) => void;
  onRepeatModal: (req: HttpRequest) => void;
  onCompose: (req: HttpRequest) => void;
  onToggleFavorite: (id: string) => void;
  onCreateRule: (type: 'rewrite' | 'mock' | 'breakpoint', req: HttpRequest) => void;
  onDelete: (id: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  request,
  onClose,
  onReplay,
  onRepeatModal,
  onCompose,
  onToggleFavorite,
  onCreateRule,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Intelligent bounds detection: prevent menu from clipping outside screen viewport
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 8;
      let left = x;
      let top = y;

      if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding;
      }
      if (top + rect.height > window.innerHeight - padding) {
        top = window.innerHeight - rect.height - padding;
      }
      if (left < padding) left = padding;
      if (top < padding) top = padding;

      setPos({ left, top });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const copyWithFeedback = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const getRequestBody = () => request.bodyString || request.body || '';
  const getResponseBody = () => request.response?.bodyString || request.response?.body || '';

  const copyAsCurl = () => {
    const method = request.method || 'GET';
    let curl = `curl -X ${method} "${request.url}"`;
    if (request.headers) {
      Object.entries(request.headers).forEach(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : String(v);
        curl += ` \\\n  -H "${k}: ${val.replace(/"/g, '\\"')}"`;
      });
    }
    const body = getRequestBody();
    if (body) {
      curl += ` \\\n  --data '${body.replace(/'/g, "'\\''")}'`;
    }
    copyWithFeedback(curl, 'curl');
  };

  const copyUrl = () => {
    copyWithFeedback(request.url || '', 'url');
  };

  const copyReqHeaders = () => {
    const lines = Object.entries(request.headers || {}).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
    );
    copyWithFeedback(lines.join('\n'), 'reqHeaders');
  };

  const copyRespHeaders = () => {
    const lines = Object.entries(request.response?.headers || {}).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
    );
    copyWithFeedback(lines.join('\n'), 'respHeaders');
  };

  const copyReqBody = () => {
    copyWithFeedback(getRequestBody(), 'reqBody');
  };

  const copyRespBody = () => {
    copyWithFeedback(getResponseBody(), 'respBody');
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
      className="htk-context-menu animate-in fade-in zoom-in-95 duration-75"
    >
      <div className="htk-context-menu-label">Copy & Export</div>
      <button
        onClick={copyAsCurl}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Copy as cURL</span>
        </div>
        {copiedKey === 'curl' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
      </button>
      <button
        onClick={copyUrl}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Copy URL</span>
        </div>
        {copiedKey === 'url' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
      </button>
      <button
        onClick={copyReqHeaders}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-muted)' }} />
          <span>Copy Request Headers</span>
        </div>
        {copiedKey === 'reqHeaders' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
      </button>
      {request.response && (
        <button
          onClick={copyRespHeaders}
          className="htk-context-menu-item"
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-muted)' }} />
            <span>Copy Response Headers</span>
          </div>
          {copiedKey === 'respHeaders' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
        </button>
      )}
      <button
        onClick={copyReqBody}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-muted)' }} />
          <span>Copy Request Body</span>
        </div>
        {copiedKey === 'reqBody' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
      </button>
      {request.response && (
        <button
          onClick={copyRespBody}
          className="htk-context-menu-item"
        >
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-muted)' }} />
            <span>Copy Response Body</span>
          </div>
          {copiedKey === 'respBody' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--htk-success)' }} />}
        </button>
      )}

      <div className="htk-context-menu-divider" />

      <div className="htk-context-menu-label">Export Single Request</div>
      <button
        onClick={() => {
          exportRequests([request], 'har', `request_${request.id}`);
          onClose();
        }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>Export as .HAR</span>
        </div>
      </button>
      <button
        onClick={() => {
          exportRequests([request], 'json', `request_${request.id}`);
          onClose();
        }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5 text-amber-500" />
          <span>Export as .JSON</span>
        </div>
      </button>
      <button
        onClick={() => {
          exportRequests([request], 'sh', `request_${request.id}`);
          onClose();
        }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-purple-500" />
          <span>Export as .SH cURL Replay</span>
        </div>
      </button>

      <div className="htk-context-menu-divider" />

      <div className="htk-context-menu-label">Execution</div>
      <button
        onClick={() => { onReplay(request); onClose(); }}
        className="htk-context-menu-item"
        style={{ fontWeight: 600, color: 'var(--htk-accent-hover)' }}
      >
        <div className="flex items-center gap-2">
          <Play className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Replay Request (1x)</span>
        </div>
      </button>
      <button
        onClick={() => { onRepeatModal(request); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <RotateCw className="w-3.5 h-3.5" style={{ color: 'var(--htk-warning)' }} />
          <span>Repeat Request (Nx)...</span>
        </div>
      </button>
      <button
        onClick={() => { onCompose(request); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--htk-text-secondary)' }} />
          <span>Edit in Composer...</span>
        </div>
      </button>

      <div className="htk-context-menu-divider" />

      <div className="htk-context-menu-label">Rules & Filters</div>
      <button
        onClick={() => { onToggleFavorite(request.id); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Star className={`w-3.5 h-3.5 ${request.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} style={request.isFavorite ? undefined : { color: 'var(--htk-warning)' }} />
          <span>{request.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
        </div>
      </button>
      <button
        onClick={async () => {
          const domain = request.hostPort?.host;
          if (domain) {
            try {
              if ((window as any).go?.main?.App?.AddHostToWhitelist) {
                await (window as any).go.main.App.AddHostToWhitelist(domain);
              }
              toast.success('Added to Whitelist', domain);
            } catch (e: any) {
              toast.error('Whitelist Error', e?.message);
            }
          }
          onClose();
        }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Add {request.hostPort?.host || 'Host'} to Whitelist</span>
        </div>
      </button>
      <button
        onClick={async () => {
          const domain = request.hostPort?.host;
          if (domain) {
            try {
              if ((window as any).go?.main?.App?.AddHostToBlacklist) {
                await (window as any).go.main.App.AddHostToBlacklist(domain);
              }
              toast.warning('Added to Blacklist', domain);
            } catch (e: any) {
              toast.error('Blacklist Error', e?.message);
            }
          }
          onClose();
        }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--htk-danger)' }} />
          <span>Add {request.hostPort?.host || 'Host'} to Blacklist</span>
        </div>
      </button>
      <button
        onClick={() => { onCreateRule('rewrite', request); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Add Rewrite Rule</span>
        </div>
      </button>
      <button
        onClick={() => { onCreateRule('mock', request); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--htk-accent)' }} />
          <span>Add Mock Rule</span>
        </div>
      </button>
      <button
        onClick={() => { onCreateRule('breakpoint', request); onClose(); }}
        className="htk-context-menu-item"
      >
        <div className="flex items-center gap-2">
          <PauseCircle className="w-3.5 h-3.5" style={{ color: 'var(--htk-warning)' }} />
          <span>Add Breakpoint Rule</span>
        </div>
      </button>

      <div className="htk-context-menu-divider" />

      <button
        onClick={() => { onDelete(request.id); onClose(); }}
        className="htk-context-menu-item htk-context-menu-item-danger"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Request</span>
        </div>
      </button>
    </div>
  );
};
