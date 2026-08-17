import { HttpRequest } from '../types';

export const formatHeaderValue = (val: unknown): string => {
  if (!val) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

export const getHeaderArray = (val: unknown): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [String(val)];
};

export const getBodyString = (obj?: { body?: string; bodyString?: string }): string => {
  if (!obj) return '';
  return obj.bodyString || obj.body || '';
};

export const formatContent = (
  content: string,
  contentType?: string
): { formatted: string; language: string } => {
  if (!content) return { formatted: '', language: 'plaintext' };

  const ct = (contentType || '').toLowerCase();
  if (ct.includes('json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try {
      return { formatted: JSON.stringify(JSON.parse(content), null, 2), language: 'json' };
    } catch {
      /* fall through */
    }
  }
  if (ct.includes('xml') || ct.includes('svg')) return { formatted: content, language: 'xml' };
  if (ct.includes('html')) return { formatted: content, language: 'html' };
  if (ct.includes('javascript') || ct.includes('js')) return { formatted: content, language: 'javascript' };
  if (ct.includes('css')) return { formatted: content, language: 'css' };
  return { formatted: content, language: 'plaintext' };
};

export const formatSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatTime = (isoString?: string | number): string => {
  if (!isoString) return '';
  try {
    let d: Date;
    if (typeof isoString === 'number') {
      const ms = isoString < 10000000000 ? isoString * 1000 : isoString;
      d = new Date(ms);
    } else {
      d = new Date(isoString);
    }
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
};

export const formatSafeDateTime = (val?: string | number): string => {
  if (!val) return '';
  try {
    let d: Date;
    if (typeof val === 'number') {
      const ms = val < 10000000000 ? val * 1000 : val;
      d = new Date(ms);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(val);
  }
};

export const getHexDump = (str?: string, maxBytes = 1024): string => {
  if (!str) return 'Empty content';
  try {
    const lines: string[] = [];
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length && i < maxBytes; i += 16) {
      const chunk = Array.from(bytes.slice(i, i + 16));
      const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = chunk.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
      lines.push(`${i.toString(16).padStart(6, '0')}  ${hex.padEnd(48, ' ')}  |${ascii}|`);
    }
    if (bytes.length > maxBytes) lines.push(`... (truncated, total size: ${bytes.length} bytes)`);
    return lines.join('\n');
  } catch {
    return 'Hex conversion error';
  }
};

export interface QueryParam {
  key: string;
  value: string;
}

export const parseQueryParams = (url: string): QueryParam[] => {
  try {
    const u = new URL(url.startsWith('http') ? url : `http://${url}`);
    const params: QueryParam[] = [];
    u.searchParams.forEach((value, key) => params.push({ key, value }));
    return params;
  } catch {
    return [];
  }
};

export interface CookieEntry {
  key: string;
  value: string;
}

export const parseRequestCookies = (headers: Record<string, string[]>): CookieEntry[] => {
  if (!headers) return [];
  const raw = formatHeaderValue(headers['Cookie'] || headers['cookie']);
  if (!raw) return [];
  return String(raw)
    .split(';')
    .map((c) => {
      const trimmed = c.trim();
      const idx = trimmed.indexOf('=');
      if (idx === -1) return { key: trimmed, value: '' };
      return { key: trimmed.substring(0, idx).trim(), value: trimmed.substring(idx + 1).trim() };
    });
};

export interface SetCookieEntry {
  name: string;
  value: string;
  raw: string;
  directives: string;
}

export const parseResponseCookies = (headers: Record<string, string[]>): SetCookieEntry[] => {
  if (!headers) return [];
  const setCookies = getHeaderArray(headers['Set-Cookie'] || headers['set-cookie']);
  return setCookies.map((sc) => {
    const scStr = typeof sc === 'string' ? sc : String(sc || '');
    const parts = scStr.split(';');
    const [kv, ...directives] = parts;
    const idx = (kv || '').indexOf('=');
    const name = idx === -1 ? (kv || '').trim() : (kv || '').substring(0, idx).trim();
    const value = idx === -1 ? '' : (kv || '').substring(idx + 1).trim();
    return {
      name,
      value,
      raw: scStr,
      directives: directives.map((d) => (typeof d === 'string' ? d.trim() : String(d))).join('; '),
    };
  });
};

export const generateCurl = (req: HttpRequest): string => {
  let cmd = `curl -X ${req.method || 'GET'} "${req.url || ''}"`;
  Object.entries(req.headers || {}).forEach(([k, val]) => {
    getHeaderArray(val).forEach((v) => {
      cmd += ` \\\n  -H "${k}: ${v.replace(/"/g, '\\"')}"`;
    });
  });
  const body = getBodyString(req);
  if (body) cmd += ` \\\n  --data '${body.replace(/'/g, "'\\''")}'`;
  return cmd;
};

export const matchesFilter = (req: HttpRequest, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  if (q.startsWith('status:')) {
    const code = q.replace('status:', '').trim();
    return req.response?.statusCode?.toString().startsWith(code) ?? false;
  }
  if (q.startsWith('method:')) {
    return req.method === q.replace('method:', '').trim().toUpperCase();
  }
  if (q.startsWith('domain:')) {
    const d = q.replace('domain:', '').trim();
    return String(req.hostPort?.host || '').toLowerCase().includes(d);
  }
  return (
    String(req.url || '').toLowerCase().includes(q) ||
    String(req.path || '').toLowerCase().includes(q) ||
    String(req.hostPort?.host || '').toLowerCase().includes(q) ||
    String(req.process?.name || '').toLowerCase().includes(q)
  );
};
