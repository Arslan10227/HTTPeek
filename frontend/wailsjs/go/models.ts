export namespace cert {
	
	export class ADBDeviceInfo {
	    serial: string;
	    state: string;
	    model: string;
	    rooted: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ADBDeviceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serial = source["serial"];
	        this.state = source["state"];
	        this.model = source["model"];
	        this.rooted = source["rooted"];
	    }
	}
	export class InstallStepResult {
	    method: string;
	    status: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallStepResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}
	export class AndroidInstallResult {
	    success: boolean;
	    adbAvailable: boolean;
	    deviceSerial: string;
	    rooted: boolean;
	    subjectHash: string;
	    certFileName: string;
	    steps: InstallStepResult[];
	
	    static createFrom(source: any = {}) {
	        return new AndroidInstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.adbAvailable = source["adbAvailable"];
	        this.deviceSerial = source["deviceSerial"];
	        this.rooted = source["rooted"];
	        this.subjectHash = source["subjectHash"];
	        this.certFileName = source["certFileName"];
	        this.steps = this.convertValues(source["steps"], InstallStepResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class JavaInstallation {
	    path: string;
	    version: string;
	    vendor: string;
	    keytoolPath: string;
	    cacertsPath: string;
	    isInstalled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new JavaInstallation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.version = source["version"];
	        this.vendor = source["vendor"];
	        this.keytoolPath = source["keytoolPath"];
	        this.cacertsPath = source["cacertsPath"];
	        this.isInstalled = source["isInstalled"];
	    }
	}

}

export namespace interceptor {
	
	export class BlockRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    action: string;
	    statusCode?: number;
	
	    static createFrom(source: any = {}) {
	        return new BlockRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.action = source["action"];
	        this.statusCode = source["statusCode"];
	    }
	}
	export class BreakpointRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    method?: string;
	    interceptRequest: boolean;
	    interceptResponse: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BreakpointRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.method = source["method"];
	        this.interceptRequest = source["interceptRequest"];
	        this.interceptResponse = source["interceptResponse"];
	    }
	}
	export class CryptoRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    algorithm: string;
	    encoding: string;
	    key: string;
	    iv?: string;
	    decryptReq: boolean;
	    decryptRes: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CryptoRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.algorithm = source["algorithm"];
	        this.encoding = source["encoding"];
	        this.key = source["key"];
	        this.iv = source["iv"];
	        this.decryptReq = source["decryptReq"];
	        this.decryptRes = source["decryptRes"];
	    }
	}
	export class HostFilterConfig {
	    whitelistEnabled: boolean;
	    whitelist: string[];
	    blacklistEnabled: boolean;
	    blacklist: string[];
	
	    static createFrom(source: any = {}) {
	        return new HostFilterConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.whitelistEnabled = source["whitelistEnabled"];
	        this.whitelist = source["whitelist"];
	        this.blacklistEnabled = source["blacklistEnabled"];
	        this.blacklist = source["blacklist"];
	    }
	}
	export class HostRule {
	    id: string;
	    name?: string;
	    enabled: boolean;
	    pattern: string;
	    targetIp: string;
	
	    static createFrom(source: any = {}) {
	        return new HostRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.pattern = source["pattern"];
	        this.targetIp = source["targetIp"];
	    }
	}
	export class MapRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    type: string;
	    targetFile?: string;
	    targetDir?: string;
	    statusCode?: number;
	    headers?: Record<string, string>;
	    body?: string;
	    contentType?: string;
	
	    static createFrom(source: any = {}) {
	        return new MapRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.type = source["type"];
	        this.targetFile = source["targetFile"];
	        this.targetDir = source["targetDir"];
	        this.statusCode = source["statusCode"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.contentType = source["contentType"];
	    }
	}
	export class ReportServerConfig {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern?: string;
	    webhookUrl: string;
	    headers?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ReportServerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.webhookUrl = source["webhookUrl"];
	        this.headers = source["headers"];
	    }
	}
	export class RewriteItem {
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
	
	    static createFrom(source: any = {}) {
	        return new RewriteItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.enabled = source["enabled"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.queryParam = source["queryParam"];
	        this.statusCode = source["statusCode"];
	        this.bodyFile = source["bodyFile"];
	        this.isRegex = source["isRegex"];
	    }
	}
	export class RewriteRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    method?: string;
	    redirectUrl?: string;
	    type: string;
	    items: RewriteItem[];
	
	    static createFrom(source: any = {}) {
	        return new RewriteRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.method = source["method"];
	        this.redirectUrl = source["redirectUrl"];
	        this.type = source["type"];
	        this.items = this.convertValues(source["items"], RewriteItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ScriptRule {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern: string;
	    scriptCode: string;
	
	    static createFrom(source: any = {}) {
	        return new ScriptRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.scriptCode = source["scriptCode"];
	    }
	}
	export class ThrottleProfile {
	    id: string;
	    name: string;
	    enabled: boolean;
	    urlPattern?: string;
	    downstreamKbps: number;
	    upstreamKbps: number;
	    latencyMs: number;
	    jitterMs: number;
	    dropRate: number;
	
	    static createFrom(source: any = {}) {
	        return new ThrottleProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.enabled = source["enabled"];
	        this.urlPattern = source["urlPattern"];
	        this.downstreamKbps = source["downstreamKbps"];
	        this.upstreamKbps = source["upstreamKbps"];
	        this.latencyMs = source["latencyMs"];
	        this.jitterMs = source["jitterMs"];
	        this.dropRate = source["dropRate"];
	    }
	}
	export class ThrottleConfig {
	    enabled: boolean;
	    profile?: ThrottleProfile;
	
	    static createFrom(source: any = {}) {
	        return new ThrottleConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.profile = this.convertValues(source["profile"], ThrottleProfile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace logger {
	
	export class Entry {
	    timestamp: string;
	    level: string;
	    caller: string;
	    category: string;
	    message: string;
	    fields?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.level = source["level"];
	        this.caller = source["caller"];
	        this.category = source["category"];
	        this.message = source["message"];
	        this.fields = source["fields"];
	    }
	}

}

export namespace proxy {
	
	export class AppliedRule {
	    id: string;
	    type: string;
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new AppliedRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.summary = source["summary"];
	    }
	}
	export class ExchangeTimings {
	    dns?: number;
	    connect?: number;
	    tls?: number;
	    ttfb?: number;
	    total?: number;
	
	    static createFrom(source: any = {}) {
	        return new ExchangeTimings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dns = source["dns"];
	        this.connect = source["connect"];
	        this.tls = source["tls"];
	        this.ttfb = source["ttfb"];
	        this.total = source["total"];
	    }
	}
	export class HostPort {
	    host: string;
	    port: number;
	    ssl: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HostPort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.ssl = source["ssl"];
	    }
	}
	export class SSEEvent {
	    id: string;
	    requestId: string;
	    event: string;
	    data: string;
	    retry?: number;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new SSEEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.requestId = source["requestId"];
	        this.event = source["event"];
	        this.data = source["data"];
	        this.retry = source["retry"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WsFrame {
	    id: string;
	    requestId: string;
	    opcode: number;
	    opcodeName: string;
	    direction: string;
	    text?: string;
	    length: number;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new WsFrame(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.requestId = source["requestId"];
	        this.opcode = source["opcode"];
	        this.opcodeName = source["opcodeName"];
	        this.direction = source["direction"];
	        this.text = source["text"];
	        this.length = source["length"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HttpResponse {
	    id: string;
	    requestId?: string;
	    statusCode: number;
	    statusText: string;
	    protocol: string;
	    headers: Record<string, Array<string>>;
	    bodyBase64?: string;
	    bodyString: string;
	    body: string;
	    bodySize: number;
	    contentType: string;
	    isBinary: boolean;
	    // Go type: time
	    startTime: any;
	    // Go type: time
	    endTime: any;
	    durationMs: number;
	    wsFrames?: WsFrame[];
	    sseEvents?: SSEEvent[];
	
	    static createFrom(source: any = {}) {
	        return new HttpResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.requestId = source["requestId"];
	        this.statusCode = source["statusCode"];
	        this.statusText = source["statusText"];
	        this.protocol = source["protocol"];
	        this.headers = source["headers"];
	        this.bodyBase64 = source["bodyBase64"];
	        this.bodyString = source["bodyString"];
	        this.body = source["body"];
	        this.bodySize = source["bodySize"];
	        this.contentType = source["contentType"];
	        this.isBinary = source["isBinary"];
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.endTime = this.convertValues(source["endTime"], null);
	        this.durationMs = source["durationMs"];
	        this.wsFrames = this.convertValues(source["wsFrames"], WsFrame);
	        this.sseEvents = this.convertValues(source["sseEvents"], SSEEvent);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProcessInfo {
	    pid: number;
	    name: string;
	    path: string;
	    icon?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.icon = source["icon"];
	    }
	}
	export class HttpRequest {
	    id: string;
	    exchangeId?: string;
	    streamId?: number;
	    protocol: string;
	    method: string;
	    url: string;
	    path: string;
	    query: Record<string, Array<string>>;
	    headers: Record<string, Array<string>>;
	    bodyBase64?: string;
	    bodyString: string;
	    body: string;
	    remoteAddr: string;
	    clientAddr: string;
	    hostPort: HostPort;
	    process?: ProcessInfo;
	    // Go type: time
	    startTime: any;
	    // Go type: time
	    endTime: any;
	    durationMs: number;
	    timings?: ExchangeTimings;
	    appliedRules?: AppliedRule[];
	    isFavorite: boolean;
	    isWebSocket: boolean;
	    response?: HttpResponse;
	
	    static createFrom(source: any = {}) {
	        return new HttpRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.exchangeId = source["exchangeId"];
	        this.streamId = source["streamId"];
	        this.protocol = source["protocol"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.path = source["path"];
	        this.query = source["query"];
	        this.headers = source["headers"];
	        this.bodyBase64 = source["bodyBase64"];
	        this.bodyString = source["bodyString"];
	        this.body = source["body"];
	        this.remoteAddr = source["remoteAddr"];
	        this.clientAddr = source["clientAddr"];
	        this.hostPort = this.convertValues(source["hostPort"], HostPort);
	        this.process = this.convertValues(source["process"], ProcessInfo);
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.endTime = this.convertValues(source["endTime"], null);
	        this.durationMs = source["durationMs"];
	        this.timings = this.convertValues(source["timings"], ExchangeTimings);
	        this.appliedRules = this.convertValues(source["appliedRules"], AppliedRule);
	        this.isFavorite = source["isFavorite"];
	        this.isWebSocket = source["isWebSocket"];
	        this.response = this.convertValues(source["response"], HttpResponse);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class MobileDeviceInfo {
	    deviceId: string;
	    deviceName: string;
	    osVersion: string;
	    isRooted: boolean;
	    remoteIp: string;
	    // Go type: time
	    connectedAt: any;
	    // Go type: time
	    lastPing: any;
	    packetCount: number;
	
	    static createFrom(source: any = {}) {
	        return new MobileDeviceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.deviceId = source["deviceId"];
	        this.deviceName = source["deviceName"];
	        this.osVersion = source["osVersion"];
	        this.isRooted = source["isRooted"];
	        this.remoteIp = source["remoteIp"];
	        this.connectedAt = this.convertValues(source["connectedAt"], null);
	        this.lastPing = this.convertValues(source["lastPing"], null);
	        this.packetCount = source["packetCount"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

export namespace storage {
	
	export class Session {
	    id: string;
	    name: string;
	    // Go type: time
	    createdAt: any;
	    requestCount: number;
	    fileSize: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.requestCount = source["requestCount"];
	        this.fileSize = source["fileSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

