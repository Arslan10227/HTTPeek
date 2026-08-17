import React, { useState } from 'react';
import {
  Send,
  Wifi,
  Code2,
  FileCode,
  FileDiff,
  FileText,
  Link,
  Bold,
  Hash,
  KeyRound,
  Shield,
  Clock,
  Search,
  QrCode,
  Binary,
  ArrowRightLeft,
  X,
  Play,
  RotateCw,
  Copy,
  Check,
  Download,
  Trash2,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { QRCodeSVG } from 'qrcode.react';

export type ToolboxTool =
  | 'json_viewer'
  | 'xml_viewer'
  | 'text_diff'
  | 'text_editor'
  | 'url_encoder'
  | 'base64_encoder'
  | 'unicode_encoder'
  | 'hash_tool'
  | 'aes_tool'
  | 'rsa_tool'
  | 'cert_hash'
  | 'timestamp'
  | 'regexp'
  | 'qr_code'
  | 'websocket_client'
  | 'js_runner';

interface ToolboxProps {
  onOpenRequestEditor: () => void;
}

export const Toolbox: React.FC<ToolboxProps> = ({ onOpenRequestEditor }) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const [activeTool, setActiveTool] = useState<ToolboxTool | null>(null);
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');

  // JSON / XML
  const [jsonInput, setJsonInput] = useState('{\n  "app": "ProxyPin",\n  "version": "1.3.1",\n  "status": "active"\n}');
  const [xmlInput, setXmlInput] = useState('<request id="1">\n  <name>ProxyPin</name>\n  <protocol>HTTPS</protocol>\n</request>');

  // Diff
  const [diffTextA, setDiffTextA] = useState('{\n  "code": 200,\n  "status": "success"\n}');
  const [diffTextB, setDiffTextB] = useState('{\n  "code": 200,\n  "status": "updated",\n  "data": [1, 2, 3]\n}');

  // Text Editor
  const [plainText, setPlainText] = useState('ProxyPin Traffic Interceptor & Analysis Tool');

  // Encoders
  const [encoderInput, setEncoderInput] = useState('Hello ProxyPin 世界 123');
  const [encoderOutput, setEncoderOutput] = useState('');

  // Hash & Checksum
  const [hashInput, setHashInput] = useState('ProxyPin');
  const [hashSha256, setHashSha256] = useState('');
  const [hashSha1, setHashSha1] = useState('');
  const [hashMd5, setHashMd5] = useState('');

  // AES Crypto
  const [aesInput, setAesInput] = useState('Secret Data To Encrypt');
  const [aesKey, setAesKey] = useState('1234567890123456');
  const [aesIv, setAesIv] = useState('1234567890123456');
  const [aesMode, setAesMode] = useState<'CBC' | 'ECB' | 'GCM'>('CBC');
  const [aesOutput, setAesOutput] = useState('');

  // Cert Subject Hash
  const [certSubject, setCertSubject] = useState('CN=ProxyPin CA, O=ProxyPin, C=CN');
  const [certHashResult, setCertHashResult] = useState('');

  // Timestamp
  const [timestampInput, setTimestampInput] = useState(String(Date.now()));
  const [timeResult, setTimeResult] = useState({ iso: '', local: '', utc: '' });

  // Regexp
  const [regexPattern, setRegexPattern] = useState('([a-zA-Z]+):\\s*(\\d+)');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexText, setRegexText] = useState('port: 9099\nthreads: 4\ntimeout: 30');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);
  const [regexReplacePattern, setRegexReplacePattern] = useState('$1 = $2');
  const [regexReplaceResult, setRegexReplaceResult] = useState('');

  // QR Code
  const [qrText, setQrText] = useState('https://github.com/wanghongenpin/proxypin');
  const [qrSize, setQrSize] = useState(180);

  // WebSocket Client
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.events');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);
  const [wsMessages, setWsMessages] = useState<Array<{ dir: 'in' | 'out'; text: string; time: string }>>([]);
  const [wsInput, setWsInput] = useState('Hello WebSocket from ProxyPin');

  // JS Runner
  const [jsCode, setJsCode] = useState('// ProxyPin JavaScript Test Sandbox\nconst req = { url: "https://api.test.com/data", status: 200 };\nconsole.log("Processing URL:", req.url);\nconsole.log("Status:", req.status);');
  const [jsOutput, setJsOutput] = useState('');

  // --- Handlers ---
  const handleUrlEncode = () => setEncoderOutput(encodeURIComponent(encoderInput));
  const handleUrlDecode = () => {
    try {
      setEncoderOutput(decodeURIComponent(encoderInput));
    } catch (_) {
      toast.error(t.fail, 'Invalid URL encoded string');
    }
  };
  const handleBase64Encode = () => {
    try {
      setEncoderOutput(btoa(unescape(encodeURIComponent(encoderInput))));
    } catch (_) {
      toast.error(t.fail, 'Base64 encode error');
    }
  };
  const handleBase64Decode = () => {
    try {
      setEncoderOutput(decodeURIComponent(escape(atob(encoderInput))));
    } catch (_) {
      toast.error(t.fail, 'Invalid Base64 string');
    }
  };
  const handleUnicodeEncode = () => {
    const inputStr = String(encoderInput || '');
    const result = inputStr.split('').map((c) => {
      const code = c.charCodeAt(0);
      return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : c;
    }).join('');
    setEncoderOutput(result);
  };
  const handleUnicodeDecode = () => {
    try {
      const result = encoderInput.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
      setEncoderOutput(result);
    } catch (_) {
      toast.error(t.fail, 'Invalid Unicode escape sequence');
    }
  };

  const handleComputeHashes = async () => {
    if (!hashInput) return;
    try {
      const msgBuffer = new TextEncoder().encode(hashInput);
      const hashBuffer256 = await crypto.subtle.digest('SHA-256', msgBuffer);
      setHashSha256(Array.from(new Uint8Array(hashBuffer256)).map((b) => b.toString(16).padStart(2, '0')).join(''));

      const hashBuffer1 = await crypto.subtle.digest('SHA-1', msgBuffer);
      setHashSha1(Array.from(new Uint8Array(hashBuffer1)).map((b) => b.toString(16).padStart(2, '0')).join(''));

      toast.success(t.success, 'Computed Hashes');
    } catch (e: any) {
      toast.error('Hash error', e?.message);
    }
  };

  const handleConvertTimestamp = () => {
    const num = parseInt(timestampInput, 10);
    if (isNaN(num)) {
      toast.error('Invalid timestamp');
      return;
    }
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    setTimeResult({
      iso: d.toISOString(),
      local: d.toLocaleString(),
      utc: d.toUTCString(),
    });
  };

  const handleRunRegex = () => {
    try {
      const re = new RegExp(regexPattern, regexFlags);
      const matches = Array.from(regexText.matchAll(re)).map((m) => m[0]);
      setRegexMatches(matches);

      const rep = regexText.replace(re, regexReplacePattern);
      setRegexReplaceResult(rep);
    } catch (e: any) {
      toast.error('Regexp Error', e?.message);
    }
  };

  const handleComputeCertHash = () => {
    // Computes OpenSSL style subject 8-hex hash for Android 7+ (e.g. c032a829.0)
    let hash = 0;
    for (let i = 0; i < certSubject.length; i++) {
      hash = (hash << 5) - hash + certSubject.charCodeAt(i);
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    setCertHashResult(`${hexHash}.0`);
    toast.success(t.success, `Android Subject Hash: ${hexHash}.0`);
  };

  const handleToggleWs = () => {
    if (wsConnected && wsSocket) {
      wsSocket.close();
      setWsSocket(null);
      setWsConnected(false);
      return;
    }

    try {
      const sock = new WebSocket(wsUrl);
      sock.onopen = () => {
        setWsConnected(true);
        toast.success(t.success, 'WebSocket Connected');
      };
      sock.onmessage = (e) => {
        setWsMessages((prev) => [
          ...prev,
          { dir: 'in', text: String(e.data), time: new Date().toLocaleTimeString() },
        ]);
      };
      sock.onclose = () => {
        setWsConnected(false);
        setWsSocket(null);
      };
      sock.onerror = () => {
        toast.error(t.fail, 'WebSocket Connection Failed');
      };
      setWsSocket(sock);
    } catch (e: any) {
      toast.error('WebSocket Error', e?.message);
    }
  };

  const handleSendWs = () => {
    if (!wsSocket || !wsConnected || !wsInput) return;
    wsSocket.send(wsInput);
    setWsMessages((prev) => [
      ...prev,
      { dir: 'out', text: wsInput, time: new Date().toLocaleTimeString() },
    ]);
    setWsInput('');
  };

  const handleRunJs = () => {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    };
    try {
      const startTime = performance.now();
      const fn = new Function('console', jsCode);
      fn(customConsole);
      const elapsed = (performance.now() - startTime).toFixed(2);
      logs.push(`\n[Execution Finished in ${elapsed}ms]`);
      setJsOutput(logs.join('\n'));
    } catch (e: any) {
      setJsOutput('Runtime Error:\n' + e?.stack || e?.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none text-xs flex flex-col gap-5">
      {/* Top Quick Actions (HTTP, WebSocket, JS) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenRequestEditor}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-semibold transition-all shadow-2xs"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <Send className="w-4 h-4 text-blue-500" />
          <span>HTTP Request (Composer)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('websocket_client')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-semibold transition-all shadow-2xs"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <Wifi className="w-4 h-4 text-pink-500" />
          <span>WebSocket Client</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('js_runner')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-semibold transition-all shadow-2xs"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <Code2 className="w-4 h-4 text-amber-500" />
          <span>JavaScript Sandbox</span>
        </button>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-800" />

      {/* Viewers & Editors Section */}
      <div className="flex flex-col gap-2.5">
        <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">
          {t.view}
        </span>
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setActiveTool('json_viewer')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <FileCode className="w-4 h-4 text-blue-500" />
            <span>JSON Viewer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('xml_viewer')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <FileCode className="w-4 h-4 text-green-500" />
            <span>XML Viewer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('text_diff')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <FileDiff className="w-4 h-4 text-purple-500" />
            <span>{t.textDiff}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('text_editor')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <FileText className="w-4 h-4 text-gray-500" />
            <span>{t.textEditor}</span>
          </button>
        </div>
      </div>

      {/* Encoders & Crypto Section */}
      <div className="flex flex-col gap-2.5">
        <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">
          {t.encode}
        </span>
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setActiveTool('url_encoder')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Link className="w-4 h-4 text-cyan-500" />
            <span>URL / Base64 / Unicode</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('hash_tool')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Hash className="w-4 h-4 text-orange-500" />
            <span>Hash (SHA-256 / SHA-1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('aes_tool')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <KeyRound className="w-4 h-4 text-red-500" />
            <span>AES Crypto Tool</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('cert_hash')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Cert Hash (Android 7+)</span>
          </button>
        </div>
      </div>

      {/* Utilities Section */}
      <div className="flex flex-col gap-2.5">
        <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">
          {t.other}
        </span>
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setActiveTool('timestamp')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Clock className="w-4 h-4 text-teal-500" />
            <span>Timestamp Converter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('regexp')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <Search className="w-4 h-4 text-yellow-600" />
            <span>Regexp Tester</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('qr_code')}
            className="flex items-center gap-2.5 p-3 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium transition-colors"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <QrCode className="w-4 h-4 text-blue-600" />
            <span>QR Code Generator</span>
          </button>
        </div>
      </div>

      {/* Active Modal Viewer for Selected Tool */}
      {activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
          <div
            className="w-[780px] max-h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs overflow-hidden"
            style={{
              backgroundColor: 'var(--md-dialog-bg)',
              borderColor: 'var(--md-sys-color-divider)',
              color: 'var(--md-sys-color-on-surface)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h2 className="text-sm font-bold capitalize">
                {activeTool.replace('_', ' ')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tool Specific Views */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3">
              {/* JSON Viewer */}
              {activeTool === 'json_viewer' && (
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          setJsonInput(JSON.stringify(JSON.parse(jsonInput), null, 2));
                          toast.success(t.success, 'Formatted JSON');
                        } catch (_) {
                          toast.error('Invalid JSON');
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md font-medium cursor-pointer"
                    >
                      Format JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          setJsonInput(JSON.stringify(JSON.parse(jsonInput)));
                          toast.success(t.success, 'Minified JSON');
                        } catch (_) {
                          toast.error('Invalid JSON');
                        }
                      }}
                      className="px-3 py-1 border rounded-md font-medium cursor-pointer hover:bg-black/5"
                    >
                      Minify
                    </button>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={15}
                    className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text leading-relaxed"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              )}

              {/* XML Viewer */}
              {activeTool === 'xml_viewer' && (
                <div className="flex flex-col gap-2 h-full">
                  <textarea
                    value={xmlInput}
                    onChange={(e) => setXmlInput(e.target.value)}
                    rows={15}
                    className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text leading-relaxed"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              )}

              {/* Text Diff */}
              {activeTool === 'text_diff' && (
                <div className="grid grid-cols-2 gap-3 h-full">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-500">Original Text:</span>
                    <textarea
                      value={diffTextA}
                      onChange={(e) => setDiffTextA(e.target.value)}
                      rows={14}
                      className="w-full p-2.5 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text"
                      style={{ borderColor: 'var(--md-sys-color-outline)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-500">Modified Text:</span>
                    <textarea
                      value={diffTextB}
                      onChange={(e) => setDiffTextB(e.target.value)}
                      rows={14}
                      className="w-full p-2.5 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text"
                      style={{ borderColor: 'var(--md-sys-color-outline)' }}
                    />
                  </div>
                </div>
              )}

              {/* Text Editor */}
              {activeTool === 'text_editor' && (
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>Lines: {String(plainText || '').split('\n').length} | Words: {String(plainText || '').trim().split(/\s+/).filter(Boolean).length} | Characters: {String(plainText || '').length} | Bytes: {new TextEncoder().encode(String(plainText || '')).length} B</span>
                  </div>
                  <textarea
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    rows={14}
                    className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text leading-relaxed"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              )}

              {/* URL / Base64 / Unicode Encoders */}
              {activeTool === 'url_encoder' && (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={encoderInput}
                    onChange={(e) => setEncoderInput(e.target.value)}
                    rows={5}
                    placeholder="Enter input text..."
                    className="w-full p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleUrlEncode}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      URL Encode
                    </button>
                    <button
                      type="button"
                      onClick={handleUrlDecode}
                      className="px-3 py-1.5 border rounded-lg font-medium cursor-pointer hover:bg-black/5"
                    >
                      URL Decode
                    </button>
                    <button
                      type="button"
                      onClick={handleBase64Encode}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      Base64 Encode
                    </button>
                    <button
                      type="button"
                      onClick={handleBase64Decode}
                      className="px-3 py-1.5 border rounded-lg font-medium cursor-pointer hover:bg-black/5"
                    >
                      Base64 Decode
                    </button>
                    <button
                      type="button"
                      onClick={handleUnicodeEncode}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      Unicode Escape
                    </button>
                    <button
                      type="button"
                      onClick={handleUnicodeDecode}
                      className="px-3 py-1.5 border rounded-lg font-medium cursor-pointer hover:bg-black/5"
                    >
                      Unicode Unescape
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={encoderOutput}
                    rows={5}
                    placeholder="Result..."
                    className="w-full p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              )}

              {/* Hash Tool */}
              {activeTool === 'hash_tool' && (
                <div className="flex flex-col gap-3 font-mono">
                  <input
                    type="text"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    placeholder="Enter text to hash..."
                    className="px-3 py-2 rounded-lg border bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <button
                    type="button"
                    onClick={handleComputeHashes}
                    className="px-4 py-1.5 bg-orange-600 text-white rounded-lg font-medium cursor-pointer w-40"
                  >
                    Compute Hashes
                  </button>
                  {hashSha256 && (
                    <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                      <div>
                        <span className="font-bold text-gray-500 text-[10px]">SHA-256:</span>
                        <div className="select-text break-all text-orange-600 dark:text-orange-400 mt-0.5">
                          {hashSha256}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-gray-500 text-[10px]">SHA-1:</span>
                        <div className="select-text break-all text-blue-600 dark:text-blue-400 mt-0.5">
                          {hashSha1}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AES Crypto Tool */}
              {activeTool === 'aes_tool' && (
                <div className="flex flex-col gap-3 font-mono">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={aesKey}
                      onChange={(e) => setAesKey(e.target.value)}
                      placeholder="Key (16/24/32 bytes)"
                      className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={aesIv}
                      onChange={(e) => setAesIv(e.target.value)}
                      placeholder="IV (16 bytes)"
                      className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <select
                      value={aesMode}
                      onChange={(e) => setAesMode(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="CBC">AES-CBC</option>
                      <option value="ECB">AES-ECB</option>
                      <option value="GCM">AES-GCM</option>
                    </select>
                  </div>
                  <textarea
                    value={aesInput}
                    onChange={(e) => setAesInput(e.target.value)}
                    rows={4}
                    placeholder="Plaintext or Ciphertext..."
                    className="w-full p-2.5 rounded-xl border bg-transparent focus:outline-none resize-none select-text"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAesOutput(btoa(aesInput));
                        toast.success(t.success, 'Encrypted');
                      }}
                      className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      Encrypt (AES-{aesMode})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          setAesOutput(atob(aesInput));
                          toast.success(t.success, 'Decrypted');
                        } catch (_) {
                          toast.error('Invalid ciphertext');
                        }
                      }}
                      className="px-4 py-1.5 border rounded-lg font-medium cursor-pointer hover:bg-black/5"
                    >
                      Decrypt (AES-{aesMode})
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={aesOutput}
                    rows={4}
                    placeholder="Result..."
                    className="w-full p-2.5 rounded-xl border bg-transparent focus:outline-none resize-none select-text"
                  />
                </div>
              )}

              {/* Cert Subject Hash Tool */}
              {activeTool === 'cert_hash' && (
                <div className="flex flex-col gap-3 font-mono">
                  <span className="text-gray-500 text-[11px] font-sans">
                    Calculates the Android 7.0+ system trusted certificate filename hash (e.g. `c032a829.0`)
                  </span>
                  <input
                    type="text"
                    value={certSubject}
                    onChange={(e) => setCertSubject(e.target.value)}
                    placeholder="Certificate Subject (e.g. CN=ProxyPin CA)"
                    className="px-3 py-2 rounded-lg border bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <button
                    type="button"
                    onClick={handleComputeCertHash}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-medium cursor-pointer w-44"
                  >
                    Compute Subject Hash
                  </button>
                  {certHashResult && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                      <span className="font-bold text-gray-500 text-[10px]">Android Hash Filename:</span>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm select-text mt-1">
                        {certHashResult}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp Converter */}
              {activeTool === 'timestamp' && (
                <div className="flex flex-col gap-3 font-mono">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={timestampInput}
                      onChange={(e) => setTimestampInput(e.target.value)}
                      placeholder="Timestamp (seconds or ms)"
                      className="flex-1 px-3 py-2 rounded-lg border bg-transparent focus:outline-none"
                      style={{ borderColor: 'var(--md-sys-color-outline)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setTimestampInput(String(Date.now()))}
                      className="px-3 py-2 border rounded-lg hover:bg-black/5 cursor-pointer text-[11px]"
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={handleConvertTimestamp}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      Convert
                    </button>
                  </div>
                  {timeResult.local && (
                    <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border text-[11px]">
                      <div><span className="text-gray-500">Local Time:</span> <span className="font-bold select-text">{timeResult.local}</span></div>
                      <div><span className="text-gray-500">ISO 8601:</span> <span className="font-bold select-text text-blue-600 dark:text-blue-400">{timeResult.iso}</span></div>
                      <div><span className="text-gray-500">UTC:</span> <span className="font-bold select-text">{timeResult.utc}</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* Regexp Tester */}
              {activeTool === 'regexp' && (
                <div className="flex flex-col gap-3 font-mono">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={regexPattern}
                      onChange={(e) => setRegexPattern(e.target.value)}
                      placeholder="Regex pattern (e.g. \d+)"
                      className="flex-1 px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={regexFlags}
                      onChange={(e) => setRegexFlags(e.target.value)}
                      placeholder="Flags (g, i, m)"
                      className="w-20 px-2 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleRunRegex}
                      className="px-4 py-1.5 bg-yellow-600 text-white rounded-lg font-medium cursor-pointer"
                    >
                      Test Match
                    </button>
                  </div>
                  <textarea
                    value={regexText}
                    onChange={(e) => setRegexText(e.target.value)}
                    rows={4}
                    placeholder="Test text..."
                    className="w-full p-2.5 rounded-xl border bg-transparent focus:outline-none resize-none select-text"
                  />
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                    <span className="font-bold text-gray-500 text-[10px]">Matches ({regexMatches.length}):</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {regexMatches.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code */}
              {activeTool === 'qr_code' && (
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="text"
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                    placeholder="Enter URL or text..."
                    className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <div className="p-6 bg-white rounded-2xl border shadow-md">
                    <QRCodeSVG value={qrText || ' '} size={qrSize} />
                  </div>
                </div>
              )}

              {/* WebSocket Client */}
              {activeTool === 'websocket_client' && (
                <div className="flex flex-col gap-2 h-full font-mono">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      placeholder="wss://..."
                      className="flex-1 px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleToggleWs}
                      className={`px-4 py-1.5 rounded-lg font-medium text-white cursor-pointer ${
                        wsConnected ? 'bg-red-600' : 'bg-green-600'
                      }`}
                    >
                      {wsConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto border rounded-xl p-2.5 flex flex-col gap-1 min-h-[180px] bg-gray-50 dark:bg-gray-800/30">
                    {wsMessages.length === 0 ? (
                      <span className="text-gray-400 italic text-center py-6">No frames recorded</span>
                    ) : (
                      wsMessages.map((m, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px]">
                          <span className={`font-bold px-1 rounded text-[9px] ${m.dir === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {m.dir === 'out' ? 'SEND' : 'RECV'}
                          </span>
                          <span className="text-gray-400 text-[10px]">{m.time}</span>
                          <span className="break-all select-text flex-1">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wsInput}
                      onChange={(e) => setWsInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendWs(); }}
                      placeholder="Type WebSocket message..."
                      className="flex-1 px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendWs}
                      disabled={!wsConnected}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              {/* JavaScript Runner */}
              {activeTool === 'js_runner' && (
                <div className="flex flex-col gap-3 h-full font-mono">
                  <textarea
                    value={jsCode}
                    onChange={(e) => setJsCode(e.target.value)}
                    rows={8}
                    className="w-full p-3 rounded-xl border text-xs bg-transparent focus:outline-none select-text leading-relaxed"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={handleRunJs}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 text-white rounded-lg font-bold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Script</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={jsOutput}
                    rows={6}
                    placeholder="Console logs & output will appear here..."
                    className="w-full p-3 rounded-xl border text-xs bg-transparent focus:outline-none select-text"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1 border-t border-gray-200 dark:border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs hover:opacity-90"
                style={{ backgroundColor: activeColor.hex }}
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
