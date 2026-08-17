import React, { useState, useMemo } from 'react';
import { HttpRequest } from '../../types';
import { ChevronDown, ChevronRight, Copy, Lock, ShieldCheck, Globe } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

interface CookiesTabProps {
  request: HttpRequest;
}

interface ParsedSetCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  maxAge?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

const parseSetCookieLine = (line: any): ParsedSetCookie | null => {
  if (!line) return null;
  const lineStr = typeof line === 'string' ? line : String(line);
  const parts = lineStr.split(';').map((p) => p.trim());
  if (parts.length === 0 || !parts[0]) return null;

  const firstEq = parts[0].indexOf('=');
  if (firstEq === -1) return null;

  const name = parts[0].slice(0, firstEq).trim();
  const value = parts[0].slice(firstEq + 1).trim();

  const cookie: ParsedSetCookie = { name, value };

  for (let i = 1; i < parts.length; i++) {
    const attr = parts[i].toLowerCase();
    if (attr === 'secure') {
      cookie.secure = true;
    } else if (attr === 'httponly') {
      cookie.httpOnly = true;
    } else if (attr.startsWith('path=')) {
      cookie.path = parts[i].slice(5).trim();
    } else if (attr.startsWith('domain=')) {
      cookie.domain = parts[i].slice(7).trim();
    } else if (attr.startsWith('expires=')) {
      cookie.expires = parts[i].slice(8).trim();
    } else if (attr.startsWith('max-age=')) {
      cookie.maxAge = parts[i].slice(8).trim();
    } else if (attr.startsWith('samesite=')) {
      cookie.sameSite = parts[i].slice(9).trim();
    }
  }

  return cookie;
};

export const CookiesTab: React.FC<CookiesTabProps> = ({ request }) => {
  const { t } = useTranslation();
  const [isReqExpanded, setIsReqExpanded] = useState(true);
  const [isRespExpanded, setIsRespExpanded] = useState(true);

  // Parse request cookies
  const rawReqCookie = request.headers?.['cookie'] || request.headers?.['Cookie'] || '';
  const requestCookieHeader = Array.isArray(rawReqCookie) ? rawReqCookie.join('; ') : String(rawReqCookie || '');
  const requestCookies: [string, string][] = useMemo(() => {
    const cookies: [string, string][] = [];
    if (requestCookieHeader) {
      const headerStr = typeof requestCookieHeader === 'string' ? requestCookieHeader : String(requestCookieHeader);
      headerStr.split(';').forEach((pair: string) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          cookies.push([pair.slice(0, eqIdx).trim(), pair.slice(eqIdx + 1).trim()]);
        }
      });
    }
    return cookies;
  }, [requestCookieHeader]);

  // Parse response Set-Cookie headers with full attribute parsing
  const rawRespCookie =
    request.response?.headers?.['set-cookie'] ||
    request.response?.headers?.['Set-Cookie'] ||
    '';
  const setCookieLines = Array.isArray(rawRespCookie)
    ? rawRespCookie.map(String)
    : String(rawRespCookie || '')
        .split('\n')
        .filter(Boolean);
  const responseCookies: ParsedSetCookie[] = useMemo(() => {
    return setCookieLines
      .map(parseSetCookieLine)
      .filter((c): c is ParsedSetCookie => c !== null);
  }, [setCookieLines]);

  if (requestCookies.length === 0 && responseCookies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs italic p-8">
        No cookies found in this request/response
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none flex flex-col gap-3 text-xs">
      {/* Request Cookies */}
      {requestCookies.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden shadow-2xs"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <div
            onClick={() => setIsReqExpanded(!isReqExpanded)}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/40 cursor-pointer select-none border-b"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
              {isReqExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span>Request Cookies</span>
              <span className="text-[10px] font-normal text-gray-400 font-mono">
                ({requestCookies.length})
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(requestCookieHeader);
                toast.success(t.copied);
              }}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
              title="Copy request cookies"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {isReqExpanded && (
            <div className="p-3">
              <div className="flex flex-col border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden font-mono text-[11px]">
                {requestCookies.map(([k, v], idx) => (
                  <div
                    key={`${k}-${idx}`}
                    className={`flex items-start px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="w-44 font-semibold text-blue-600 dark:text-blue-400 select-text shrink-0 break-all">
                      {k}
                    </span>
                    <span className="flex-1 select-text text-gray-800 dark:text-gray-200 break-all pl-2">
                      {v}
                    </span>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(v); toast.success(t.copied); }}
                      className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Response Set-Cookie with full attribute view */}
      {responseCookies.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden shadow-2xs"
          style={{
            backgroundColor: 'var(--md-dialog-bg)',
            borderColor: 'var(--md-sys-color-divider)',
          }}
        >
          <div
            onClick={() => setIsRespExpanded(!isRespExpanded)}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/40 cursor-pointer select-none border-b"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
              {isRespExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span>Response Cookies (Set-Cookie)</span>
              <span className="text-[10px] font-normal text-gray-400 font-mono">
                ({responseCookies.length})
              </span>
            </div>
          </div>

          {isRespExpanded && (
            <div className="p-3 flex flex-col gap-2">
              {responseCookies.map((cookie, idx) => (
                <div
                  key={`${cookie.name}-${idx}`}
                  className="border rounded-lg overflow-hidden font-mono text-[11px]"
                  style={{ borderColor: 'var(--md-sys-color-divider)' }}
                >
                  {/* Cookie name/value header */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/40 border-b" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-bold text-green-600 dark:text-green-400 shrink-0">{cookie.name}</span>
                      <span className="text-gray-400">=</span>
                      <span className="text-gray-800 dark:text-gray-200 truncate flex-1">{cookie.value}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {cookie.secure && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <Lock className="w-2 h-2" /> Secure
                        </span>
                      )}
                      {cookie.httpOnly && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          <ShieldCheck className="w-2 h-2" /> HttpOnly
                        </span>
                      )}
                      {cookie.sameSite && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          <Globe className="w-2 h-2" /> {cookie.sameSite}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Cookie attributes */}
                  <div className="px-2.5 py-1.5 text-[10px] text-gray-500 font-sans flex flex-wrap gap-x-4 gap-y-0.5">
                    {cookie.path && <span><span className="font-semibold">Path:</span> {cookie.path}</span>}
                    {cookie.domain && <span><span className="font-semibold">Domain:</span> {cookie.domain}</span>}
                    {cookie.expires && <span><span className="font-semibold">Expires:</span> {cookie.expires}</span>}
                    {cookie.maxAge && <span><span className="font-semibold">Max-Age:</span> {cookie.maxAge}s</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
