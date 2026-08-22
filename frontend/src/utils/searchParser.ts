import { HttpRequest } from '../types';

/**
 * Parses structured search query expressions:
 * Examples:
 * - status:>=400 AND method:POST
 * - header.content-type:json AND duration:>500ms
 * - host:api.example.com
 * - error / search text
 */
export function matchStructuredQuery(request: HttpRequest, query: string): boolean {
  if (!query || !query.trim()) return true;

  const trimmed = query.trim();

  // Split by ' AND ' (case-insensitive)
  const tokens = trimmed.split(/\s+AND\s+/i);

  for (const token of tokens) {
    if (!matchSingleToken(request, token.trim())) {
      return false;
    }
  }

  return true;
}

function matchSingleToken(r: HttpRequest, token: string): boolean {
  if (!token) return true;

  const lower = token.toLowerCase();

  // 1. Status Code query (status:200, status:>=400, status:>400, status:<=200, status:4xx, status:5xx)
  if (lower.startsWith('status:')) {
    const rawVal = token.slice(7).trim();
    const statusCode = r.response?.statusCode || 0;

    if (rawVal.startsWith('>=')) {
      const target = parseInt(rawVal.slice(2), 10);
      return statusCode >= target;
    } else if (rawVal.startsWith('>')) {
      const target = parseInt(rawVal.slice(1), 10);
      return statusCode > target;
    } else if (rawVal.startsWith('<=')) {
      const target = parseInt(rawVal.slice(2), 10);
      return statusCode > 0 && statusCode <= target;
    } else if (rawVal.startsWith('<')) {
      const target = parseInt(rawVal.slice(1), 10);
      return statusCode > 0 && statusCode < target;
    } else if (rawVal.endsWith('xx')) {
      const prefix = rawVal[0];
      return statusCode.toString().startsWith(prefix);
    } else {
      return statusCode.toString().startsWith(rawVal);
    }
  }

  // 2. Method query (method:POST, method:GET, etc.)
  if (lower.startsWith('method:')) {
    const m = token.slice(7).trim().toUpperCase();
    return r.method === m;
  }

  // 3. Duration query (duration:>500ms, duration:>1s, duration:<200ms)
  if (lower.startsWith('duration:')) {
    const rawVal = token.slice(9).trim().toLowerCase();
    const durationMs = r.durationMs || 0;

    let multiplier = 1;
    let numStr = rawVal;
    if (rawVal.endsWith('ms')) {
      numStr = rawVal.slice(0, -2);
    } else if (rawVal.endsWith('s')) {
      multiplier = 1000;
      numStr = rawVal.slice(0, -1);
    }

    if (numStr.startsWith('>=')) {
      const target = parseFloat(numStr.slice(2)) * multiplier;
      return durationMs >= target;
    } else if (numStr.startsWith('>')) {
      const target = parseFloat(numStr.slice(1)) * multiplier;
      return durationMs > target;
    } else if (numStr.startsWith('<=')) {
      const target = parseFloat(numStr.slice(2)) * multiplier;
      return durationMs <= target;
    } else if (numStr.startsWith('<')) {
      const target = parseFloat(numStr.slice(1)) * multiplier;
      return durationMs < target;
    } else {
      const target = parseFloat(numStr) * multiplier;
      return durationMs >= target;
    }
  }

  // 4. Header queries (header.content-type:json, header.authorization:bearer)
  if (lower.startsWith('header.')) {
    const colonIdx = token.indexOf(':');
    if (colonIdx !== -1) {
      const headerName = token.slice(7, colonIdx).trim().toLowerCase();
      const headerVal = token.slice(colonIdx + 1).trim().toLowerCase();

      // Check request headers
      if (r.headers) {
        for (const [k, v] of Object.entries(r.headers)) {
          if (k.toLowerCase() === headerName) {
            const vals = Array.isArray(v) ? v.join(' ').toLowerCase() : String(v).toLowerCase();
            if (vals.includes(headerVal)) return true;
          }
        }
      }
      // Check response headers
      if (r.response?.headers) {
        for (const [k, v] of Object.entries(r.response.headers)) {
          if (k.toLowerCase() === headerName) {
            const vals = Array.isArray(v) ? v.join(' ').toLowerCase() : String(v).toLowerCase();
            if (vals.includes(headerVal)) return true;
          }
        }
      }
      return false;
    }
  }

  // 5. Host query (host:example.com)
  if (lower.startsWith('host:')) {
    const h = token.slice(5).trim().toLowerCase();
    return (r.hostPort?.host || '').toLowerCase().includes(h) || r.url.toLowerCase().includes(h);
  }

  // 6. Path query (path:/api/v1)
  if (lower.startsWith('path:')) {
    const p = token.slice(5).trim().toLowerCase();
    return (r.path || '').toLowerCase().includes(p);
  }

  // 7. General text fallback (matches URL, path, host, process, or body)
  const q = lower;
  return (
    r.url.toLowerCase().includes(q) ||
    (r.path || '').toLowerCase().includes(q) ||
    (r.hostPort?.host || '').toLowerCase().includes(q) ||
    (r.process?.name && r.process.name.toLowerCase().includes(q)) ||
    (r.body && r.body.toLowerCase().includes(q)) ||
    (r.bodyString && r.bodyString.toLowerCase().includes(q)) ||
    (r.response?.body && r.response.body.toLowerCase().includes(q)) ||
    (r.response?.bodyString && r.response.bodyString.toLowerCase().includes(q))
  );
}
