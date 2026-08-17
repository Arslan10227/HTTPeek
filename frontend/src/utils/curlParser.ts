export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType: 'json' | 'form-urlencoded' | 'raw' | 'xml' | 'html' | 'graphql';
  queryParams: Record<string, string>;
}

/**
 * Parses a raw cURL command into structured HTTP request components.
 */
export function parseCurlCommand(raw: string): ParsedCurl {
  const clean = raw
    .trim()
    .replace(/\\\r?\n/g, ' ') // join backslash lines
    .replace(/\s+/g, ' ');

  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  let body = '';
  let bodyType: ParsedCurl['bodyType'] = 'raw';

  // Tokenize preserving single and double quotes
  const tokens: string[] = [];
  const regex = /[^\s"']+|"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  let match;

  while ((match = regex.exec(clean)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1].replace(/\\"/g, '"'));
    } else if (match[2] !== undefined) {
      tokens.push(match[2].replace(/\\'/g, "'"));
    } else {
      tokens.push(match[0]);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'curl') continue;

    // Method flag
    if (token === '-X' || token === '--request') {
      if (i + 1 < tokens.length) {
        method = tokens[++i].toUpperCase();
      }
      continue;
    }

    // Headers flag
    if (token === '-H' || token === '--header') {
      if (i + 1 < tokens.length) {
        const headerStr = tokens[++i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.substring(0, colonIdx).trim();
          const val = headerStr.substring(colonIdx + 1).trim();
          headers[key] = val;
        }
      }
      continue;
    }

    // Body data flags
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii' ||
      token === '--data-urlencode'
    ) {
      if (i + 1 < tokens.length) {
        const dataVal = tokens[++i];
        body = body ? `${body}&${dataVal}` : dataVal;
        if (method === 'GET') method = 'POST';
      }
      continue;
    }

    // Basic Auth
    if (token === '-u' || token === '--user') {
      if (i + 1 < tokens.length) {
        const auth = tokens[++i];
        headers['Authorization'] = `Basic ${btoa(auth)}`;
      }
      continue;
    }

    // URL flag
    if (token === '--url') {
      if (i + 1 < tokens.length) {
        url = tokens[++i];
      }
      continue;
    }

    // Standalone URL
    if (!url && (token.startsWith('http://') || token.startsWith('https://') || token.includes('://'))) {
      url = token;
      continue;
    }

    if (!url && !token.startsWith('-') && token.includes('.')) {
      url = token.startsWith('http') ? token : `https://${token}`;
    }
  }

  // Detect body type from Content-Type or body contents
  const contentType = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === 'content-type'
  )?.[1] || '';

  if (contentType.includes('application/json')) {
    bodyType = 'json';
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    bodyType = 'form-urlencoded';
  } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
    bodyType = 'xml';
  } else if (contentType.includes('text/html')) {
    bodyType = 'html';
  } else if (contentType.includes('application/graphql')) {
    bodyType = 'graphql';
  } else if (body) {
    const trimmed = body.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        bodyType = 'json';
      } catch (_) {
        bodyType = 'raw';
      }
    } else if (trimmed.includes('=') && !trimmed.includes(' ') && !trimmed.includes('\n')) {
      bodyType = 'form-urlencoded';
    }
  }

  // Parse query params from URL
  const queryParams: Record<string, string> = {};
  if (url && url.includes('?')) {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });
    } catch (_) {}
  }

  return {
    method: method || 'GET',
    url: url || 'https://api.example.com',
    headers,
    body,
    bodyType,
    queryParams,
  };
}
