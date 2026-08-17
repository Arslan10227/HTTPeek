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
        let headersList: { name: string; value: string }[] = [];
        if (r.headers) {
          Object.entries(r.headers).forEach(([k, v]) => {
            headersList.push({ name: k, value: Array.isArray(v) ? v.join(', ') : String(v) });
          });
        }
        let respHeadersList: { name: string; value: string }[] = [];
        if (r.response?.headers) {
          Object.entries(r.response.headers).forEach(([k, v]) => {
            respHeadersList.push({ name: k, value: Array.isArray(v) ? v.join(', ') : String(v) });
          });
        }

        return {
          startedDateTime: r.startTime || new Date().toISOString(),
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

export function importHarOrJsonFile(): Promise<boolean> {
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
        
        // If Wails backend ImportHAR bridge exists
        if ((window as any).go?.main?.App?.ImportHAR) {
          const sessionName = file.name.replace(/\.(har|json)$/i, '');
          await (window as any).go.main.App.ImportHAR(text, sessionName);
          toast.success('Imported HAR/JSON Session', file.name);
          resolve(true);
          return;
        }

        // Fallback Client-side Parser
        const parsed = JSON.parse(text);
        if (parsed.log && Array.isArray(parsed.log.entries)) {
          const importedReqs: HttpRequest[] = parsed.log.entries.map((entry: any, idx: number) => {
            const req = entry.request || {};
            const res = entry.response || {};
            const headersObj: Record<string, string> = {};
            (req.headers || []).forEach((h: any) => {
              if (h.name) headersObj[h.name] = h.value || '';
            });
            const respHeadersObj: Record<string, string> = {};
            (res.headers || []).forEach((h: any) => {
              if (h.name) respHeadersObj[h.name] = h.value || '';
            });

            let host = '';
            let path = '';
            try {
              const u = new URL(req.url);
              host = u.hostname;
              path = u.pathname + u.search;
            } catch (_) {
              host = 'imported';
              path = req.url || '/';
            }

            return {
              id: `imp_${Date.now()}_${idx}`,
              method: req.method || 'GET',
              url: req.url || '',
              path,
              hostPort: { host, port: 443 },
              headers: headersObj,
              bodyString: req.postData?.text || '',
              startTime: entry.startedDateTime,
              durationMs: entry.time || 0,
              response: {
                statusCode: res.status || 200,
                statusText: res.statusText || 'OK',
                headers: respHeadersObj,
                bodyString: res.content?.text || '',
                bodySize: res.content?.size || (res.content?.text ? res.content.text.length : 0),
                contentType: res.content?.mimeType || 'text/plain',
              },
            };
          });

          useProxyStore.getState().setRequests(importedReqs);
          toast.success(`Imported ${importedReqs.length} requests from HAR`, file.name);
          resolve(true);
        } else if (Array.isArray(parsed)) {
          useProxyStore.getState().setRequests(parsed);
          toast.success(`Imported ${parsed.length} requests from JSON`, file.name);
          resolve(true);
        } else {
          toast.warning('Unrecognized file structure', 'Please select a valid .HAR or exported .JSON file');
          resolve(false);
        }
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
