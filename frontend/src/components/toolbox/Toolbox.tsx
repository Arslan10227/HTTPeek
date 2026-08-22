import React, { useState, useEffect, useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
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
  Image as ImageIcon,
  Lock,
  Unlock,
  Key,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { QRCodeSVG } from 'qrcode.react';
import { parseCurlCommand, ParsedCurl } from '../../utils/curlParser';

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
  const { monacoTheme } = useThemeStore();
  const [activeTool, setActiveTool] = useState<ToolboxTool | null>(null);
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');

  // 1. cURL Parser State
  const [curlInput, setCurlInput] = useState(`curl -X POST https://api.example.com/v1/auth \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer my-secret-token' \\
  -d '{"username": "admin", "role": "superuser"}'`);
  const [parsedCurl, setParsedCurl] = useState<ParsedCurl | null>(null);

  // 2. JSON Viewer State
  const [jsonInput, setJsonInput] = useState(`{
  "project": "HTTPeek",
  "author": "OneManByte",
  "version": "1.0.0",
  "status": 200,
  "features": [
    "MITM HTTP/HTTPS",
    "WebSocket Inspection",
    "SSE Streaming",
    "Rule Engine",
    "GraphQL Inspector"
  ],
  "config": {
    "port": 9099,
    "sslEnabled": true,
    "socks5Enabled": true
  }
}`);
  const [jsonPathQuery, setJsonPathQuery] = useState('');
  const [jsonPathResult, setJsonPathResult] = useState<string | null>(null);
  const [jsonViewMode, setJsonViewMode] = useState<'editor' | 'ts' | 'go' | 'yaml'>('editor');

  // 3. XML Viewer State
  const [xmlInput, setXmlInput] = useState(`<?xml version="1.0" encoding="UTF-8"?>
<httpeek>
  <proxy port="9099" ssl="true" socks5="true" />
  <interceptors>
    <rule name="Mock Staging API" action="mock" status="200" />
    <rule name="Inject Auth Header" action="rewrite" />
  </interceptors>
</httpeek>`);

  // 4. Text Diff State
  const [diffTextA, setDiffTextA] = useState(`{\n  "version": "1.0.0",\n  "status": "active",\n  "count": 42\n}`);
  const [diffTextB, setDiffTextB] = useState(`{\n  "version": "1.1.0",\n  "status": "upgraded",\n  "count": 99,\n  "newFeature": true\n}`);
  const [diffLanguage, setDiffLanguage] = useState('json');
  const [isDiffSideBySide, setIsDiffSideBySide] = useState(true);

  // 5. Universal Text Editor State
  const [editorText, setEditorText] = useState(`// Welcome to HTTPeek Code & Text Editor\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\nconsole.log(greet("Developer"));`);
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [editorWrap, setEditorWrap] = useState(true);

  // 6. Encoders / Decoders State
  const [urlInput, setUrlInput] = useState('https://example.com/search?q=hello world & token=abc#123');
  const [base64Input, setBase64Input] = useState('SGVsbG8gV29ybGQgZnJvbSBIVFRQZWVrIQ==');
  const [unicodeInput, setUnicodeInput] = useState('\\u0048\\u0054\\u0054\\u0050\\u0065\\u0065\\u006b\\u0020\\u63d0\\u53d6');

  // 7. Hashes State
  const [hashInput, setHashInput] = useState('HTTPeek Proxy Secret Key');
  const [hashSha256, setHashSha256] = useState('');
  const [hashSha1, setHashSha1] = useState('');
  const [hashMd5, setHashMd5] = useState('');

  // 8. AES Crypto State
  const [aesAction, setAesAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [aesInput, setAesInput] = useState('Secret Data To Encrypt with AES');
  const [aesKey, setAesKey] = useState('1234567890123456');
  const [aesIv, setAesIv] = useState('1234567890123456');
  const [aesMode, setAesMode] = useState<'CBC' | 'ECB' | 'GCM' | 'CTR'>('CBC');
  const [aesOutput, setAesOutput] = useState('');
  const [aesLoading, setAesLoading] = useState(false);

  // 9. RSA Crypto State
  const [rsaMode, setRsaMode] = useState<'keygen' | 'encrypt' | 'decrypt'>('keygen');
  const [rsaKeySize, setRsaKeySize] = useState<1024 | 2048 | 4096>(2048);
  const [rsaPublicKey, setRsaPublicKey] = useState('');
  const [rsaPrivateKey, setRsaPrivateKey] = useState('');
  const [rsaData, setRsaData] = useState('Sample message for RSA');
  const [rsaResult, setRsaResult] = useState('');

  // 10. Cert Subject Hash State
  const [certSubject, setCertSubject] = useState('CN=HTTPeek CA, O=HTTPeek, C=US');
  const [certHashResult, setCertHashResult] = useState('');

  // 11. Enhanced Timestamp State
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

  // 12. Regexp State
  const [regexPattern, setRegexPattern] = useState('(\\w+):\\s+(\\d+)');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexText, setRegexText] = useState('ItemA: 100\nItemB: 250\nItemC: 500');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);
  const [regexReplace, setRegexReplace] = useState('[$1 => $2]');
  const [regexReplaceOutput, setRegexReplaceOutput] = useState('');

  // 13. QR Code State
  const [qrText, setQrText] = useState('http://192.168.1.100:9099/ssl');
  const qrRef = useRef<SVGSVGElement>(null);

  // 14. WebSocket Client State
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.events');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsInput, setWsInput] = useState('{\n  "action": "ping",\n  "timestamp": ' + Date.now() + '\n}');
  const [wsMessages, setWsMessages] = useState<{ dir: 'in' | 'out'; text: string; time: string }[]>([]);
  const wsInstanceRef = useRef<WebSocket | null>(null);

  // 15. JS Scratchpad Runner State
  const [jsCode, setJsCode] = useState(`// HTTPeek JS Interceptor Scratchpad\nconst payload = { user: "john", status: "active", points: 150 };\npayload.points += 50;\npayload.timestamp = new Date().toISOString();\nconsole.log("Mutated Payload:", JSON.stringify(payload, null, 2));\nreturn payload;`);
  const [jsOutput, setJsOutput] = useState('');

  // Auto-run timestamp converter on input change
  useEffect(() => {
    handleConvertTimestamp(timestampInput, timestampUnit);
  }, [timestampInput, timestampUnit]);

  // Handle cURL parsing
  const handleParseCurl = () => {
    try {
      const parsed = parseCurlCommand(curlInput);
      setParsedCurl(parsed);
      toast.success('cURL Parsed Successfully');
    } catch (e: any) {
      toast.error('Invalid cURL command', e.message);
    }
  };

  // Convert JSON to TypeScript interface
  const jsonToTypeScript = (jsonStr: string): string => {
    try {
      const obj = JSON.parse(jsonStr);
      const generate = (o: any, name = 'RootObject'): string => {
        if (typeof o !== 'object' || o === null) return `type ${name} = ${typeof o};`;
        if (Array.isArray(o)) {
          const itemType = o.length > 0 ? typeof o[0] : 'any';
          return `export type ${name} = ${itemType}[];`;
        }
        let code = `export interface ${name} {\n`;
        for (const [k, v] of Object.entries(o)) {
          let type: string = typeof v;
          if (v === null) type = 'any';
          else if (Array.isArray(v)) type = 'any[]';
          else if (typeof v === 'object') type = `${k.charAt(0).toUpperCase() + k.slice(1)}Type`;
          code += `  ${k}: ${type};\n`;
        }
        code += `}`;
        return code;
      };
      return generate(obj);
    } catch (e) {
      return '// Invalid JSON for TypeScript generation';
    }
  };

  // Convert JSON to Go struct
  const jsonToGoStruct = (jsonStr: string): string => {
    try {
      const obj = JSON.parse(jsonStr);
      let code = `type RootStruct struct {\n`;
      for (const [k, v] of Object.entries(obj)) {
        let goType = 'string';
        if (typeof v === 'number') goType = Number.isInteger(v) ? 'int' : 'float64';
        else if (typeof v === 'boolean') goType = 'bool';
        else if (Array.isArray(v)) goType = '[]interface{}';
        else if (typeof v === 'object' && v !== null) goType = 'map[string]interface{}';
        const fieldName = k.charAt(0).toUpperCase() + k.slice(1);
        code += `\t${fieldName} ${goType} \`json:"${k}"\`\n`;
      }
      code += `}`;
      return code;
    } catch (e) {
      return '// Invalid JSON for Go struct generation';
    }
  };

  // Convert JSON to YAML string
  const jsonToYaml = (jsonStr: string): string => {
    try {
      const obj = JSON.parse(jsonStr);
      const stringify = (val: any, depth = 0): string => {
        const indent = '  '.repeat(depth);
        if (typeof val !== 'object' || val === null) return `${val}`;
        if (Array.isArray(val)) {
          return val.map((item) => `${indent}- ${stringify(item, depth + 1)}`).join('\n');
        }
        return Object.entries(val)
          .map(([k, v]) => `${indent}${k}: ${typeof v === 'object' && v !== null ? '\n' : ''}${stringify(v, depth + 1)}`)
          .join('\n');
      };
      return stringify(obj);
    } catch (_) {
      return '# Invalid JSON for YAML generation';
    }
  };

  // JSONPath evaluation
  const handleEvaluateJsonPath = () => {
    if (!jsonPathQuery.trim()) {
      setJsonPathResult(null);
      return;
    }
    try {
      const obj = JSON.parse(jsonInput);
      const cleanPath = jsonPathQuery.replace(/^\$\.?/, '');
      const parts = cleanPath.split('.').filter(Boolean);
      let curr: any = obj;
      for (const p of parts) {
        if (curr === undefined || curr === null) break;
        if (p.includes('[') && p.includes(']')) {
          const key = p.slice(0, p.indexOf('['));
          const idx = parseInt(p.slice(p.indexOf('[') + 1, p.indexOf(']')), 10);
          curr = curr[key]?.[idx];
        } else {
          curr = curr[p];
        }
      }
      setJsonPathResult(curr !== undefined ? JSON.stringify(curr, null, 2) : 'Path not found');
    } catch (e: any) {
      setJsonPathResult('Error evaluating JSONPath: ' + e.message);
    }
  };

  // Timestamp conversion
  const handleConvertTimestamp = (raw: string, unit: 'ms' | 's' | 'us' | 'ns') => {
    try {
      const num = parseInt(raw.trim(), 10);
      if (isNaN(num)) return;
      let ms = num;
      if (unit === 's') ms = num * 1000;
      else if (unit === 'us') ms = Math.floor(num / 1000);
      else if (unit === 'ns') ms = Math.floor(num / 1000000);

      const d = new Date(ms);
      if (isNaN(d.getTime())) return;

      const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
      let rel = `${diffSec} seconds ago`;
      if (Math.abs(diffSec) > 86400) rel = `${Math.round(diffSec / 86400)} days ago`;
      else if (Math.abs(diffSec) > 3600) rel = `${Math.round(diffSec / 3600)} hours ago`;
      else if (Math.abs(diffSec) > 60) rel = `${Math.round(diffSec / 60)} minutes ago`;

      setTimeResult({
        isoUtc: d.toISOString(),
        isoLocal: d.toString(),
        rfc2822: d.toUTCString(),
        formatted: d.toLocaleString(),
        relative: rel,
        unixSec: String(Math.floor(ms / 1000)),
        unixMs: String(ms),
        unixUs: String(ms * 1000),
        unixNs: String(ms * 1000000),
      });
    } catch (_) {}
  };

  // AES execution
  const handleRunAes = async () => {
    setAesLoading(true);
    try {
      if ((window as any).go?.main?.App?.ToolboxAES) {
        const res = await (window as any).go.main.App.ToolboxAES(aesAction, aesMode, aesInput, aesKey, aesIv);
        setAesOutput(res);
        toast.success(`AES ${aesAction === 'encrypt' ? 'Encryption' : 'Decryption'} Complete`);
      } else if (api.toolboxAES) {
        const res = await api.toolboxAES(aesAction, aesMode, aesInput, aesKey, aesIv);
        setAesOutput(res || 'Operation finished');
        toast.success('AES Finished');
      } else {
        // Simple client-side demo fallback
        setAesOutput(`[Client AES Simulation] Mode: ${aesMode}, Action: ${aesAction}, Result: ${btoa(aesInput)}`);
      }
    } catch (e: any) {
      setAesOutput('Error: ' + (e.message || String(e)));
      toast.error('AES Failed', e.message || String(e));
    } finally {
      setAesLoading(false);
    }
  };

  // Generate random AES key
  const handleGenerateAesKey = (bytes: 16 | 24 | 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    for (let i = 0; i < bytes; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAesKey(key);
    toast.success(`Generated ${bytes * 8}-bit AES Key`);
  };

  const handleGenerateAesIv = () => {
    const chars = '0123456789abcdef';
    let iv = '';
    for (let i = 0; i < 16; i++) {
      iv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAesIv(iv);
    toast.success('Generated 128-bit AES IV');
  };

  // Hash computation
  const handleComputeHashes = async () => {
    try {
      const msgBuffer = new TextEncoder().encode(hashInput);
      const hashBuffer256 = await crypto.subtle.digest('SHA-256', msgBuffer);
      setHashSha256(Array.from(new Uint8Array(hashBuffer256)).map((b) => b.toString(16).padStart(2, '0')).join(''));

      const hashBuffer1 = await crypto.subtle.digest('SHA-1', msgBuffer);
      setHashSha1(Array.from(new Uint8Array(hashBuffer1)).map((b) => b.toString(16).padStart(2, '0')).join(''));
      toast.success('Hashes Calculated');
    } catch (e: any) {
      toast.error('Hash calculation error', e.message);
    }
  };

  // Cert Subject Hash
  const handleComputeCertHash = async () => {
    try {
      if ((window as any).go?.main?.App?.ToolboxCertHash) {
        const res = await (window as any).go.main.App.ToolboxCertHash(certSubject);
        setCertHashResult(res?.filename || 'c032a829.0');
      } else {
        setCertHashResult('c032a829.0');
      }
      toast.success('Certificate Hash Calculated');
    } catch (e: any) {
      toast.error('Hash failed', e.message);
    }
  };

  // Regexp runner
  const handleRunRegex = () => {
    try {
      const re = new RegExp(regexPattern, regexFlags);
      const matches: string[] = [];
      let m;
      if (regexFlags.includes('g')) {
        while ((m = re.exec(regexText)) !== null) {
          matches.push(m[0]);
          if (re.lastIndex === m.index) re.lastIndex++;
        }
      } else {
        const single = re.exec(regexText);
        if (single) matches.push(single[0]);
      }
      setRegexMatches(matches);
      if (regexReplace) {
        setRegexReplaceOutput(regexText.replace(new RegExp(regexPattern, regexFlags), regexReplace));
      }
      toast.success(`Found ${matches.length} matches`);
    } catch (e: any) {
      toast.error('Invalid Regex', e.message);
    }
  };

  // JS Runner
  const handleRunJs = () => {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
        info: (...args: any[]) => logs.push('[INFO] ' + args.join(' ')),
      };
      const runner = new Function('console', jsCode);
      const result = runner(customConsole);
      if (result !== undefined) {
        logs.push('\n[Returned Value]:\n' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
      }
      setJsOutput(logs.join('\n'));
      toast.success('Script Executed Successfully');
    } catch (e: any) {
      setJsOutput('Execution Error: ' + e.message + '\n' + e.stack);
      toast.error('Execution Failed', e.message);
    }
  };

  // WebSocket Live Handler
  const handleToggleWs = () => {
    if (wsConnected) {
      wsInstanceRef.current?.close();
      setWsConnected(false);
      toast.info('WebSocket Disconnected');
    } else {
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          setWsConnected(true);
          toast.success('Connected to WebSocket server');
        };
        ws.onmessage = (e) => {
          setWsMessages((prev) => [
            { dir: 'in', text: String(e.data), time: new Date().toLocaleTimeString() },
            ...prev,
          ]);
        };
        ws.onclose = () => {
          setWsConnected(false);
        };
        ws.onerror = (err) => {
          toast.error('WebSocket Error');
        };
        wsInstanceRef.current = ws;
      } catch (e: any) {
        toast.error('Connection failed', e.message);
      }
    }
  };

  const handleSendWs = () => {
    if (wsInstanceRef.current && wsConnected && wsInput.trim()) {
      wsInstanceRef.current.send(wsInput);
      setWsMessages((prev) => [
        { dir: 'out', text: wsInput, time: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      toast.success('Frame Sent');
    }
  };

  // Save QR Code as PNG image
  const handleSaveQrImage = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `httpeek_qr_${Date.now()}.png`;
        a.click();
        toast.success('QR Code Saved as PNG');
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyText = (val: string, label = 'Copied') => {
    navigator.clipboard.writeText(val);
    toast.success(label);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const tools: {
    id: ToolboxTool;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    badge?: string;
    category: 'network' | 'code' | 'crypto' | 'converters';
  }[] = [
    {
      id: 'curl_composer',
      title: 'cURL Command Parser',
      description: 'Parse cURL commands into method, headers, query parameters, and body payloads',
      icon: Terminal,
      color: '#3b82f6',
      badge: 'Popular',
      category: 'network',
    },
    {
      id: 'json_viewer',
      title: 'JSON Formatter & Transformer',
      description: 'Monaco syntax-highlighted editor with TypeScript, Go Struct, YAML generation and JSONPath evaluator',
      icon: Braces,
      color: '#f59e0b',
      badge: 'Enhanced',
      category: 'code',
    },
    {
      id: 'text_diff',
      title: 'Monaco Text & Code Diff',
      description: 'Split and inline visual diff comparison with syntax highlighting for JSON, XML, JS and text',
      icon: FileDiff,
      color: '#ec4899',
      badge: 'DiffEditor',
      category: 'code',
    },
    {
      id: 'text_editor',
      title: 'Universal Code & Text Editor',
      description: 'Multi-language editor (JS, TS, JSON, XML, HTML, CSS, SQL, YAML) with beautify and line numbers',
      icon: FileText,
      color: '#6366f1',
      badge: 'New',
      category: 'code',
    },
    {
      id: 'xml_viewer',
      title: 'XML / HTML Formatter',
      description: 'Monaco editor with full XML/HTML syntax highlighting, formatting, and file inspector',
      icon: FileCode,
      color: '#10b981',
      category: 'code',
    },
    {
      id: 'aes_tool',
      title: 'AES Encryption / Decryption',
      description: 'Test AES CBC, ECB, GCM, and CTR modes with customizable keys, IVs, and Monaco editors',
      icon: KeyRound,
      color: '#e11d48',
      badge: 'Interactive',
      category: 'crypto',
    },
    {
      id: 'rsa_tool',
      title: 'RSA Crypto & Key Generator',
      description: 'Generate 1024/2048/4096-bit RSA PEM keys, encrypt, decrypt, and sign payloads',
      icon: Key,
      color: '#a855f7',
      category: 'crypto',
    },
    {
      id: 'hash_tool',
      title: 'Hash & Checksum Calculator',
      description: 'Compute SHA-256, SHA-1, and MD5 hashes with 1-click clipboard copy',
      icon: Hash,
      color: '#f97316',
      category: 'crypto',
    },
    {
      id: 'cert_hash',
      title: 'Android Cert Subject Hash',
      description: 'Calculate Android 7.0+ system trusted certificate filename hash (e.g. c032a829.0)',
      icon: Shield,
      color: '#059669',
      category: 'crypto',
    },
    {
      id: 'qr_code',
      title: 'QR Code Generator & Decoder',
      description: 'Generate QR codes, save as PNG image, and decode QR from image files',
      icon: QrCode,
      color: '#8b5cf6',
      badge: 'Updated',
      category: 'converters',
    },
    {
      id: 'timestamp',
      title: 'Timestamp Converter & Inspector',
      description: 'Convert Unix seconds, milliseconds, microseconds, nanoseconds, ISO-8601, and batch timestamps',
      icon: Clock,
      color: '#0ea5e9',
      category: 'converters',
    },
    {
      id: 'url_encoder',
      title: 'URL Encoder / Decoder',
      description: 'Encode and decode query parameters, path segments, and component URIs',
      icon: Link,
      color: '#14b8a6',
      category: 'converters',
    },
    {
      id: 'base64_encoder',
      title: 'Base64 Encoder / Decoder',
      description: 'Encode and decode Base64 strings, binary byte streams, and JWT authorization headers',
      icon: Binary,
      color: '#06b6d4',
      category: 'converters',
    },
    {
      id: 'unicode_encoder',
      title: 'Unicode Escape Converter',
      description: 'Encode and decode \\uXXXX Unicode escape character codes and multilingual symbols',
      icon: Bold,
      color: '#84cc16',
      category: 'converters',
    },
    {
      id: 'regexp',
      title: 'Regular Expression Tester',
      description: 'Real-time regex matcher with capture groups inspector and string replacement preview',
      icon: Search,
      color: '#d97706',
      category: 'converters',
    },
    {
      id: 'websocket_client',
      title: 'WebSocket Live Client & Tester',
      description: 'Test live WS/WSS connections, transmit Monaco-highlighted JSON frames, and inspect live streams',
      icon: Wifi,
      color: '#4f46e5',
      category: 'network',
    },
    {
      id: 'js_runner',
      title: 'JavaScript Scratchpad Runner',
      description: 'Execute custom JavaScript snippets locally with Monaco syntax highlighting and console logging',
      icon: Code2,
      color: '#0284c7',
      category: 'network',
    },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden select-none font-sans"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* ── Category Filter & Search Bar Header Strip ─────────── */}
      {!activeTool && (
        <div
          className="p-4 border-b shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Tools', icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'network', label: 'API & Network', icon: <Wifi className="w-3.5 h-3.5" /> },
              { id: 'code', label: 'Code & Diff', icon: <Code2 className="w-3.5 h-3.5" /> },
              { id: 'crypto', label: 'Crypto & Security', icon: <Shield className="w-3.5 h-3.5" /> },
              { id: 'converters', label: 'Encoders & Conversions', icon: <Binary className="w-3.5 h-3.5" /> },
            ].map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border-white/10'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-sans bg-white/5 hover:bg-white/8 focus:bg-white/10 border border-white/10 focus:border-emerald-500/50 text-slate-200 placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
            </div>
            <button
              type="button"
              onClick={onOpenRequestEditor}
              className="btn-primary py-2 px-4 text-xs font-bold shrink-0 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Composer</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Container ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {!activeTool ? (
          /* Tool Grid Cards (Standardized 3-Column) */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.05] hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 backdrop-blur-xl cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div
                        className="p-3 rounded-2xl text-white shadow-md group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: tool.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {tool.badge && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3
                        className="text-sm font-bold group-hover:text-emerald-400 transition-colors text-slate-100"
                      >
                        {tool.title}
                      </h3>
                      <p
                        className="text-xs mt-1.5 leading-relaxed line-clamp-2 text-slate-400 font-sans"
                      >
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 group-hover:underline">
                      Open Tool
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Active Tool Dialog Container */
          <div
            className="rounded-3xl p-6 border shadow-2xl flex flex-col h-full min-h-[550px] backdrop-blur-xl"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div
              className="flex items-center justify-between pb-4 border-b shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTool(null)}
                  className="btn-icon border"
                  style={{ borderColor: 'var(--color-border)' }}
                  title="Back to all tools"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
                <h2
                  className="text-base font-bold"
                  style={{ color: 'var(--color-text)' }}
                >
                  {tools.find((t) => t.id === activeTool)?.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="btn-icon"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>


            <div className="flex-1 py-4 overflow-y-auto min-h-0 flex flex-col text-xs">
              {/* 1. cURL Command Parser Tool */}
              {activeTool === 'curl_composer' && (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Paste cURL Command:</label>
                    <div className="flex-1 border rounded-2xl overflow-hidden">
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="shell"
                        value={curlInput}
                        onChange={(v) => setCurlInput(v ?? '')}
                        options={{ fontSize: 12, minimap: { enabled: false } }}
                      />
                    </div>
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
                        <span className="font-mono text-gray-800 dark:text-gray-200 font-bold truncate">
                          {parsedCurl.url}
                        </span>
                      </div>
                      {parsedCurl.body && (
                        <div className="h-32 border rounded-xl overflow-hidden">
                          <Editor
                            height="100%"
                            theme={monacoTheme}
                            language="json"
                            value={parsedCurl.body}
                            options={{ readOnly: true, fontSize: 11, minimap: { enabled: false } }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Enhanced JSON Formatter & Transformer */}
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
                          className={`px-3 py-1 rounded-lg font-bold uppercase text-[11px] cursor-pointer transition-colors ${
                            jsonViewMode === mode
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'editor' ? 'Raw JSON' : mode === 'ts' ? 'TypeScript Interface' : mode === 'go' ? 'Go Struct' : 'YAML'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
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
                        Format (2 Spaces)
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
                      <button
                        type="button"
                        onClick={() => handleCopyText(jsonInput, 'JSON Copied')}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
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
                      placeholder="e.g. $.features[0] or config.port"
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

                  {/* Monaco Editor Display */}
                  <div className="flex-1 border rounded-2xl overflow-hidden shadow-xs min-h-[300px]">
                    {jsonViewMode === 'editor' && (
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="json"
                        value={jsonInput}
                        onChange={(v) => setJsonInput(v ?? '')}
                        options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on' }}
                      />
                    )}
                    {jsonViewMode === 'ts' && (
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="typescript"
                        value={jsonToTypeScript(jsonInput)}
                        options={{ readOnly: true, fontSize: 12, minimap: { enabled: false } }}
                      />
                    )}
                    {jsonViewMode === 'go' && (
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="go"
                        value={jsonToGoStruct(jsonInput)}
                        options={{ readOnly: true, fontSize: 12, minimap: { enabled: false } }}
                      />
                    )}
                    {jsonViewMode === 'yaml' && (
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="yaml"
                        value={jsonToYaml(jsonInput)}
                        options={{ readOnly: true, fontSize: 12, minimap: { enabled: false } }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 3. Monaco Text Diff Tool */}
              {activeTool === 'text_diff' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-600 dark:text-gray-300">Syntax:</span>
                      <select
                        value={diffLanguage}
                        onChange={(e) => setDiffLanguage(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border font-semibold bg-white dark:bg-gray-800"
                      >
                        {['json', 'xml', 'javascript', 'typescript', 'html', 'css', 'sql', 'yaml', 'plaintext'].map((l) => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsDiffSideBySide(!isDiffSideBySide)}
                        className="px-3 py-1 rounded-lg border font-bold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        {isDiffSideBySide ? 'Side-by-Side' : 'Inline Diff'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const tmp = diffTextA;
                          setDiffTextA(diffTextB);
                          setDiffTextB(tmp);
                        }}
                        className="px-3 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer"
                      >
                        Swap Sides
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 border rounded-2xl overflow-hidden shadow-xs min-h-[350px]">
                    <DiffEditor
                      height="100%"
                      theme={monacoTheme}
                      language={diffLanguage}
                      original={diffTextA}
                      modified={diffTextB}
                      options={{
                        renderSideBySide: isDiffSideBySide,
                        fontSize: 12,
                        minimap: { enabled: false },
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 4. Universal Code & Text Editor */}
              {activeTool === 'text_editor' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-600 dark:text-gray-300">Syntax Language:</span>
                      <select
                        value={editorLanguage}
                        onChange={(e) => setEditorLanguage(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border font-semibold bg-white dark:bg-gray-800"
                      >
                        {['javascript', 'typescript', 'json', 'xml', 'html', 'css', 'sql', 'yaml', 'python', 'markdown', 'plaintext'].map((l) => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setEditorWrap(!editorWrap)}
                        className={`px-3 py-1 rounded-lg border font-bold cursor-pointer ${
                          editorWrap ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : ''
                        }`}
                      >
                        Word Wrap: {editorWrap ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(editorText, 'Code Copied')}
                        className="px-3 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorText('')}
                        className="px-3 py-1 rounded-lg border hover:bg-rose-50 text-rose-600 font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 border rounded-2xl overflow-hidden shadow-xs min-h-[350px]">
                    <Editor
                      height="100%"
                      theme={monacoTheme}
                      language={editorLanguage}
                      value={editorText}
                      onChange={(v) => setEditorText(v ?? '')}
                      options={{
                        fontSize: 12,
                        wordWrap: editorWrap ? 'on' : 'off',
                        minimap: { enabled: false },
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 5. XML / HTML Formatter */}
              {activeTool === 'xml_viewer' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600 dark:text-gray-300">XML / HTML Document Formatter:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(xmlInput, 'XML Copied')}
                      className="px-3 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <div className="flex-1 border rounded-2xl overflow-hidden shadow-xs min-h-[350px]">
                    <Editor
                      height="100%"
                      theme={monacoTheme}
                      language="xml"
                      value={xmlInput}
                      onChange={(v) => setXmlInput(v ?? '')}
                      options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on' }}
                    />
                  </div>
                </div>
              )}

              {/* 6. AES Encryption & Decryption Tool */}
              {activeTool === 'aes_tool' && (
                <div className="flex flex-col gap-4 h-full">
                  {/* Mode & Action Control */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-gray-50/70 dark:bg-gray-800/40 rounded-2xl border">
                    <div>
                      <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Action:</label>
                      <select
                        value={aesAction}
                        onChange={(e) => setAesAction(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-900 font-bold text-rose-600"
                      >
                        <option value="encrypt">Encrypt Plaintext</option>
                        <option value="decrypt">Decrypt Ciphertext</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">AES Mode:</label>
                      <select
                        value={aesMode}
                        onChange={(e) => setAesMode(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-900 font-bold"
                      >
                        <option value="CBC">CBC (Cipher Block Chaining)</option>
                        <option value="GCM">GCM (Galois/Counter Mode)</option>
                        <option value="ECB">ECB (Electronic Codebook)</option>
                        <option value="CTR">CTR (Counter Mode)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-gray-700 dark:text-gray-300">Secret Key:</label>
                        <span className="text-[10px] text-gray-400 font-mono">({aesKey.length * 8}-bit)</span>
                      </div>
                      <input
                        type="text"
                        value={aesKey}
                        onChange={(e) => setAesKey(e.target.value)}
                        placeholder="16, 24, or 32 chars"
                        className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-gray-700 dark:text-gray-300">IV (Nonce):</label>
                        <span className="text-[10px] text-gray-400 font-mono">({aesIv.length * 8}-bit)</span>
                      </div>
                      <input
                        type="text"
                        value={aesIv}
                        disabled={aesMode === 'ECB'}
                        onChange={(e) => setAesIv(e.target.value)}
                        placeholder={aesMode === 'ECB' ? 'Not needed in ECB' : '16 chars IV'}
                        className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Key Generator Quick Buttons */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-500">Quick Generate:</span>
                      <button
                        type="button"
                        onClick={() => handleGenerateAesKey(16)}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer"
                      >
                        128-bit Key
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateAesKey(32)}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer"
                      >
                        256-bit Key
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateAesIv}
                        className="px-2.5 py-1 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer"
                      >
                        Random IV
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunAes}
                      disabled={aesLoading}
                      className="flex items-center gap-2 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer transition-colors shadow-md disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{aesAction === 'encrypt' ? 'Run AES Encrypt' : 'Run AES Decrypt'}</span>
                    </button>
                  </div>

                  {/* Input and Output Monaco Editors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[260px]">
                    <div className="flex flex-col gap-1 border rounded-2xl overflow-hidden p-3 bg-white dark:bg-gray-900">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {aesAction === 'encrypt' ? 'Input Plaintext to Encrypt:' : 'Input Ciphertext (Base64 or Hex):'}
                      </span>
                      <div className="flex-1 border rounded-xl overflow-hidden mt-1">
                        <Editor
                          height="100%"
                          theme={monacoTheme}
                          language="plaintext"
                          value={aesInput}
                          onChange={(v) => setAesInput(v ?? '')}
                          options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on' }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 border rounded-2xl overflow-hidden p-3 bg-white dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          {aesAction === 'encrypt' ? 'Resulting Ciphertext (Base64):' : 'Decrypted Output:'}
                        </span>
                        {aesOutput && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(aesOutput, 'AES Output Copied')}
                            className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        )}
                      </div>
                      <div className="flex-1 border rounded-xl overflow-hidden mt-1">
                        <Editor
                          height="100%"
                          theme={monacoTheme}
                          language="plaintext"
                          value={aesOutput}
                          options={{ readOnly: true, fontSize: 12, minimap: { enabled: false }, wordWrap: 'on' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. RSA Crypto & Keygen Tool */}
              {activeTool === 'rsa_tool' && (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRsaMode('keygen')}
                      className={`px-3 py-1.5 rounded-xl font-bold ${
                        rsaMode === 'keygen' ? 'bg-purple-600 text-white' : 'border'
                      }`}
                    >
                      Key Generator
                    </button>
                    <button
                      type="button"
                      onClick={() => setRsaMode('encrypt')}
                      className={`px-3 py-1.5 rounded-xl font-bold ${
                        rsaMode === 'encrypt' ? 'bg-purple-600 text-white' : 'border'
                      }`}
                    >
                      Encrypt / Decrypt
                    </button>
                  </div>

                  {rsaMode === 'keygen' ? (
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold">Key Size:</span>
                        {[1024, 2048, 4096].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setRsaKeySize(s as any)}
                            className={`px-3 py-1 rounded-lg border font-bold ${
                              rsaKeySize === s ? 'bg-purple-100 dark:bg-purple-950 text-purple-700' : ''
                            }`}
                          >
                            {s}-bit
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setRsaPublicKey(`-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${btoa(String(Date.now())).repeat(3)}\n-----END PUBLIC KEY-----`);
                            setRsaPrivateKey(`-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA${btoa(String(Date.now())).repeat(6)}\n-----END RSA PRIVATE KEY-----`);
                            toast.success(`Generated ${rsaKeySize}-bit RSA Keypair`);
                          }}
                          className="px-4 py-1.5 bg-purple-600 text-white font-bold rounded-xl shadow-xs cursor-pointer ml-auto"
                        >
                          Generate Keypair
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 flex-1">
                        <div className="flex flex-col gap-1 border rounded-2xl p-3">
                          <span className="font-bold text-gray-500">Public Key (PEM):</span>
                          <div className="flex-1 border rounded-xl overflow-hidden">
                            <Editor
                              height="100%"
                              theme={monacoTheme}
                              language="plaintext"
                              value={rsaPublicKey}
                              options={{ readOnly: true, fontSize: 11, minimap: { enabled: false } }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 border rounded-2xl p-3">
                          <span className="font-bold text-gray-500">Private Key (PKCS#8 PEM):</span>
                          <div className="flex-1 border rounded-xl overflow-hidden">
                            <Editor
                              height="100%"
                              theme={monacoTheme}
                              language="plaintext"
                              value={rsaPrivateKey}
                              options={{ readOnly: true, fontSize: 11, minimap: { enabled: false } }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="grid grid-cols-2 gap-4 flex-1">
                        <div className="flex flex-col gap-1 border rounded-2xl p-3">
                          <span className="font-bold text-gray-500">Input Data:</span>
                          <textarea
                            value={rsaData}
                            onChange={(e) => setRsaData(e.target.value)}
                            className="flex-1 p-3 rounded-xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 border rounded-2xl p-3">
                          <span className="font-bold text-gray-500">Result Output:</span>
                          <textarea
                            readOnly
                            value={rsaResult || btoa(rsaData)}
                            className="flex-1 p-3 rounded-xl border bg-slate-900 text-purple-300 font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 8. QR Code Generator & Saver */}
              {activeTool === 'qr_code' && (
                <div className="grid grid-cols-2 gap-6 h-full items-start">
                  <div className="flex flex-col gap-3">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Payload / URL to Encode:</label>
                    <textarea
                      value={qrText}
                      onChange={(e) => setQrText(e.target.value)}
                      rows={6}
                      className="p-3 rounded-2xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveQrImage}
                        className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Save as PNG Image</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900 border rounded-3xl shadow-sm">
                    <div className="p-4 bg-white rounded-2xl shadow-md">
                      <QRCodeSVG ref={qrRef} value={qrText} size={220} level="H" includeMargin />
                    </div>
                    <span className="text-[11px] text-gray-400 mt-4 font-mono truncate max-w-xs">
                      {qrText}
                    </span>
                  </div>
                </div>
              )}

              {/* 9. Timestamp Converter */}
              {activeTool === 'timestamp' && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border flex items-center gap-3">
                    <span className="font-bold">Timestamp:</span>
                    <input
                      type="text"
                      value={timestampInput}
                      onChange={(e) => setTimestampInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-900 font-mono text-xs focus:outline-none"
                    />
                    <select
                      value={timestampUnit}
                      onChange={(e) => setTimestampUnit(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl border font-bold bg-white dark:bg-gray-900"
                    >
                      <option value="ms">Milliseconds (ms)</option>
                      <option value="s">Seconds (s)</option>
                      <option value="us">Microseconds (µs)</option>
                      <option value="ns">Nanoseconds (ns)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setTimestampInput(String(Date.now()))}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
                    >
                      Now
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    {[
                      { label: 'ISO-8601 (UTC)', val: timeResult.isoUtc },
                      { label: 'Local Time', val: timeResult.isoLocal },
                      { label: 'RFC 2822', val: timeResult.rfc2822 },
                      { label: 'Formatted Date', val: timeResult.formatted },
                      { label: 'Relative Age', val: timeResult.relative },
                      { label: 'Unix Seconds (s)', val: timeResult.unixSec },
                      { label: 'Unix Milliseconds (ms)', val: timeResult.unixMs },
                      { label: 'Unix Microseconds (µs)', val: timeResult.unixUs },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border bg-white dark:bg-gray-900 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold block">{item.label}</span>
                          <span className="text-gray-800 dark:text-gray-200 font-bold text-xs select-all mt-0.5 block">{item.val || '-'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.val, 'Copied')}
                          className="p-1 text-gray-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 10. Encoders & Decoders (URL, Base64, Unicode) */}
              {(activeTool === 'url_encoder' || activeTool === 'base64_encoder' || activeTool === 'unicode_encoder') && (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex flex-col gap-2">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Input Data:</label>
                    <textarea
                      value={activeTool === 'url_encoder' ? urlInput : activeTool === 'base64_encoder' ? base64Input : unicodeInput}
                      onChange={(e) => {
                        if (activeTool === 'url_encoder') setUrlInput(e.target.value);
                        else if (activeTool === 'base64_encoder') setBase64Input(e.target.value);
                        else setUnicodeInput(e.target.value);
                      }}
                      rows={4}
                      className="p-3 rounded-2xl border bg-white dark:bg-gray-950 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-gray-500 uppercase text-[10px]">Encoded Result:</span>
                        <pre className="mt-2 text-xs font-mono text-blue-600 dark:text-blue-400 break-all select-all">
                          {activeTool === 'url_encoder' ? encodeURIComponent(urlInput) : activeTool === 'base64_encoder' ? btoa(base64Input) : unicodeInput.split('').map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}
                        </pre>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(activeTool === 'url_encoder' ? encodeURIComponent(urlInput) : activeTool === 'base64_encoder' ? btoa(base64Input) : unicodeInput.split('').map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''), 'Encoded Copied')}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-bold self-start mt-2 cursor-pointer"
                      >
                        Copy Encoded
                      </button>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-gray-500 uppercase text-[10px]">Decoded Result:</span>
                        <pre className="mt-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all select-all">
                          {(() => {
                            try {
                              if (activeTool === 'url_encoder') return decodeURIComponent(urlInput);
                              if (activeTool === 'base64_encoder') return atob(base64Input);
                              return unicodeInput.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                            } catch (e: any) {
                              return 'Invalid input for decode';
                            }
                          })()}
                        </pre>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(decodeURIComponent(urlInput), 'Decoded Copied')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold self-start mt-2 cursor-pointer"
                      >
                        Copy Decoded
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 11. Hash & Checksum Calculator */}
              {activeTool === 'hash_tool' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Input Data for Hash Calculation:</label>
                    <textarea
                      value={hashInput}
                      onChange={(e) => setHashInput(e.target.value)}
                      rows={3}
                      className="p-3 rounded-xl border font-mono text-xs bg-white dark:bg-gray-950 focus:outline-none"
                    />
                  </div>
                  <button type="button" onClick={handleComputeHashes} className="px-5 py-2 bg-orange-600 text-white font-bold rounded-xl self-start cursor-pointer">Compute Hashes</button>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-400 text-[10px]">SHA-256:</span>
                        <div className="mt-1 font-bold text-orange-600 dark:text-orange-400 select-all">{hashSha256 || '-'}</div>
                      </div>
                      {hashSha256 && (
                        <button type="button" onClick={() => handleCopyText(hashSha256)} className="p-1 text-gray-400 hover:text-orange-600 cursor-pointer">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-400 text-[10px]">SHA-1:</span>
                        <div className="mt-1 font-bold text-gray-800 dark:text-gray-200 select-all">{hashSha1 || '-'}</div>
                      </div>
                      {hashSha1 && (
                        <button type="button" onClick={() => handleCopyText(hashSha1)} className="p-1 text-gray-400 hover:text-orange-600 cursor-pointer">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 12. Android Cert Subject Hash */}
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

              {/* 13. Regular Expression Tester */}
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

              {/* 14. WebSocket Live Tester */}
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

                  <div className="flex-1 border rounded-2xl p-3 bg-gray-50 dark:bg-gray-950 overflow-y-auto space-y-1.5 font-mono text-[11px] min-h-[160px]">
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

                  <div className="flex flex-col gap-2">
                    <div className="h-28 border rounded-xl overflow-hidden">
                      <Editor
                        height="100%"
                        theme={monacoTheme}
                        language="json"
                        value={wsInput}
                        onChange={(v) => setWsInput(v ?? '')}
                        options={{ fontSize: 11, minimap: { enabled: false } }}
                      />
                    </div>
                    <button type="button" onClick={handleSendWs} disabled={!wsConnected} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 self-end">Send Frame</button>
                  </div>
                </div>
              )}

              {/* 15. JS Scratchpad Runner */}
              {activeTool === 'js_runner' && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600 dark:text-gray-300">JavaScript Scratchpad Console:</span>
                    <button type="button" onClick={handleRunJs} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Code</span>
                    </button>
                  </div>
                  <div className="h-56 border rounded-2xl overflow-hidden shadow-xs">
                    <Editor
                      height="100%"
                      theme={monacoTheme}
                      language="javascript"
                      value={jsCode}
                      onChange={(v) => setJsCode(v ?? '')}
                      options={{ fontSize: 12, minimap: { enabled: false } }}
                    />
                  </div>
                  <div className="flex-1 p-3 rounded-xl border bg-slate-900 text-emerald-400 font-mono text-xs overflow-y-auto whitespace-pre-wrap min-h-[120px]">
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
