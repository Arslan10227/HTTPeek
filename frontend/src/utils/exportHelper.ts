import { HttpRequest, HttpResponse } from '../types';
import { toast } from '../store/useToastStore';
import { useProxyStore } from '../store/useProxyStore';

export type ExportFormat = 'har' | 'json' | 'csv' | 'curl' | 'sh';

export async function exportRequests(
  requests: HttpRequest[],
  format: ExportFormat = 'har',
  baseFilename: string = 'httpeek-export'
): Promise<boolean> {
  if (!requests || requests.length === 0) {
    toast.warning('No requests selected to export');
    return false;
  }

  const cleanName = baseFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();

  try {
    let data = '';
    let mimeType = 'application/json';
    const extension = format === 'curl' || format === 'sh' ? 'sh' : format;

    // Check if Wails backend ExportRequestsAs bridge exists
    if ((window as any).go?.main?.App?.ExportRequestsAs) {
      data = await (window as any).go.main.App.ExportRequestsAs(requests, format === 'curl' ? 'sh' : format);
    } else if (format === 'har' && (window as any).go?.main?.App?.ExportHAR) {
      data = await (window as any).go.main.App.ExportHAR(requests);
    } else {
      // Client-side fallback generator
      if (format === 'har') {
        data = generateHarJson(requests);
        mimeType = 'application/json';
      } else if (format === 'json') {
        data = JSON.stringify(requests, null, 2);
        mimeType = 'application/json';
      } else if (format === 'csv') {
        data = generateCSV(requests);
        mimeType = 'text/csv';
      } else {
        data = generateCurlScript(requests);
        mimeType = 'text/x-shellscript';
      }
    }

    if (format === 'csv') mimeType = 'text/csv';
    else if (format === 'curl' || format === 'sh') mimeType = 'text/x-shellscript';
    else mimeType = 'application/json';

    // Trigger browser file download
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}_${timestamp}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`,
      `${cleanName}_${timestamp}.${extension}`
    );
    return true;
  } catch (e: any) {
    toast.error('Export Failed', e?.message || String(e));
    return false;
  }
}

export function generateHarJson(requests: HttpRequest[]): string {
  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'HTTPeek - Next Gen HTTP Debugging Tool',
        version: '1.0.0',
      },
      entries: requests.map((r) => {
        const headersList: { name: string; value: string }[] = [];
        if (r.headers) {
          Object.entries(r.headers).forEach(([k, v]) => {
            headersList.push({ name: k, value: Array.isArray(v) ? v.join(', ') : String(v) });
          });
        }
        const respHeadersList: { name: string; value: string }[] = [];
        if (r.response?.headers) {
          Object.entries(r.response.headers).forEach(([k, v]) => {
            respHeadersList.push({ name: k, value: Array.isArray(v) ? v.join(', ') : String(v) });
          });
        }

        const validStartTime = r.startTime && !isNaN(new Date(r.startTime).getTime())
          ? new Date(r.startTime).toISOString()
          : new Date().toISOString();

        return {
          startedDateTime: validStartTime,
          time: r.durationMs || r.duration || 0,
          request: {
            method: r.method || 'GET',
            url: r.url,
            httpVersion: r.protocol || 'HTTP/1.1',
            headers: headersList,
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: r.bodyString ? r.bodyString.length : (r.body ? r.body.length : 0),
            postData: r.bodyString || r.body ? {
              mimeType: String(r.headers?.['content-type'] || 'text/plain'),
              text: r.bodyString || r.body,
            } : undefined,
          },
          response: {
            status: r.response?.statusCode || 0,
            statusText: r.response?.statusText || 'OK',
            httpVersion: r.response?.protocol || 'HTTP/1.1',
            headers: respHeadersList,
            cookies: [],
            content: {
              size: r.response?.bodySize || 0,
              mimeType: r.response?.contentType || 'text/plain',
              text: r.response?.bodyString || r.response?.body || '',
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: r.response?.bodySize || 0,
          },
          cache: {},
          timings: {
            send: 0,
            wait: r.durationMs || 0,
            receive: 0,
          },
        };
      }),
    },
  };
  return JSON.stringify(har, null, 2);
}

/**
 * Resilient HAR / JSON string parser with multi-strategy fallback for missing fields or minor syntax errors.
 */
export function parseHarOrJsonContent(rawText: string): HttpRequest[] {
  if (!rawText || !rawText.trim()) return [];

  let text = rawText.trim();

  // Attempt to sanitize common syntax defects (trailing commas, BOM, unescaped characters)
  text = text.replace(/^\uFEFF/, ''); // Strip BOM
  text = text.replace(/,\s*([\]}])/g, '$1'); // Strip trailing commas before ] or }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch (e1) {
    try {
      // Strategy: Relaxed single quote repair
      const relaxed = text.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
      parsed = JSON.parse(relaxed);
    } catch (e2) {
      // Strategy: Extract JSON array or object substring
      const startIdx = text.indexOf('{');
      const startArrIdx = text.indexOf('[');
      if (startIdx !== -1 || startArrIdx !== -1) {
        const start = startIdx !== -1 && (startArrIdx === -1 || startIdx < startArrIdx) ? startIdx : startArrIdx;
        const end = text.lastIndexOf(start === startIdx ? '}' : ']');
        if (end > start) {
          try {
            parsed = JSON.parse(text.slice(start, end + 1));
          } catch (_) {}
        }
      }
    }
  }

  if (!parsed) {
    throw new Error('Unable to parse HAR or JSON content. Please check file format.');
  }

  const results: HttpRequest[] = [];
  const baseTime = Date.now();

  // Case 1: Standard HAR log object {"log": {"entries": [...]}}
  if (parsed.log && Array.isArray(parsed.log.entries)) {
    parsed.log.entries.forEach((entry: any, idx: number) => {
      const r = convertHarEntryToRequest(entry, idx, baseTime);
      if (r) results.push(r);
    });
    return results;
  }

  // Case 2: Array of HAR entries [{"request": {...}, "response": {...}}]
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.request) {
    parsed.forEach((entry: any, idx: number) => {
      const r = convertHarEntryToRequest(entry, idx, baseTime);
      if (r) results.push(r);
    });
    return results;
  }

  // Case 3: Array of HttpRequest models [{"id": "...", "url": "..."}]
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0]?.url || parsed[0]?.method)) {
    parsed.forEach((item: any, idx: number) => {
      const r = normalizeRawRequest(item, idx, baseTime);
      if (r) results.push(r);
    });
    return results;
  }

  // Case 4: Postman Collection format {"item": [...]}
  if (Array.isArray(parsed.item)) {
    parsed.item.forEach((item: any, idx: number) => {
      const r = convertPostmanItemToRequest(item, idx, baseTime);
      if (r) results.push(r);
    });
    return results;
  }

  // Case 5: Single entry or request object
  if (parsed.request || parsed.url) {
    const r = parsed.request ? convertHarEntryToRequest(parsed, 0, baseTime) : normalizeRawRequest(parsed, 0, baseTime);
    if (r) results.push(r);
    return results;
  }

  return results;
}

function convertHarEntryToRequest(entry: any, idx: number, baseTime: number): HttpRequest | null {
  if (!entry) return null;
  const req = entry.request || {};
  const res = entry.response || {};

  const rawUrl = req.url || entry.url || '';
  if (!rawUrl) return null;

  let host = 'unknown';
  let path = '/';
  let isTLS = false;

  try {
    const u = new URL(rawUrl);
    host = u.hostname;
    path = u.pathname + u.search;
    isTLS = u.protocol.startsWith('https');
  } catch (_) {
    host = rawUrl.split('/')[2] || 'imported';
    path = '/' + (rawUrl.split('/').slice(3).join('/') || '');
  }

  // Headers extraction
  const headersObj: Record<string, string> = {};
  if (Array.isArray(req.headers)) {
    req.headers.forEach((h: any) => {
      if (h && h.name) headersObj[h.name] = h.value || '';
    });
  } else if (req.headers && typeof req.headers === 'object') {
    Object.assign(headersObj, req.headers);
  }

  const respHeadersObj: Record<string, string> = {};
  if (Array.isArray(res.headers)) {
    res.headers.forEach((h: any) => {
      if (h && h.name) respHeadersObj[h.name] = h.value || '';
    });
  } else if (res.headers && typeof res.headers === 'object') {
    Object.assign(respHeadersObj, res.headers);
  }

  // Guaranteed safe ISO timestamp
  let validDate = new Date(baseTime + idx * 100).toISOString();
  if (entry.startedDateTime) {
    const parsedD = new Date(entry.startedDateTime);
    if (!isNaN(parsedD.getTime())) {
      validDate = parsedD.toISOString();
    }
  }

  // Response content & body decoding
  let respBodyString = res.content?.text || res.bodyString || res.body || '';
  if (res.content?.encoding === 'base64' && respBodyString) {
    try {
      respBodyString = atob(respBodyString);
    } catch (_) {}
  }

  const reqBodyString = req.postData?.text || req.bodyString || req.body || '';

  const id = req.id || `imp_${Date.now()}_${idx}`;
  const duration = entry.time || res.durationMs || 0;

  const responseObj: HttpResponse = {
    id: `resp_${id}`,
    requestId: id,
    statusCode: Number(res.status || res.statusCode || 200),
    statusText: String(res.statusText || 'OK'),
    headers: respHeadersObj,
    body: respBodyString,
    bodyString: respBodyString,
    bodySize: Number(res.content?.size || res.bodySize || (respBodyString ? respBodyString.length : 0)),
    contentType: String(res.content?.mimeType || res.contentType || respHeadersObj['content-type'] || 'text/plain'),
    startTime: validDate,
    durationMs: duration,
    protocol: res.httpVersion || 'HTTP/1.1',
  };

  return {
    id,
    method: (req.method || 'GET').toUpperCase() as any,
    url: rawUrl,
    path,
    protocol: req.httpVersion || (isTLS ? 'HTTP/2.0' : 'HTTP/1.1'),
    hostPort: {
      host,
      port: isTLS ? 443 : 80,
      ssl: isTLS,
    },
    headers: headersObj,
    body: reqBodyString,
    bodyString: reqBodyString,
    startTime: validDate,
    durationMs: duration,
    response: responseObj,
  };
}

function normalizeRawRequest(item: any, idx: number, baseTime: number): HttpRequest | null {
  if (!item) return null;
  const rawUrl = item.url || '';
  if (!rawUrl) return null;

  let host = item.hostPort?.host || 'unknown';
  let path = item.path || '/';
  let isTLS = item.hostPort?.ssl ?? false;

  try {
    const u = new URL(rawUrl);
    host = u.hostname;
    path = u.pathname + u.search;
    isTLS = u.protocol.startsWith('https');
  } catch (_) {}

  let validDate = new Date(baseTime + idx * 100).toISOString();
  if (item.startTime) {
    const parsedD = new Date(item.startTime);
    if (!isNaN(parsedD.getTime())) {
      validDate = parsedD.toISOString();
    }
  }

  const id = item.id || `imp_${Date.now()}_${idx}`;

  let resp: HttpResponse | undefined = undefined;
  if (item.response) {
    resp = {
      id: item.response.id || `resp_${id}`,
      requestId: id,
      statusCode: Number(item.response.statusCode || item.response.status || 200),
      statusText: String(item.response.statusText || 'OK'),
      headers: item.response.headers || {},
      body: item.response.bodyString || item.response.body || '',
      bodyString: item.response.bodyString || item.response.body || '',
      bodySize: Number(item.response.bodySize || (item.response.body ? String(item.response.body).length : 0)),
      contentType: String(item.response.contentType || item.response.headers?.['content-type'] || 'text/plain'),
      startTime: validDate,
      durationMs: item.response.durationMs || item.durationMs || 0,
      protocol: item.response.protocol || 'HTTP/1.1',
    };
  }

  return {
    id,
    method: (item.method || 'GET').toUpperCase() as any,
    url: rawUrl,
    path,
    protocol: item.protocol || (isTLS ? 'HTTP/2.0' : 'HTTP/1.1'),
    hostPort: {
      host,
      port: item.hostPort?.port || (isTLS ? 443 : 80),
      ssl: isTLS,
    },
    headers: item.headers || {},
    body: item.bodyString || item.body || '',
    bodyString: item.bodyString || item.body || '',
    startTime: validDate,
    durationMs: item.durationMs || 0,
    response: resp,
  };
}

function convertPostmanItemToRequest(item: any, idx: number, baseTime: number): HttpRequest | null {
  if (!item || !item.request) return null;
  const pReq = item.request;
  const rawUrl = typeof pReq.url === 'string' ? pReq.url : pReq.url?.raw || '';
  if (!rawUrl) return null;

  return normalizeRawRequest({
    method: pReq.method || 'GET',
    url: rawUrl,
    headers: Array.isArray(pReq.header) ? Object.fromEntries(pReq.header.map((h: any) => [h.key, h.value])) : pReq.header,
    bodyString: pReq.body?.raw || '',
    startTime: new Date(baseTime + idx * 100).toISOString(),
  }, idx, baseTime);
}

/**
 * Primary Core HAR / JSON file importer.
 * Ingests data directly into active live proxy store and backs up into session history.
 */
export async function importHarOrJsonFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.har,.json,application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve(false);
        return;
      }

      try {
        const text = await file.text();
        const importedReqs = parseHarOrJsonContent(text);

        if (importedReqs.length === 0) {
          toast.warning('No valid requests found in selected file');
          resolve(false);
          return;
        }

        // 1. Instantly populate active live proxy store
        useProxyStore.getState().setRequests(importedReqs);
        useProxyStore.getState().setActiveTab('requests');

        // 2. Asynchronously backup to Go backend session database if available
        if ((window as any).go?.main?.App?.ImportHAR) {
          const sessionName = file.name.replace(/\.(har|json)$/i, '');
          (window as any).go.main.App.ImportHAR(text, sessionName).catch(() => {});
        }

        toast.success(
          `Imported ${importedReqs.length} requests into active traffic`,
          file.name
        );
        resolve(true);
      } catch (err: any) {
        toast.error('Import Failed', err?.message || String(err));
        resolve(false);
      }
    };
    input.click();
  });
}

function generateCSV(requests: HttpRequest[]): string {
  const lines = ['ID,Method,URL,Status,Duration(ms),StartTime,ContentType,Size(B)'];
  requests.forEach((r) => {
    const id = r.id || '';
    const method = r.method || 'GET';
    const url = (r.url || '').replace(/"/g, '""');
    const status = r.response?.statusCode || 0;
    const dur = r.durationMs || r.duration || 0;
    const start = (r.startTime || '').replace(/"/g, '""');
    const ct = (r.response?.contentType || '').replace(/"/g, '""');
    const size = r.response?.bodySize || 0;
    lines.push(`"${id}","${method}","${url}",${status},${dur},"${start}","${ct}",${size}`);
  });
  return lines.join('\n');
}

function generateCurlScript(requests: HttpRequest[]): string {
  const lines = ['#!/usr/bin/env bash\n# Generated by HTTPeek\n'];
  requests.forEach((r) => {
    let cmd = `curl -X ${r.method || 'GET'} "${r.url}"`;
    if (r.headers) {
      Object.entries(r.headers).forEach(([k, rawVal]) => {
        const val = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal);
        cmd += ` \\\n  -H "${k}: ${val.replace(/"/g, '\\"')}"`;
      });
    }
    const body = r.bodyString || r.body;
    if (body) {
      cmd += ` \\\n  --data-raw "${String(body).replace(/"/g, '\\"')}"`;
    }
    lines.push(cmd + '\n');
  });
  return lines.join('\n');
}
