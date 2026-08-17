export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

export interface ProcessInfo {
  pid?: number;
  name?: string;
  path?: string;
  icon?: string;
}

export interface HostPort {
  host: string;
  port: number;
  ssl?: boolean;
}

export interface WsFrame {
  id?: string;
  requestId?: string;
  opcode?: number | string;
  opcodeName?: string;
  direction?: 'send' | 'receive';
  fromClient?: boolean;
  text?: string;
  payload?: string;
  length?: number;
  isBinary?: boolean;
  timestamp?: string | number;
}

export interface SSEEvent {
  id?: string;
  requestId?: string;
  event?: string;
  data?: string;
  retry?: number;
  timestamp?: string | number;
}

export interface HttpResponse {
  id?: string;
  statusCode: number;
  statusText?: string;
  protocol?: string;
  headers?: Record<string, string> | any;
  body?: string;
  bodyString?: string;
  bodyBase64?: string;
  bodySize?: number;
  contentType?: string;
  isBinary?: boolean;
  startTime?: string;
  endTime?: string;
  duration?: number;
  durationMs?: number;
  wsFrames?: WsFrame[];
  sseEvents?: SSEEvent[];
}

export interface AppliedRule {
  id: string;
  type: string;
  summary: string;
}

export interface ExchangeTimings {
  dns?: number;
  connect?: number;
  tls?: number;
  ttfb?: number;
  total?: number;
}

export interface HttpRequest {
  id: string;
  exchangeId?: string;
  streamId?: number;
  protocol?: string;
  method: string;
  url: string;
  path?: string;
  query?: Record<string, string[]>;
  headers?: Record<string, string> | any;
  body?: string;
  bodyString?: string;
  bodyBase64?: string;
  remoteAddr?: string;
  clientAddr?: string;
  hostPort?: HostPort;
  process?: ProcessInfo;
  processName?: string;
  startTime?: string;
  endTime?: string;
  timestamp?: number;
  duration?: number;
  durationMs?: number;
  timings?: ExchangeTimings;
  appliedRules?: AppliedRule[];
  response?: HttpResponse;
  isFavorite?: boolean;
  isWebSocket?: boolean;
  wsFrames?: WsFrame[];
  sseEvents?: SSEEvent[];
}

export interface BreakpointEvent {
  id?: string;
  requestId?: string;
  stage?: 'request' | 'response';
  type?: 'request' | 'response';
  request?: HttpRequest;
  response?: HttpResponse;
}

export interface ProxyStatus {
  running?: boolean;
  port?: number;
  enableSsl?: boolean;
  sslEnabled?: boolean;
  systemProxy?: boolean;
  systemProxyEnabled?: boolean;
  caInstalled?: boolean;
  isCaInstalled?: boolean;
}

// Rule Types with Dual Compatibility (ProxyPin & HTTPeek)
export interface HostRule {
  id: string;
  name?: string;
  domain?: string;
  target?: string;
  pattern?: string;
  targetIp?: string;
  enabled: boolean;
}

export interface BlockRule {
  id: string;
  name?: string;
  urlPattern: string;
  action?: '403' | 'drop' | string;
  statusCode?: number;
  enabled: boolean;
}

export interface RewriteItem {
  id: string;
  type: string;
  enabled: boolean;
  key?: string;
  value?: string;
  method?: string;
  path?: string;
  queryParam?: string;
  statusCode?: number;
  bodyFile?: string;
  isRegex?: boolean;
}

export type RuleActionType = 'replace' | 'redirect' | 'update' | 'modify_headers' | 'drop' | 'delay';
export type UrlMatchType = 'wildcard' | 'regex' | 'exact' | 'contains' | 'prefix';
export type HttpBodyType = 'json' | 'form-urlencoded' | 'raw' | 'xml' | 'html' | 'base64' | 'graphql';

export interface HeaderModifier {
  action: 'set' | 'remove';
  key: string;
  value: string;
  stage?: 'request' | 'response';
}

export interface QueryModifier {
  action: 'set' | 'remove';
  key: string;
  value: string;
}

export interface FormDataEntry {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RewriteRule {
  id: string;
  name?: string;
  urlPattern: string;
  matchType?: UrlMatchType;
  method?: string;
  action?: RuleActionType;
  stage?: 'request' | 'response' | 'both';
  type?: string;
  redirectUrl?: string;
  replaceBody?: string;
  bodyType?: HttpBodyType;
  formData?: FormDataEntry[];
  replaceHeaders?: Record<string, string>;
  replaceStatus?: number;
  statusCode?: number;
  headers?: Record<string, string>;
  headerModifiers?: HeaderModifier[];
  queryModifiers?: QueryModifier[];
  delayMs?: number;
  items?: RewriteItem[];
  enabled: boolean;
}

export interface MockRule {
  id: string;
  name?: string;
  urlPattern: string;
  type?: 'localFile' | 'localDir' | 'staticMock' | string;
  filePath?: string;
  targetFile?: string;
  targetDir?: string;
  responseBody?: string;
  body?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  contentType?: string;
  enabled: boolean;
}

export interface CryptoRule {
  id: string;
  name?: string;
  urlPattern: string;
  algorithm?: 'AES-CBC' | 'AES-ECB' | 'AES-GCM' | 'AES_CBC' | 'AES_ECB' | 'AES_GCM' | 'AES_CTR' | string;
  encoding?: 'base64' | 'hex' | 'raw';
  key: string;
  iv?: string;
  target?: 'both' | 'request' | 'response';
  decryptReq?: boolean;
  decryptRes?: boolean;
  enabled: boolean;
}

export interface ScriptRule {
  id: string;
  name: string;
  urlPattern: string;
  script: string;
  enabled: boolean;
}

export interface BreakpointRule {
  id: string;
  name?: string;
  urlPattern: string;
  method?: string;
  breakType?: 'both' | 'request' | 'response';
  interceptRequest?: boolean;
  interceptResponse?: boolean;
  enabled: boolean;
}

export interface ThrottleProfile {
  id?: string;
  name: string;
  enabled?: boolean;
  urlPattern?: string;
  downstreamKbps?: number;
  upstreamKbps?: number;
  latencyMs?: number;
  jitterMs?: number;
  dropRate?: number;
  latencyUpMs?: number;
  latencyDownMs?: number;
  kbpsUp?: number;
  kbpsDown?: number;
  packetLossRate?: number;
}

export interface ThrottleConfig {
  enabled: boolean;
  profile: ThrottleProfile;
}

export interface FilterConfig {
  mode: 'blacklist' | 'whitelist';
  rules: string[];
}

export interface HostFilterConfig {
  whitelist?: string[];
  blacklist?: string[];
  whitelistEnabled?: boolean;
  blacklistEnabled?: boolean;
}
