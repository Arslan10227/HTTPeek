// Comprehensive standard HTTP data dictionaries and templates for prefilled GUI inputs

export interface HeaderPreset {
  name: string;
  description: string;
  headers: Record<string, string>;
}

export interface MockTemplate {
  name: string;
  description: string;
  statusCode: number;
  contentType: string;
  body: string;
}

export const COMMON_REQUEST_HEADERS: string[] = [
  'Content-Type',
  'Accept',
  'Authorization',
  'User-Agent',
  'Cache-Control',
  'Origin',
  'Referer',
  'Cookie',
  'X-Requested-With',
  'X-Forwarded-For',
  'X-Real-IP',
  'X-Api-Key',
  'If-None-Match',
  'If-Modified-Since',
  'Accept-Encoding',
  'Accept-Language',
  'Connection',
  'Host',
  'Pragma',
  'Range',
  'Sec-Fetch-Dest',
  'Sec-Fetch-Mode',
  'Sec-Fetch-Site',
  'Sec-WebSocket-Key',
  'Sec-WebSocket-Version',
  'Upgrade',
];

export const COMMON_RESPONSE_HEADERS: string[] = [
  'Content-Type',
  'Content-Length',
  'Cache-Control',
  'Set-Cookie',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Credentials',
  'Location',
  'ETag',
  'Last-Modified',
  'Server',
  'Strict-Transport-Security',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Content-Security-Policy',
  'Connection',
  'Vary',
];

export const COMMON_HEADER_VALUES: Record<string, string[]> = {
  'Content-Type': [
    'application/json',
    'application/json; charset=utf-8',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'text/html; charset=utf-8',
    'text/css',
    'text/javascript',
    'application/xml',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
  ],
  'Accept': [
    'application/json, text/plain, */*',
    'application/json',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    '*/*',
    'application/xml',
    'text/event-stream',
  ],
  'Authorization': [
    'Bearer <TOKEN>',
    'Basic <BASE64_USER:PASS>',
    'Token <API_KEY>',
    'AWS4-HMAC-SHA256 <CREDENTIALS>',
  ],
  'Cache-Control': [
    'no-cache, no-store, must-revalidate',
    'no-cache',
    'max-age=0',
    'public, max-age=3600',
    'public, max-age=86400, immutable',
    'private, no-cache',
  ],
  'User-Agent': [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'curl/8.4.0',
    'PostmanRuntime/7.36.0',
    'HTTPeek/1.0.0',
  ],
  'Access-Control-Allow-Origin': ['*', 'https://localhost:3000', 'null'],
  'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS, PATCH', 'GET, POST, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization, X-Requested-With, *'],
  'Connection': ['keep-alive', 'close', 'Upgrade'],
  'Upgrade': ['websocket'],
  'Sec-WebSocket-Version': ['13'],
};

export const COMMON_STATUS_CODES: { code: number; text: string; category: string }[] = [
  { code: 200, text: 'OK', category: '2xx Success' },
  { code: 201, text: 'Created', category: '2xx Success' },
  { code: 204, text: 'No Content', category: '2xx Success' },
  { code: 301, text: 'Moved Permanently', category: '3xx Redirection' },
  { code: 302, text: 'Found (Temporary Redirect)', category: '3xx Redirection' },
  { code: 304, text: 'Not Modified', category: '3xx Redirection' },
  { code: 400, text: 'Bad Request', category: '4xx Client Error' },
  { code: 401, text: 'Unauthorized', category: '4xx Client Error' },
  { code: 403, text: 'Forbidden', category: '4xx Client Error' },
  { code: 404, text: 'Not Found', category: '4xx Client Error' },
  { code: 409, text: 'Conflict', category: '4xx Client Error' },
  { code: 422, text: 'Unprocessable Entity', category: '4xx Client Error' },
  { code: 429, text: 'Too Many Requests', category: '4xx Client Error' },
  { code: 500, text: 'Internal Server Error', category: '5xx Server Error' },
  { code: 502, text: 'Bad Gateway', category: '5xx Server Error' },
  { code: 503, text: 'Service Unavailable', category: '5xx Server Error' },
  { code: 504, text: 'Gateway Timeout', category: '5xx Server Error' },
];

export const MOCK_RESPONSE_TEMPLATES: MockTemplate[] = [
  {
    name: 'REST Success (200 OK)',
    description: 'Standard JSON API payload with data payload',
    statusCode: 200,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        success: true,
        code: 200,
        message: 'Request processed successfully',
        data: {
          id: 'usr_8921a7',
          username: 'developer',
          role: 'admin',
          features: ['proxy', 'mock', 'rewrite', 'break', 'ssl'],
          updatedAt: '2026-08-16T00:00:00Z',
        },
      },
      null,
      2
    ),
  },
  {
    name: 'Created Resource (201 Created)',
    description: 'Resource creation response with generated ID',
    statusCode: 201,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        success: true,
        id: 'rec_993410',
        status: 'created',
        createdAt: '2026-08-16T00:00:00Z',
      },
      null,
      2
    ),
  },
  {
    name: 'Auth Token / OAuth (200 OK)',
    description: 'JWT Bearer token and refresh token response',
    statusCode: 200,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        token_type: 'Bearer',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIn0.abc123mocktoken',
        expires_in: 3600,
        refresh_token: 'rfr_890123mockrefresh',
        scope: 'read write admin',
      },
      null,
      2
    ),
  },
  {
    name: 'Validation Error (400 Bad Request)',
    description: 'Structured form validation error response',
    statusCode: 400,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        error: 'Bad Request',
        message: 'Validation failed for one or more fields',
        details: [
          { field: 'email', message: 'Invalid email address format' },
          { field: 'password', message: 'Password must be at least 8 characters' },
        ],
      },
      null,
      2
    ),
  },
  {
    name: 'Unauthorized Error (401)',
    description: 'Missing or expired token error',
    statusCode: 401,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        error: 'Unauthorized',
        code: 401,
        message: 'Authentication token is invalid or has expired',
      },
      null,
      2
    ),
  },
  {
    name: 'Permission Denied (403 Forbidden)',
    description: 'User lacks required role or permissions',
    statusCode: 403,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        error: 'Forbidden',
        code: 403,
        message: 'You do not have permission to perform this action',
      },
      null,
      2
    ),
  },
  {
    name: 'Not Found (404 Not Found)',
    description: 'Resource or endpoint does not exist',
    statusCode: 404,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        error: 'Not Found',
        code: 404,
        message: 'The requested resource was not found on this server',
      },
      null,
      2
    ),
  },
  {
    name: 'Server Error (500 Internal Error)',
    description: 'Simulate upstream database or internal failure',
    statusCode: 500,
    contentType: 'application/json',
    body: JSON.stringify(
      {
        error: 'Internal Server Error',
        code: 500,
        message: 'A critical database connection timeout occurred',
        traceId: 'trc_998124_mock',
      },
      null,
      2
    ),
  },
];

export const COMPOSER_REQUEST_PRESETS: { name: string; method: string; url: string; headers: Record<string, string>; body: string }[] = [
  {
    name: 'JSON POST Request',
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'HTTPeek-Composer/1.0',
    },
    body: JSON.stringify({ message: 'Hello from HTTPeek ProxyPin', timestamp: '2026-08-16T00:00:00Z' }, null, 2),
  },
  {
    name: 'Bearer Auth GET Request',
    method: 'GET',
    url: 'https://httpbin.org/bearer',
    headers: {
      'Authorization': 'Bearer test_token_abc123',
      'Accept': 'application/json',
    },
    body: '',
  },
  {
    name: 'Form URL-Encoded POST',
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'username=developer&password=secret123&grant_type=password',
  },
];
