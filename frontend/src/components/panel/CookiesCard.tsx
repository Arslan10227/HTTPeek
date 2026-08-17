import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Search, Check, Cookie as CookieIcon, Lock, Shield } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

interface CookiesCardProps {
  type: 'request' | 'response';
  cookieHeader?: string | string[];
}

export function parseCookies(type: 'request' | 'response', headerVal?: string | string[]): ParsedCookie[] {
  if (!headerVal) return [];
  const rawList: string[] = Array.isArray(headerVal) ? headerVal : [headerVal];
  const results: ParsedCookie[] = [];

  if (type === 'request') {
    // Cookie: a=1; b=2; c=3
    rawList.forEach((line) => {
      line.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx !== -1) {
          const name = pair.slice(0, idx).trim();
          const val = pair.slice(idx + 1).trim();
          if (name) {
            results.push({ name, value: decodeURIComponent(val) });
          }
        }
      });
    });
  } else {
    // Set-Cookie: id=a3fWa; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly; SameSite=Lax
    rawList.forEach((line) => {
      const parts = line.split(';');
      if (parts.length === 0) return;
      const first = parts[0];
      const eqIdx = first.indexOf('=');
      if (eqIdx === -1) return;

      const cookie: ParsedCookie = {
        name: first.slice(0, eqIdx).trim(),
        value: decodeURIComponent(first.slice(eqIdx + 1).trim()),
      };

      for (let i = 1; i < parts.length; i++) {
        const attr = parts[i].trim();
        const attrLower = attr.toLowerCase();
        if (attrLower === 'httponly') cookie.httpOnly = true;
        else if (attrLower === 'secure') cookie.secure = true;
        else if (attrLower.startsWith('samesite=')) cookie.sameSite = attr.slice(9).trim();
        else if (attrLower.startsWith('domain=')) cookie.domain = attr.slice(7).trim();
        else if (attrLower.startsWith('path=')) cookie.path = attr.slice(5).trim();
        else if (attrLower.startsWith('expires=')) cookie.expires = attr.slice(8).trim();
        else if (attrLower.startsWith('max-age=')) cookie.expires = `Max-Age: ${attr.slice(8).trim()}s`;
      }
      results.push(cookie);
    });
  }

  return results;
}

export const CookiesCard: React.FC<CookiesCardProps> = ({ type, cookieHeader }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'raw'>('table');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const cookies = parseCookies(type, cookieHeader);

  if (cookies.length === 0) {
    return null; // Dynamic card system: hide if 0 cookies
  }

  const filtered = cookies.filter(
    (c) =>
      c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.value.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (c.domain && c.domain.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const rawText = Array.isArray(cookieHeader) ? cookieHeader.join('\n') : String(cookieHeader || '');
  const jsonText = JSON.stringify(cookies, null, 2);

  const handleCopy = (text: string, label = 'Cookies Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const handleCopyRow = (val: string, name: string) => {
    navigator.clipboard.writeText(val);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
    toast.success('Cookie Value Copied', val);
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-xs text-xs bg-white dark:bg-gray-900 transition-all"
      style={{
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/80 dark:bg-gray-800/40 cursor-pointer select-none border-b shrink-0"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <CookieIcon className="w-4 h-4 text-amber-500" />
          <span>{type === 'request' ? 'Request Cookies' : 'Response Cookies (Set-Cookie)'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            {cookies.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-amber-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'json' ? 'bg-amber-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                viewMode === 'raw' ? 'bg-amber-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Raw
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(viewMode === 'json' ? jsonText : rawText, 'Cookies Copied')}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            title="Copy cookies"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {viewMode === 'table' && (
            <div className="flex flex-col gap-2">
              {cookies.length > 3 && (
                <div className="relative">
                  <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter cookies..."
                    className="w-full pl-8 pr-2.5 py-1 text-[11px] font-mono rounded-lg border bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-divider)' }}
                  />
                </div>
              )}

              <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-y-auto max-h-64 font-mono text-[11px]">
                {filtered.map((c, idx) => (
                  <div
                    key={`${c.name}-${idx}`}
                    className={`group flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.015] dark:bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-700 dark:text-amber-400 select-text">
                          {c.name}
                        </span>
                        {c.httpOnly && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> HttpOnly
                          </span>
                        )}
                        {c.secure && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" /> Secure
                          </span>
                        )}
                        {c.sameSite && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                            SameSite={c.sameSite}
                          </span>
                        )}
                      </div>
                      <span className="select-text text-gray-800 dark:text-gray-200 break-all mt-0.5 text-xs">
                        {c.value}
                      </span>
                      {(c.domain || c.path || c.expires) && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                          {c.domain && <span>Domain: {c.domain}</span>}
                          {c.path && <span>Path: {c.path}</span>}
                          {c.expires && <span>Expires: {c.expires}</span>}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyRow(c.value, c.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-amber-600 rounded cursor-pointer transition-opacity shrink-0 ml-2"
                      title="Copy cookie value"
                    >
                      {copiedName === c.name ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'json' && (
            <textarea
              readOnly
              value={jsonText}
              rows={Math.min(cookies.length * 4 + 2, 16)}
              className="w-full p-3 rounded-xl border font-mono text-[11px] bg-slate-900 text-amber-300 focus:outline-none resize-y select-text"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          )}

          {viewMode === 'raw' && (
            <textarea
              readOnly
              value={rawText}
              rows={Math.min(cookies.length + 1, 12)}
              className="w-full p-3 rounded-xl border font-mono text-[11px] bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 focus:outline-none resize-y select-text"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            />
          )}
        </div>
      )}
    </div>
  );
};
