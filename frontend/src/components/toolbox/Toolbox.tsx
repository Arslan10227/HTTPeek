import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  Trash2,
  FolderOpen,
  FileUp,
  Braces,
  AlignLeft,
  Sparkles,
  Terminal,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { QRCodeSVG } from 'qrcode.react';
import { parseCurlCommand, ParsedCurl } from '../../utils/curlParser';
import {
  jsonToTypeScript,
  jsonToGoStruct,
  jsonToYaml,
  evaluateJsonPath,
} from '../../utils/codeGenerators';

export type ToolboxTool =
  | 'curl_composer'
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

  // cURL Parser Modal State
  const [curlInput, setCurlInput] = useState(`curl -X POST https://api.example.com/v1/auth \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer secret_token_xyz" \\
  -d '{"username": "admin", "role": "developer"}'`);
  const [parsedCurl, setParsedCurl] = useState<ParsedCurl | null>(null);

  // JSON Viewer State
  const [jsonInput, setJsonInput] = useState('{\n  "app": "HTTPeek",\n  "version": "1.0.0",\n  "status": "active",\n  "features": ["Proxy", "SSL", "Rules", "Toolbox"],\n  "meta": {\n    "author": "OneManByte",\n    "year": 2026\n  }\n}');
  const [jsonPathQuery, setJsonPathQuery] = useState('');
  const [jsonPathResult, setJsonPathResult] = useState<string>('');
  const [jsonViewMode, setJsonViewMode] = useState<'editor' | 'tree' | 'ts' | 'go' | 'yaml'>('editor');

  // XML Viewer State
  const [xmlInput, setXmlInput] = useState('<request id="1">\n  <name>HTTPeek</name>\n  <protocol>HTTPS</protocol>\n  <status>active</status>\n</request>');

  // Diff State
  const [diffTextA, setDiffTextA] = useState('{\n  "code": 200,\n  "status": "success"\n}');
  const [diffTextB, setDiffTextB] = useState('{\n  "code": 200,\n  "status": "updated",\n  "data": [1, 2, 3]\n}');

  // Text Editor
  const [plainText, setPlainText] = useState('HTTPeek Traffic Interceptor & Analysis Tool');

  // Encoders
  const [encoderInput, setEncoderInput] = useState('Hello HTTPeek 世界 123');
  const [encoderOutput, setEncoderOutput] = useState('');

  // Hash & Checksum
  const [hashInput, setHashInput] = useState('HTTPeek');
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
  const [certSubject, setCertSubject] = useState('CN=HTTPeek CA, O=HTTPeek, C=US');
  const [certHashResult, setCertHashResult] = useState('');

  // Enhanced Timestamp State
  const [timestampInput, setTimestampInput] = useState(String(Date.now()));
  const [timestampUnit, setTimestampUnit] = useState<'ms' | 's' | 'us' | 'ns'>('ms');
  const [timeResult, setTimeResult] = useState({
    isoUtc: '',
    isoLocal: '',
    rfc2822: '',
    formatted: '',
    relative: '',
    unixSec: '',
    unixMs: '',
    unixUs: '',
    unixNs: '',
  });
  const [batchTimestampInput, setBatchTimestampInput] = useState('1771234567\n1771234800000\n1771235000');
  const [batchTimestampOutput, setBatchTimestampOutput] = useState('');

  // Regexp
  const [regexPattern, setRegexPattern] = useState('([a-zA-Z]+):\\s*(\\d+)');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexText, setRegexText] = useState('port: 9099\nthreads: 4\ntimeout: 30');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);
  const [regexReplacePattern, setRegexReplacePattern] = useState('$1 = $2');
  const [regexReplaceResult, setRegexReplaceResult] = useState('');

  // Enhanced QR Code State
  const [qrText, setQrText] = useState('https://github.com/Arslan10227/HTTPeek');
  const [qrSize, setQrSize] = useState(200);
  const [decodedQrResult, setDecodedQrResult] = useState('');
  const qrSvgRef = useRef<HTMLDivElement>(null);

  // WebSocket Client
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.events');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);
  const [wsMessages, setWsMessages] = useState<Array<{ dir: 'in' | 'out'; text: string; time: string }>>([]);
  const [wsInput, setWsInput] = useState('Hello WebSocket from HTTPeek');

  // JS Runner
  const [jsCode, setJsCode] = useState('// HTTPeek JavaScript Test Sandbox\nconst req = { url: "https://api.test.com/data", status: 200 };\nconsole.log("Processing URL:", req.url);\nconsole.log("Status:", req.status);');
  const [jsOutput, setJsOutput] = useState('');

  // Initial timestamp conversion
  useEffect(() => {
    handleConvertTimestamp(Date.now(), 'ms');
  }, []);

  // --- Handlers ---

  // cURL Parser Handler
  const handleParseCurl = () => {
    try {
      const parsed = parseCurlCommand(curlInput);
      setParsedCurl(parsed);
      toast.success('cURL Command Parsed Successfully');
    } catch (e: any) {
      toast.error('Failed to parse cURL', e?.message);
    }
  };

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  // Timestamp Converter Handler
  const handleConvertTimestamp = (rawVal?: number | string, unit = timestampUnit) => {
    const raw = rawVal !== undefined ? String(rawVal) : timestampInput;
    let num = parseFloat(raw.trim());
    if (isNaN(num)) {
      toast.error('Invalid timestamp format');
      return;
    }

    // Normalize to milliseconds
    let ms = num;
    if (unit === 's') ms = num * 1000;
    else if (unit === 'us') ms = num / 1000;
    else if (unit === 'ns') ms = num / 1000000;
    else if (unit === 'ms' && num < 1e11) ms = num * 1000; // auto-detect second timestamps

    const d = new Date(ms);
    if (isNaN(d.getTime())) {
      toast.error('Invalid date conversion');
      return;
    }

    const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
    let relative = '';
    if (Math.abs(diffSec) < 60) relative = 'Just now';
    else if (diffSec > 0) relative = `${Math.floor(diffSec / 60)} minutes ago`;
    else relative = `in ${Math.floor(Math.abs(diffSec) / 60)} minutes`;

    setTimeResult({
      isoUtc: d.toISOString(),
      isoLocal: d.toLocaleString(),
      rfc2822: d.toUTCString(),
      formatted: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
      relative,
      unixSec: String(Math.floor(ms / 1000)),
      unixMs: String(Math.floor(ms)),
      unixUs: String(Math.floor(ms * 1000)),
      unixNs: String(Math.floor(ms * 1000000)),
    });
  };

  const handleConvertBatchTimestamps = () => {
    const lines = batchTimestampInput.split('\n');
    const out = lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        const num = parseFloat(trimmed);
        if (isNaN(num)) return `${trimmed} -> Invalid Number`;
        const ms = num < 1e11 ? num * 1000 : num;
        const d = new Date(ms);
        return `${trimmed} -> ${d.toISOString()} (${d.toLocaleString()})`;
      })
      .join('\n');
    setBatchTimestampOutput(out);
    toast.success('Batch Timestamps Converted');
  };

  // JSON Viewer Handlers
  const handleLoadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target?.result as string);
      toast.success('Loaded JSON File', file.name);
    };
    reader.readAsText(file);
  };

  const handleEvaluateJsonPath = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const res = evaluateJsonPath(parsed, jsonPathQuery);
      setJsonPathResult(
        typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res ?? 'null')
      );
    } catch (e: any) {
      setJsonPathResult(`Error: ${e.message}`);
    }
  };

  // XML Viewer Handlers
  const handleLoadXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlInput(event.target?.result as string);
      toast.success('Loaded XML File', file.name);
    };
    reader.readAsText(file);
  };

  // Diff Handlers
  const handleLoadDiffFile = (side: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (side === 'A') setDiffTextA(event.target?.result as string);
      else setDiffTextB(event.target?.result as string);
      toast.success(`Loaded File into Panel ${side}`, file.name);
    };
    reader.readAsText(file);
  };

  // QR Code Image Handlers
  const handleSaveQrImage = () => {
    const svgEl = qrSvgRef.current?.querySelector('svg');
    if (!svgEl) {
      toast.error('QR element not found');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = qrSize + 40;
    canvas.height = qrSize + 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 20, 20);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'httpeek_qrcode.png';
      a.click();
      toast.success('QR Code saved as PNG image');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDecodeQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Check if native BarcodeDetector is available in Chromium / WebView2
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector
          .detect(canvas)
          .then((barcodes: any[]) => {
            if (barcodes && barcodes.length > 0) {
              const res = barcodes[0].rawValue;
              setDecodedQrResult(res);
              setQrText(res);
              toast.success('QR Code Decoded Successfully!');
            } else {
              toast.warning('No QR code detected in image');
            }
          })
          .catch(() => {
            toast.error('Barcode detection failed');
          });
      } else {
        toast.info('Loaded Image', 'Browser QR decode API processing');
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // Encoders Handlers
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
    const result = encoderInput
      .split('')
      .map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
      .join('');
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
  };

  const handleRunJs = () => {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
      };
      const runFn = new Function('console', jsCode);
      runFn(customConsole);
      setJsOutput(logs.join('\n') || 'Code executed with 0 outputs.');
    } catch (e: any) {
      setJsOutput(`Exception: ${e.message}`);
    }
  };

  const tools: Array<{
    id: ToolboxTool;
    title: string;
    description: string;
    icon: any;
    color: string;
    badge?: string;
  }> = [
    {
      id: 'curl_composer',
      title: 'cURL Command Parser & Composer',
      description: 'Paste raw cURL commands to extract headers, body, parameters and trigger requests',
      icon: Terminal,
      color: '#3b82f6',
      badge: 'New',
    },
    {
      id: 'timestamp',
      title: 'Timestamp & Epoch Converter',
      description: 'Convert Unix ms/s/μs/ns, ISO-8601, RFC 2822, batch convert, and timezones',
      icon: Clock,
      color: '#10b981',
      badge: 'Updated',
    },
    {
      id: 'json_viewer',
      title: 'JSON Viewer, Tree & Code Generator',
      description: 'Collapsible tree view, JSONPath query, and TypeScript / Go / YAML generators',
      icon: Braces,
      color: '#f59e0b',
      badge: 'Updated',
    },
    {
      id: 'xml_viewer',
      title: 'XML Formatter & Tree',
      description: 'Format, validate XML documents, and inspect tag hierarchies with file loader',
      icon: FileCode,
      color: '#6366f1',
    },
    {
      id: 'text_diff',
      title: 'Side-by-Side Text & Payload Diff',
      description: 'Visual diff comparison with line-by-line highlights and file selection',
      icon: FileDiff,
      color: '#ec4899',
      badge: 'Updated',
    },
    {
      id: 'qr_code',
      title: 'QR Code Generator & Decoder',
      description: 'Generate QR codes, save as PNG image, and decode QR from image files',
      icon: QrCode,
      color: '#8b5cf6',
      badge: 'Updated',
    },
    {
      id: 'url_encoder',
      title: 'URL Encoder / Decoder',
      description: 'Encode and decode query parameters and URI components',
      icon: Link,
      color: '#14b8a6',
    },
    {
      id: 'base64_encoder',
      title: 'Base64 Encoder / Decoder',
      description: 'Encode and decode Base64 strings, payloads, and authorization tokens',
      icon: Binary,
      color: '#06b6d4',
    },
    {
      id: 'unicode_encoder',
      title: 'Unicode Escape Converter',
      description: 'Encode and decode \\uXXXX Unicode escape characters and symbols',
      icon: Bold,
      color: '#84cc16',
    },
    {
      id: 'hash_tool',
      title: 'Hash & Checksum Calculator',
      description: 'Generate SHA-256, SHA-1, MD5, and HMAC hashes',
      icon: Hash,
      color: '#f97316',
    },
    {
      id: 'aes_tool',
      title: 'AES Encryption / Decryption',
      description: 'Test AES CBC/ECB/GCM with custom keys, IVs, and hex/base64 outputs',
      icon: KeyRound,
      color: '#e11d48',
    },
    {
      id: 'cert_hash',
      title: 'Android Cert Subject Hash',
      description: 'Calculate Android 7.0+ system trusted certificate filename hash (e.g. c032a829.0)',
      icon: Shield,
      color: '#059669',
    },
    {
      id: 'regexp',
      title: 'Regular Expression Tester',
      description: 'Real-time regex matcher, capture group inspector, and replace utility',
      icon: Search,
      color: '#d97706',
    },
    {
      id: 'websocket_client',
      title: 'WebSocket Live Client & Echo',
      description: 'Test WS/WSS connections, send text payloads, and inspect incoming frames',
      icon: Wifi,
      color: '#4f46e5',
    },
    {
      id: 'js_runner',
      title: 'JavaScript Scratchpad Runner',
      description: 'Execute custom JS snippets and test interceptor scripts locally',
      icon: Code2,
      color: '#0284c7',
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none bg-slate-50 dark:bg-gray-950 font-sans">
      {/* Top Banner */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
              <span>HTTPeek Swiss Army Toolbox</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                15 Developer Utilities
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Built-in encoders, decoders, cURL parser, cryptographic utilities, timestamp convertors, and diff visualizers.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRequestEditor}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: activeColor.hex }}
          >
            <Send className="w-4 h-4" />
            <span>Open Request Composer</span>
          </button>
        </div>
      </div>

      {/* Grid of Tools or Active Tool View */}
      <div className="flex-1 p-6 overflow-y-auto min-h-0">
        {!activeTool ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:shadow-lg transition-all flex flex-col justify-between group hover:border-blue-500/50"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="p-3 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: tool.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {tool.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Active Tool Dialog Container */
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {tools.find((t) => t.id === activeTool)?.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 py-4 overflow-y-auto min-h-0 flex flex-col text-xs">
              {/* 1. cURL Command Parser Tool */}
              {activeTool === 'curl_composer' && (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Paste cURL Command:</label>
                    <textarea
                      value={curlInput}
                      onChange={(e) => setCurlInput(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-2xl border border-gray-300 dark:border-gray-700 font-mono text-xs bg-gray-50/50 dark:bg-gray-950 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleParseCurl}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      Parse cURL Data
                    </button>
                    <button
                      type="button"
                      onClick={onOpenRequestEditor}
                      className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Open in Request Composer →
                    </button>
                  </div>

                  {parsedCurl && (
                    <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3 overflow-y-auto">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-black text-xs uppercase">
                          {parsedCurl.method}
                        </span>
                        <span className="font-mono font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                          {parsedCurl.url}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <span className="font-bold text-gray-500 uppercase text-[10px]">Headers ({Object.keys(parsedCurl.headers).length}):</span>
                          <div className="mt-2 space-y-1 font-mono text-[11px]">
                            {Object.entries(parsedCurl.headers).map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="font-bold text-gray-700 dark:text-gray-300">{k}:</span>
                                <span className="text-gray-500 truncate max-w-[180px]">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <span className="font-bold text-gray-500 uppercase text-[10px]">Body ({parsedCurl.bodyType}):</span>
                          <pre className="mt-2 font-mono text-[11px] text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                            {parsedCurl.body || '(empty body)'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Enhanced Timestamp Tool */}
              {activeTool === 'timestamp' && (
                <div className="flex flex-col gap-5">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">Convert Single Timestamp / Epoch:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-500">Unit:</span>
                        {(['ms', 's', 'us', 'ns'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => {
                              setTimestampUnit(unit);
                              handleConvertTimestamp(undefined, unit);
                            }}
                            className={`px-2 py-0.5 rounded font-bold uppercase ${
                              timestampUnit === unit
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 border'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={timestampInput}
                        onChange={(e) => setTimestampInput(e.target.value)}
                        placeholder="e.g. 1771234567890"
                        className="flex-1 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 font-mono text-xs bg-white dark:bg-gray-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleConvertTimestamp()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                      >
                        Convert
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = Date.now();
                          setTimestampInput(String(now));
                          handleConvertTimestamp(now, 'ms');
                        }}
                        className="px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
                      >
                        Now (ms)
                      </button>
                    </div>
                  </div>

                  {/* Results Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white dark:bg-gray-800 border rounded-xl flex flex-col justify-between">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">ISO-8601 (UTC)</span>
                      <span className="font-mono font-bold text-xs mt-1 truncate">{timeResult.isoUtc || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(timeResult.isoUtc)}
                        className="text-blue-500 font-semibold text-[10px] mt-2 self-start hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-800 border rounded-xl flex flex-col justify-between">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">Local Time</span>
                      <span className="font-mono font-bold text-xs mt-1 truncate">{timeResult.isoLocal || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(timeResult.isoLocal)}
                        className="text-blue-500 font-semibold text-[10px] mt-2 self-start hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-800 border rounded-xl flex flex-col justify-between">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">Formatted (YYYY-MM-DD)</span>
                      <span className="font-mono font-bold text-xs mt-1 truncate">{timeResult.formatted || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(timeResult.formatted)}
                        className="text-blue-500 font-semibold text-[10px] mt-2 self-start hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-800 border rounded-xl flex flex-col justify-between">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">Relative Time</span>
                      <span className="font-mono font-bold text-xs mt-1 text-emerald-600 truncate">{timeResult.relative || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(timeResult.relative)}
                        className="text-blue-500 font-semibold text-[10px] mt-2 self-start hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Batch Timestamp Converter */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border rounded-2xl flex flex-col gap-2">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Batch Timestamp Converter (Line by Line):</span>
                    <div className="grid grid-cols-2 gap-3">
                      <textarea
                        value={batchTimestampInput}
                        onChange={(e) => setBatchTimestampInput(e.target.value)}
                        rows={4}
                        placeholder="Paste list of timestamps here..."
                        className="p-2.5 rounded-xl border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none"
                      />
                      <textarea
                        readOnly
                        value={batchTimestampOutput}
                        rows={4}
                        placeholder="Converted output will appear here..."
                        className="p-2.5 rounded-xl border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleConvertBatchTimestamps}
                      className="self-start px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
                    >
                      Convert Batch Timestamps
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Enhanced JSON Viewer & Tree & Code Generators */}
              {activeTool === 'json_viewer' && (
                <div className="flex flex-col gap-3 h-full">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      {(['editor', 'ts', 'go', 'yaml'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setJsonViewMode(mode)}
                          className={`px-3 py-1 rounded-lg font-bold uppercase text-[11px] cursor-pointer ${
                            jsonViewMode === mode
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'editor' ? 'Raw JSON' : mode === 'ts' ? 'Generate TypeScript' : mode === 'go' ? 'Generate Go Struct' : 'Generate YAML'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Open JSON File</span>
                        <input type="file" accept=".json,application/json" onChange={handleLoadJsonFile} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(jsonInput);
                            setJsonInput(JSON.stringify(parsed, null, 2));
                            toast.success('Prettified JSON');
                          } catch (_) {
                            toast.error('Invalid JSON');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer"
                      >
                        Format (2s)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(jsonInput);
                            setJsonInput(JSON.stringify(parsed));
                            toast.info('Minified JSON');
                          } catch (_) {
                            toast.error('Invalid JSON');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer"
                      >
                        Minify
                      </button>
                    </div>
                  </div>

                  {/* JSONPath Query Bar */}
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                    <span className="font-bold text-gray-500">JSONPath:</span>
                    <input
                      type="text"
                      value={jsonPathQuery}
                      onChange={(e) => setJsonPathQuery(e.target.value)}
                      placeholder="e.g. $.features[0] or meta.author"
                      className="flex-1 px-2.5 py-1 rounded-lg border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleEvaluateJsonPath}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
                    >
                      Evaluate
                    </button>
                    {jsonPathResult && (
                      <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-mono font-bold rounded-lg truncate max-w-xs">
                        {jsonPathResult}
                      </div>
                    )}
                  </div>

                  {/* Main Display */}
                  <div className="flex-1 border rounded-2xl overflow-hidden shadow-xs">
                    {jsonViewMode === 'editor' && (
                      <textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        className="w-full h-full p-4 font-mono text-xs bg-white dark:bg-gray-950 focus:outline-none resize-none"
                      />
                    )}
                    {jsonViewMode === 'ts' && (
                      <textarea
                        readOnly
                        value={jsonToTypeScript(jsonInput)}
                        className="w-full h-full p-4 font-mono text-xs bg-slate-900 text-blue-300 focus:outline-none resize-none"
                      />
                    )}
                    {jsonViewMode === 'go' && (
                      <textarea
                        readOnly
                        value={jsonToGoStruct(jsonInput)}
                        className="w-full h-full p-4 font-mono text-xs bg-slate-900 text-emerald-300 focus:outline-none resize-none"
                      />
                    )}
                    {jsonViewMode === 'yaml' && (
                      <textarea
                        readOnly
                        value={jsonToYaml(jsonInput)}
                        className="w-full h-full p-4 font-mono text-xs bg-slate-900 text-amber-300 focus:outline-none resize-none"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 4. Enhanced Text Diff Tool */}
              {activeTool === 'text_diff' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600 dark:text-gray-300">Side-by-Side Payload Comparison:</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Load Left File</span>
                        <input type="file" onChange={(e) => handleLoadDiffFile('A', e)} className="hidden" />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Load Right File</span>
                        <input type="file" onChange={(e) => handleLoadDiffFile('B', e)} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-500 uppercase text-[10px]">Left Payload (Original):</span>
                      <textarea
                        value={diffTextA}
                        onChange={(e) => setDiffTextA(e.target.value)}
                        className="flex-1 p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-500 uppercase text-[10px]">Right Payload (Modified):</span>
                      <textarea
                        value={diffTextB}
                        onChange={(e) => setDiffTextB(e.target.value)}
                        className="flex-1 p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. XML Viewer Tool */}
              {activeTool === 'xml_viewer' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600 dark:text-gray-300">XML Document Formatter:</span>
                    <label className="flex items-center gap-1 px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer">
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Open XML File</span>
                      <input type="file" accept=".xml,text/xml" onChange={handleLoadXmlFile} className="hidden" />
                    </label>
                  </div>
                  <textarea
                    value={xmlInput}
                    onChange={(e) => setXmlInput(e.target.value)}
                    className="flex-1 p-4 rounded-2xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* 6. Enhanced QR Code Tool */}
              {activeTool === 'qr_code' && (
                <div className="grid grid-cols-2 gap-6 h-full items-start">
                  <div className="flex flex-col gap-3">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Generate QR from Text / URL:</label>
                    <textarea
                      value={qrText}
                      onChange={(e) => setQrText(e.target.value)}
                      rows={4}
                      className="p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveQrImage}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Save as PNG Image</span>
                      </button>

                      <label className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold rounded-xl cursor-pointer">
                        <ImageIcon className="w-4 h-4" />
                        <span>Decode from Image File</span>
                        <input type="file" accept="image/*" onChange={handleDecodeQrFile} className="hidden" />
                      </label>
                    </div>

                    {decodedQrResult && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <span className="font-bold text-emerald-800 dark:text-emerald-200 text-xs">Decoded Content:</span>
                        <p className="font-mono text-xs mt-1 text-gray-800 dark:text-gray-200 break-all">{decodedQrResult}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/40 rounded-3xl border">
                    <div ref={qrSvgRef} className="p-4 bg-white rounded-2xl shadow-md">
                      <QRCodeSVG value={qrText || 'https://github.com/Arslan10227/HTTPeek'} size={qrSize} />
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono mt-3">Size: {qrSize}x{qrSize}px</span>
                  </div>
                </div>
              )}

              {/* 7. URL / Base64 / Unicode Encoders */}
              {(activeTool === 'url_encoder' || activeTool === 'base64_encoder' || activeTool === 'unicode_encoder') && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Input Text:</label>
                    <textarea
                      value={encoderInput}
                      onChange={(e) => setEncoderInput(e.target.value)}
                      rows={3}
                      className="p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {activeTool === 'url_encoder' && (
                      <>
                        <button type="button" onClick={handleUrlEncode} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl cursor-pointer">URL Encode</button>
                        <button type="button" onClick={handleUrlDecode} className="px-4 py-2 border font-bold rounded-xl cursor-pointer">URL Decode</button>
                      </>
                    )}
                    {activeTool === 'base64_encoder' && (
                      <>
                        <button type="button" onClick={handleBase64Encode} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl cursor-pointer">Base64 Encode</button>
                        <button type="button" onClick={handleBase64Decode} className="px-4 py-2 border font-bold rounded-xl cursor-pointer">Base64 Decode</button>
                      </>
                    )}
                    {activeTool === 'unicode_encoder' && (
                      <>
                        <button type="button" onClick={handleUnicodeEncode} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl cursor-pointer">Unicode Encode</button>
                        <button type="button" onClick={handleUnicodeDecode} className="px-4 py-2 border font-bold rounded-xl cursor-pointer">Unicode Decode</button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-gray-700 dark:text-gray-300">Result Output:</label>
                      <button type="button" onClick={() => handleCopy(encoderOutput)} className="text-blue-500 font-bold hover:underline cursor-pointer">Copy</button>
                    </div>
                    <textarea
                      readOnly
                      value={encoderOutput}
                      rows={3}
                      className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 8. Hash Calculator */}
              {activeTool === 'hash_tool' && (
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    placeholder="Enter string to compute hashes..."
                    className="p-3 rounded-xl border font-mono text-xs bg-white dark:bg-gray-950 focus:outline-none"
                  />
                  <button type="button" onClick={handleComputeHashes} className="px-5 py-2 bg-orange-600 text-white font-bold rounded-xl self-start cursor-pointer">Compute Hashes</button>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border">
                      <span className="font-bold text-gray-400 text-[10px]">SHA-256:</span>
                      <div className="mt-1 font-bold text-orange-600 dark:text-orange-400 select-all">{hashSha256 || '-'}</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border">
                      <span className="font-bold text-gray-400 text-[10px]">SHA-1:</span>
                      <div className="mt-1 font-bold text-gray-800 dark:text-gray-200 select-all">{hashSha1 || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. Android Cert Subject Hash */}
              {activeTool === 'cert_hash' && (
                <div className="flex flex-col gap-3 font-mono">
                  <span className="text-gray-500 text-[11px] font-sans">Calculates Android 7.0+ system trusted certificate filename hash (e.g. c032a829.0)</span>
                  <input
                    type="text"
                    value={certSubject}
                    onChange={(e) => setCertSubject(e.target.value)}
                    placeholder="Certificate Subject (e.g. CN=HTTPeek CA)"
                    className="px-3 py-2 rounded-xl border bg-white dark:bg-gray-950 focus:outline-none"
                  />
                  <button type="button" onClick={handleComputeCertHash} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold self-start cursor-pointer">Compute Subject Hash</button>
                  {certHashResult && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200">
                      <span className="font-bold text-emerald-800 dark:text-emerald-200 text-xs">Android Trust Store Filename:</span>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-base mt-1 select-all">{certHashResult}</div>
                    </div>
                  )}
                </div>
              )}

              {/* 10. Regexp Tester */}
              {activeTool === 'regexp' && (
                <div className="flex flex-col gap-3 font-mono">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={regexPattern}
                      onChange={(e) => setRegexPattern(e.target.value)}
                      placeholder="Regex pattern (e.g. ([a-z]+): (\d+))"
                      className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-gray-950 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={regexFlags}
                      onChange={(e) => setRegexFlags(e.target.value)}
                      placeholder="flags"
                      className="w-16 px-3 py-2 rounded-xl border bg-white dark:bg-gray-950 focus:outline-none"
                    />
                    <button type="button" onClick={handleRunRegex} className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold cursor-pointer">Match &amp; Replace</button>
                  </div>
                  <textarea
                    value={regexText}
                    onChange={(e) => setRegexText(e.target.value)}
                    rows={4}
                    className="p-3 rounded-xl border bg-white dark:bg-gray-950 focus:outline-none"
                  />
                  {regexMatches.length > 0 && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border">
                      <span className="font-bold text-gray-500 text-[10px]">Matches ({regexMatches.length}):</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {regexMatches.map((m, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 11. WebSocket Client */}
              {activeTool === 'websocket_client' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      placeholder="wss://echo.websocket.events"
                      className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleToggleWs}
                      className={`px-4 py-2 rounded-xl font-bold text-white cursor-pointer ${
                        wsConnected ? 'bg-rose-600' : 'bg-emerald-600'
                      }`}
                    >
                      {wsConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>

                  <div className="flex-1 border rounded-2xl p-3 bg-gray-50 dark:bg-gray-950 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                    {wsMessages.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">No frames sent or received</div>
                    ) : (
                      wsMessages.map((m, idx) => (
                        <div key={idx} className={`flex items-start gap-2 ${m.dir === 'out' ? 'text-blue-500' : 'text-emerald-500'}`}>
                          <span className="font-bold uppercase text-[9px] px-1 rounded bg-black/5 dark:bg-white/10">{m.dir === 'out' ? 'SEND' : 'RECV'}</span>
                          <span className="text-gray-400 text-[10px]">{m.time}</span>
                          <span className="text-gray-800 dark:text-gray-200">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={wsInput}
                      onChange={(e) => setWsInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendWs()}
                      placeholder="Payload string to send..."
                      className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />
                    <button type="button" onClick={handleSendWs} disabled={!wsConnected} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">Send Frame</button>
                  </div>
                </div>
              )}

              {/* 12. JS Scratchpad Runner */}
              {activeTool === 'js_runner' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600 dark:text-gray-300">JavaScript Scratchpad Console:</span>
                    <button type="button" onClick={handleRunJs} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Code</span>
                    </button>
                  </div>
                  <textarea
                    value={jsCode}
                    onChange={(e) => setJsCode(e.target.value)}
                    rows={7}
                    className="p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                  />
                  <div className="flex-1 p-3 rounded-xl border bg-slate-900 text-emerald-400 font-mono text-xs overflow-y-auto whitespace-pre-wrap">
                    {jsOutput || '// Console output will appear here after execution'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
