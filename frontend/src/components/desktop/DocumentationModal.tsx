import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Search,
  Copy,
  Check,
  Code2,
  Sliders,
  PauseCircle,
  ShieldAlert,
  Wrench,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
  FileCode,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';

export interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  onOpenRules?: () => void;
  onOpenToolbox?: () => void;
  onOpenBreakpoints?: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'quickstart',
  onOpenRules,
  onOpenToolbox,
  onOpenBreakpoints,
}) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const navSections = [
    { id: 'quickstart', title: 'Quick Start Guide', icon: <Zap className="w-4 h-4 text-amber-500" /> },
    { id: 'rulebuilder', title: 'GUI Rule Builder', icon: <Sliders className="w-4 h-4 text-blue-500" /> },
    { id: 'breakpoints', title: 'Live Breakpoints', icon: <PauseCircle className="w-4 h-4 text-rose-500" /> },
    { id: 'hostfilters', title: 'Whitelist & Blacklist', icon: <ShieldAlert className="w-4 h-4 text-emerald-500" /> },
    { id: 'toolbox', title: 'Toolbox Suite (16 Tools)', icon: <Wrench className="w-4 h-4 text-purple-500" /> },
    { id: 'javascript', title: 'JavaScript Scripting API', icon: <Code2 className="w-4 h-4 text-yellow-500" /> },
    { id: 'sslsecurity', title: 'SSL & CA Trust Setup', icon: <Lock className="w-4 h-4 text-indigo-500" /> },
    { id: 'shortcuts', title: 'Keyboard Shortcuts', icon: <Terminal className="w-4 h-4 text-teal-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none font-sans">
      <div
        className="w-[920px] h-[660px] rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--md-dialog-bg, #ffffff)',
          borderColor: 'var(--md-sys-color-divider, rgba(128,128,128,0.2))',
          color: 'var(--md-sys-color-on-surface, #1f2937)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl text-white shadow-xs"
              style={{ backgroundColor: activeColor.hex }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">HTTPeek Interactive Documentation &amp; Reference</h2>
              <p className="text-xs text-gray-500">
                In-app guides, script APIs, and debugging manual by OneManByte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs & APIs..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                style={{ borderColor: 'var(--md-sys-color-outline, rgba(128,128,128,0.3))' }}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body with Left Sidebar Navigation */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-60 border-r border-gray-200 dark:border-gray-800 p-2 flex flex-col gap-1 bg-gray-50/40 dark:bg-gray-900/30 overflow-y-auto shrink-0">
            {navSections.map((sec) => {
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {sec.icon}
                    <span>{sec.title}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              );
            })}

            <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-800">
              <a
                href="https://github.com/Arslan10227/HTTPeek"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 text-[11px] text-gray-500 hover:text-blue-500 transition-colors"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Right Document Pane */}
          <div className="flex-1 p-6 overflow-y-auto text-xs leading-relaxed">
            {/* TAB: Quickstart */}
            {activeTab === 'quickstart' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Quick Start Guide
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Capture and debug HTTP, HTTPS, WebSocket, and SSE traffic across your local machine and mobile devices.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">1. Start Desktop Capture</span>
                    <p className="text-gray-500 text-[11px]">
                      Click the <strong>Start (Port 9099)</strong> button in the top toolbar. HTTPeek listens for incoming HTTP/HTTPS traffic.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">2. System Proxy Toggle</span>
                    <p className="text-gray-500 text-[11px]">
                      Open <strong>Settings → Proxy → Set as System Proxy</strong> to automatically route all operating system traffic through HTTPeek.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">3. Install Root CA Certificate</span>
                    <p className="text-gray-500 text-[11px]">
                      Click the <strong>SSL Lock icon</strong> in the top toolbar to install the HTTPeek Root CA for HTTPS MITM decryption.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">4. Connect Mobile Device</span>
                    <p className="text-gray-500 text-[11px]">
                      Click the <strong>Mobile icon</strong> to reveal the pairing QR code. Scan it using the HTTPeek Android Companion App.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Rule Builder */}
            {activeTab === 'rulebuilder' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-500" />
                      Visual GUI Rule Builder
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Create powerful rewrite, mock, and redirection rules using visual condition matchers.
                    </p>
                  </div>
                  {onOpenRules && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRules();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Open Rule Builder</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20">
                    <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Condition Matchers</h4>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                      <li><strong>Wildcard URL:</strong> Use <code>*://api.example.com/v1/*</code> or <code>*.test.com</code> to match whole domain hierarchies.</li>
                      <li><strong>Regex URL:</strong> Write regular expressions like <code>^https:\/\/api\..*\/users\/\d+$</code> for dynamic path parameters.</li>
                      <li><strong>Method Badges:</strong> Select specific HTTP methods (GET, POST, PUT, DELETE) or ALL.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Action Types</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">Request / Response Rewrite</span>
                        <p className="text-gray-500 mt-0.5">Inject headers, override status codes, or search-and-replace body strings.</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Static / Dynamic Mock</span>
                        <p className="text-gray-500 mt-0.5">Return custom JSON/XML responses with selectable status codes (200, 404, 500).</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-amber-600 dark:text-amber-400">Map Local / Remote</span>
                        <p className="text-gray-500 mt-0.5">Serve local files/directories or transparently redirect traffic to staging servers.</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-purple-600 dark:text-purple-400">JavaScript Interceptor</span>
                        <p className="text-gray-500 mt-0.5">Run custom ECMAScript transformations on live request/response streams.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Breakpoints */}
            {activeTab === 'breakpoints' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-rose-500" />
                      Live Breakpoints &amp; Traffic Pause
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Intercept live HTTP transactions, modify headers, status codes, or JSON payloads on the fly.
                    </p>
                  </div>
                  {onOpenBreakpoints && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBreakpoints();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-xs"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Manage Breakpoints</span>
                    </button>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-3">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">How Breakpoints Work:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-600 dark:text-gray-400">
                    <li><strong>Set a Breakpoint Rule:</strong> Configure a URL pattern (e.g. <code>api.example.com/login</code>) and phase (Request, Response, or Both).</li>
                    <li><strong>Trigger Paused State:</strong> When matched traffic passes through, HTTPeek holds the TCP connection open and displays the Breakpoint Drawer.</li>
                    <li><strong>Modify Data:</strong> Edit headers with autocomplete, pick a new Status Code (e.g. <code>401 Unauthorized</code>), or format the JSON body.</li>
                    <li><strong>Resume or Drop:</strong> Click <strong>Resume with Changes</strong> to forward the modified payload, or <strong>Abort &amp; Drop</strong> to terminate.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB: Host Filters */}
            {activeTab === 'hostfilters' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-500" />
                    Whitelist &amp; Blacklist (Host Filter)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Clean noisy background telemetry and focus only on the domains you care about.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Whitelist Mode</span>
                    <p className="text-gray-500 text-[11px] mt-1">
                      When enabled, HTTPeek will <strong>only capture</strong> requests matching the specified domains (e.g. <code>*.myapi.com</code>).
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <span className="font-bold text-rose-600 dark:text-rose-400">Blacklist Mode</span>
                    <p className="text-gray-500 text-[11px] mt-1">
                      Silently ignores telemetry, crash reporters, and analytics services (e.g. <code>*.apple.com</code>, <code>*.google-analytics.com</code>).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-xs">Quick Context Menu:</span>
                  <p className="text-gray-500 text-[11px] mt-1">
                    Right-click any captured request in the traffic list and select <strong>Add to Whitelist</strong> or <strong>Add to Blacklist</strong> for instant filtering.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: Toolbox */}
            {activeTab === 'toolbox' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-purple-500" />
                      Toolbox Suite (16 Built-in Tools)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Everything needed for day-to-day web inspection and cryptographic analysis.
                    </p>
                  </div>
                  {onOpenToolbox && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenToolbox();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer shadow-xs"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Open Toolbox</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">JSON &amp; XML Viewer:</span> Formatting, validation &amp; tree exploration.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">Text Diff Tool:</span> Visual side-by-side payload comparison.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">Encoders:</span> URL, Base64, Hex, Unicode, HTML &amp; JWT decoder.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">Hashes:</span> MD5, SHA1, SHA256, SHA512 checksums.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">AES Crypto:</span> CBC, ECB, GCM &amp; CTR encryption/decryption.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">Cert Hash:</span> Android 8-char CA subject hash calculator.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">Regex Tester:</span> Instant pattern testing and replacement preview.
                  </div>
                  <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20">
                    <span className="font-bold">WebSocket Tester:</span> Live bidirectional frame timeline &amp; echo testing.
                  </div>
                </div>
              </div>
            )}

            {/* TAB: JavaScript API */}
            {activeTab === 'javascript' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-yellow-500" />
                    JavaScript Scripting Sandbox API
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Powered by Goja ECMAScript engine. Write dynamic handlers for requests and responses.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  {/* onRequest snippet */}
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                      <span>1. onRequest(context, request)</span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`function onRequest(context, request) {
    console.log("[Script] Intercepted:", request.method, request.url);
    
    // Inject Custom Header
    request.headers['Authorization'] = 'Bearer ' + context.env['AUTH_TOKEN'];
    
    // Modify URL Query
    request.url = request.url + '&source=httpeek_debug';
    
    return request;
}`, 'req-snippet')}
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-600 cursor-pointer font-normal"
                      >
                        {copiedSnippet === 'req-snippet' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet === 'req-snippet' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto">
{`function onRequest(context, request) {
    console.log("[Script] Intercepted:", request.method, request.url);
    
    // Inject Custom Header
    request.headers['Authorization'] = 'Bearer ' + context.env['AUTH_TOKEN'];
    
    // Modify URL Query
    request.url = request.url + '&source=httpeek_debug';
    
    return request;
}`}
                    </pre>
                  </div>

                  {/* onResponse snippet */}
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                      <span>2. onResponse(context, request, response)</span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`function onResponse(context, request, response) {
    // Override Status Code
    response.statusCode = 200;
    
    // Parse & Modify JSON Body
    try {
        var data = JSON.parse(response.body);
        data.injected = true;
        data.mockedAt = new Date().toISOString();
        response.body = JSON.stringify(data);
    } catch(e) {}
    
    return response;
}`, 'resp-snippet')}
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-600 cursor-pointer font-normal"
                      >
                        {copiedSnippet === 'resp-snippet' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSnippet === 'resp-snippet' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto">
{`function onResponse(context, request, response) {
    // Override Status Code
    response.statusCode = 200;
    
    // Parse & Modify JSON Body
    try {
        var data = JSON.parse(response.body);
        data.injected = true;
        data.mockedAt = new Date().toISOString();
        response.body = JSON.stringify(data);
    } catch(e) {}
    
    return response;
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SSL Security */}
            {activeTab === 'sslsecurity' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    SSL &amp; Root CA Certificate Setup
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Configure trust stores on Windows, macOS, Linux, and Android for HTTPS interception.
                  </p>
                </div>

                <div className="flex flex-col gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Desktop CA Auto-Install</h4>
                    <p>Click the SSL Lock icon on the toolbar → <strong>Install Root CA</strong>. On Windows, HTTPeek uses <code>certutil.exe -addstore -f "ROOT"</code> to install the certificate to the Trusted Root Certification Authorities store.</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Android 7.0+ (API 24+) Network Security Config</h4>
                    <p>Android 7.0+ apps do not trust user certificates by default. To capture app traffic, add the following to <code>res/xml/network_security_config.xml</code>:</p>
                    <pre className="p-2.5 mt-2 bg-gray-900 text-gray-100 font-mono text-[10px] rounded-lg">
{`<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Shortcuts */}
            {activeTab === 'shortcuts' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-teal-500" />
                    Keyboard Shortcuts &amp; Productivity Tips
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Speed up your debugging workflow with hotkeys.
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="p-2.5">Shortcut</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">F1 / ?</td>
                        <td className="p-2.5">Open In-App Documentation Modal</td>
                        <td className="p-2.5 text-gray-400">Global</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">Ctrl + K / Cmd + K</td>
                        <td className="p-2.5">Focus Search / Filter Bar</td>
                        <td className="p-2.5 text-gray-400">Traffic List</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">Ctrl + Shift + L</td>
                        <td className="p-2.5">Clear All Captured Requests</td>
                        <td className="p-2.5 text-gray-400">Traffic List</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">Up / Down Arrow</td>
                        <td className="p-2.5">Navigate Selected Request</td>
                        <td className="p-2.5 text-gray-400">Traffic List</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">Escape</td>
                        <td className="p-2.5">Close Active Modal / Context Menu</td>
                        <td className="p-2.5 text-gray-400">Global</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
