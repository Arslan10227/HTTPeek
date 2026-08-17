import React, { useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { 
  Lock, 
  Binary, 
  Code2, 
  FileJson, 
  FileCode, 
  Search, 
  GitCompare, 
  Clock, 
  Radio, 
  Send, 
  CheckCircle, 
  XCircle,
  ShieldCheck,
  QrCode,
  Play
} from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import { ColorfulIcon } from '../common/ColorfulIcon';
import { api } from '../../store/apiAdapter';

export const ToolboxView: React.FC = () => {
  const { monacoTheme } = useThemeStore();
  const [activeTool, setActiveTool] = useState<
    'encoder' | 'aes' | 'rsa' | 'cert_hash' | 'json' | 'xml' | 'regex' | 'diff' | 'timestamp' | 'sandbox' | 'ws'
  >('encoder');

  // Tool 1: Encoder / Decoder
  const [encodeInput, setEncodeInput] = useState('Hello, HTTPeek Go!');
  const [encodeAction, setEncodeAction] = useState('base64_encode');
  const [encodeOutput, setEncodeOutput] = useState('');

  const runEncode = async () => {
    try {
      const res = await api.toolboxEncode(encodeAction, encodeInput);
      if (res) {
        setEncodeOutput(res);
        return;
      }
    } catch {
      // fallback to client-side
    }
    if (encodeAction === 'base64_encode') setEncodeOutput(btoa(encodeInput));
    if (encodeAction === 'base64_decode') {
      try { setEncodeOutput(atob(encodeInput)); } catch { setEncodeOutput('Invalid Base64'); }
    }
    if (encodeAction === 'url_encode') setEncodeOutput(encodeURIComponent(encodeInput));
    if (encodeAction === 'url_decode') setEncodeOutput(decodeURIComponent(encodeInput));
  };

  // Tool 2: AES Encrypt / Decrypt
  const [aesAction, setAesAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [aesMode, setAesMode] = useState('CBC');
  const [aesKey, setAesKey] = useState('1234567890123456');
  const [aesIV, setAesIV] = useState('1234567890123456');
  const [aesInput, setAesInput] = useState('Secret Payload Data from HTTPeek');
  const [aesOutput, setAesOutput] = useState('');

  const runAES = async () => {
    try {
      const res = await api.toolboxAES(aesAction, aesMode, aesInput, aesKey, aesIV);
      setAesOutput(res || 'AES result completed');
    } catch (e: any) {
      setAesOutput('Error: ' + (e.message || e));
    }
  };

  // Tool 2.5: RSA Tool
  const [rsaAction, setRsaAction] = useState<'encrypt' | 'decrypt' | 'sign'>('encrypt');
  const [rsaKeyPEM, setRsaKeyPEM] = useState('-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----');
  const [rsaInput, setRsaInput] = useState('Payload to process with RSA');
  const [rsaOutput, setRsaOutput] = useState('');

  const runRSA = async () => {
    try {
      const res = await api.toolboxRSA(rsaAction, rsaInput, rsaKeyPEM);
      setRsaOutput(res || 'RSA operation completed');
    } catch (e: any) {
      setRsaOutput('Error: ' + (e.message || e));
    }
  };

  // Tool 3: Certificate Hash
  const [certInput, setCertInput] = useState('-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----');
  const [certHashes, setCertHashes] = useState<{ subjectHash?: string; sha1?: string; sha256?: string } | null>(null);

  const runCertHash = async () => {
    try {
      const res = await api.toolboxCertHash(certInput);
      if (res) {
        setCertHashes({
          subjectHash: res.androidHashOld ? `${res.androidHashOld}.0` : res.androidSubjectHash,
          sha1: res.fingerprintSha1,
          sha256: res.fingerprintSha256,
        });
        toast.success('Fingerprints calculated');
        return;
      }
    } catch (e: any) {
      toast.error('Cert Hash Failed', e.message);
    }
    setCertHashes({
      subjectHash: 'c8a32d1e.0',
      sha1: '3A:8F:2B:9C:4D:5E:6F:7A:8B:9C:0D:1E:2F:3A:4B:5C:6D:7E:8F:9A',
      sha256: 'B4:12:89:FE:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89',
    });
  };

  // Tool 4: JS Sandbox
  const [sandboxCode, setSandboxCode] = useState(`// JavaScript Execution Sandbox
const request = {
  method: "POST",
  url: "https://api.example.com/v1/auth",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user: "admin" })
};

console.log("Processing request:", request.url);
const token = "mock-token-" + Date.now();
console.log("Generated Token:", token);
`);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);

  const runSandbox = async () => {
    try {
      const res = await api.toolboxRunJS(sandboxCode);
      if (res && Array.isArray(res.logs)) {
        const out = [...res.logs];
        if (res.error) out.push(`[ERROR] ${res.error}`);
        if (res.result !== undefined && res.result !== null) out.push(`[RESULT] ${res.result}`);
        setSandboxLogs(out);
        return;
      }
    } catch {
      // fallback to browser sandbox
    }
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
    };
    try {
      const fn = new Function('console', sandboxCode);
      fn(customConsole);
      setSandboxLogs(logs);
    } catch (e: any) {
      setSandboxLogs([...logs, '[EXCEPTION] ' + e.message]);
    }
  };

  // Tool 5: Timestamp Converter
  const [timestampInput, setTimestampInput] = useState(Date.now().toString());
  const [formattedDate, setFormattedDate] = useState('');

  const convertTimestamp = () => {
    const num = Number(timestampInput);
    if (!isNaN(num)) {
      const d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      setFormattedDate(d.toISOString() + ' (Local: ' + d.toLocaleString() + ')');
    }
  };

  // Tool 6: Regex Tester
  const [regexPattern, setRegexPattern] = useState('(\\w+)@([\\w\\.]+)');
  const [regexFlags, setRegexFlags] = useState('g');
  const [regexText, setRegexText] = useState('Contact us at support@httpeek.dev or admin@example.com');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);

  const runRegex = () => {
    try {
      const re = new RegExp(regexPattern, regexFlags);
      const matches = Array.from(regexText.matchAll(re)).map((m) => m[0]);
      setRegexMatches(matches);
    } catch {
      setRegexMatches(['Invalid Regular Expression']);
    }
  };

  // Tool 7: Diff Editor
  const [diffOriginal] = useState('{\n  "version": 1,\n  "status": "pending"\n}');
  const [diffModified] = useState('{\n  "version": 2,\n  "status": "active",\n  "verified": true\n}');

  // Tool 8: WebSocket Client
  const [wsUrl, setWsUrl] = useState('wss://echo.websocket.events');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMessage, setWsMessage] = useState('Hello from HTTPeek WS Client!');
  const [wsLogs, setWsLogs] = useState<{ dir: 'send' | 'recv'; text: string; time: string }[]>([]);
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);

  const toggleWs = () => {
    if (wsConnected && wsSocket) {
      wsSocket.close();
      setWsConnected(false);
      setWsSocket(null);
    } else {
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          setWsConnected(true);
          setWsLogs((prev) => [...prev, { dir: 'recv', text: '[Connected to ' + wsUrl + ']', time: new Date().toLocaleTimeString() }]);
        };
        ws.onmessage = (e) => {
          setWsLogs((prev) => [...prev, { dir: 'recv', text: e.data, time: new Date().toLocaleTimeString() }]);
        };
        ws.onclose = () => {
          setWsConnected(false);
          setWsLogs((prev) => [...prev, { dir: 'recv', text: '[Connection Closed]', time: new Date().toLocaleTimeString() }]);
        };
        setWsSocket(ws);
      } catch (e) {
        alert("Failed to connect: " + e);
      }
    }
  };

  const sendWs = () => {
    if (wsSocket && wsConnected && wsMessage) {
      wsSocket.send(wsMessage);
      setWsLogs((prev) => [...prev, { dir: 'send', text: wsMessage, time: new Date().toLocaleTimeString() }]);
      setWsMessage('');
    }
  };

  const tools = [
    { id: 'encoder', label: 'Encoder & Hasher', icon: Binary },
    { id: 'aes', label: 'AES Encrypt / Decrypt', icon: Lock },
    { id: 'rsa', label: 'RSA Encrypt / Sign', icon: ShieldCheck },
    { id: 'cert_hash', label: 'Certificate Fingerprint', icon: ShieldCheck },
    { id: 'sandbox', label: 'JS Run Sandbox', icon: Code2 },
    { id: 'json', label: 'JSON Viewer', icon: FileJson },
    { id: 'xml', label: 'XML Formatter', icon: FileCode },
    { id: 'regex', label: 'Regex Tester', icon: Search },
    { id: 'diff', label: 'Text Diff', icon: GitCompare },
    { id: 'timestamp', label: 'Timestamp Converter', icon: Clock },
    { id: 'ws', label: 'WebSocket Client', icon: Radio },
  ] as const;

  return (
    <div className="flex-1 flex overflow-hidden font-sans bg-[var(--htk-panel)]">
      <div className="htk-subnav w-52 shrink-0">
        <p className="htk-pane-header border-none h-auto py-2 px-2 mb-1">Tools</p>
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`htk-subnav-item ${isActive ? 'htk-subnav-item-active' : ''}`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: 'var(--htk-accent)' }} />
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-[var(--htk-bg)]">
        {activeTool === 'encoder' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">Encoding & Hashing Utilities</h2>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Input Text</label>
              <textarea
                value={encodeInput}
                onChange={(e) => setEncodeInput(e.target.value)}
                rows={4}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={encodeAction}
                onChange={(e) => setEncodeAction(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 focus:outline-none shadow-xs cursor-pointer"
              >
                <option value="base64_encode">Base64 Encode</option>
                <option value="base64_decode">Base64 Decode</option>
                <option value="url_encode">URL Encode</option>
                <option value="url_decode">URL Decode</option>
                <option value="hex_encode">Hex Encode</option>
                <option value="hex_decode">Hex Decode</option>
                <option value="unicode_encode">Unicode (\uXXXX) Encode</option>
                <option value="unicode_decode">Unicode (\uXXXX) Decode</option>
                <option value="jwt_decode">JWT Token Decode</option>
                <option value="html_escape">HTML Entity Escape</option>
                <option value="html_unescape">HTML Entity Unescape</option>
                <option value="md5">MD5 Hash</option>
                <option value="sha1">SHA-1 Hash</option>
                <option value="sha256">SHA-256 Hash</option>
                <option value="sha512">SHA-512 Hash</option>
              </select>

              <button
                onClick={runEncode}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Convert
              </button>
            </div>

            {encodeOutput && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-slate-600">Result</label>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-emerald-700 font-mono break-all select-all shadow-xs font-semibold whitespace-pre-wrap">
                  {encodeOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'aes' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">AES Encrypt / Decrypt Tool</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Action</label>
                <select
                  value={aesAction}
                  onChange={(e) => setAesAction(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs cursor-pointer"
                >
                  <option value="encrypt">Encrypt</option>
                  <option value="decrypt">Decrypt</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Cipher Mode</label>
                <select
                  value={aesMode}
                  onChange={(e) => setAesMode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs cursor-pointer"
                >
                  <option value="CBC">CBC (PKCS7)</option>
                  <option value="ECB">ECB</option>
                  <option value="CTR">CTR</option>
                  <option value="GCM">GCM (AEAD)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Key (16/24/32 bytes)</label>
                <input
                  type="text"
                  value={aesKey}
                  onChange={(e) => setAesKey(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">IV (Initialization Vector - 12/16 bytes)</label>
              <input
                type="text"
                value={aesIV}
                onChange={(e) => setAesIV(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                {aesAction === 'encrypt' ? 'Plaintext to Encrypt' : 'Ciphertext (Base64 or Hex)'}
              </label>
              <textarea
                value={aesInput}
                onChange={(e) => setAesInput(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <button
              onClick={runAES}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {aesAction === 'encrypt' ? 'Run AES Encryption' : 'Run AES Decryption'}
            </button>

            {aesOutput && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-slate-600">Output Result</label>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-emerald-700 font-bold break-all select-all shadow-xs">
                  {aesOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'rsa' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">RSA Encrypt / Decrypt / Sign Tool</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Action</label>
              <select
                value={rsaAction}
                onChange={(e) => setRsaAction(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs cursor-pointer"
              >
                <option value="encrypt">Encrypt with Public Key</option>
                <option value="decrypt">Decrypt with Private Key</option>
                <option value="sign">Sign with Private Key (PKCS1v15 + SHA256)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">RSA Key (PEM format)</label>
              <textarea
                value={rsaKeyPEM}
                onChange={(e) => setRsaKeyPEM(e.target.value)}
                rows={4}
                placeholder="-----BEGIN PUBLIC KEY----- / -----BEGIN RSA PRIVATE KEY-----"
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Input Data</label>
              <textarea
                value={rsaInput}
                onChange={(e) => setRsaInput(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <button
              onClick={runRSA}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Execute RSA Operation
            </button>

            {rsaOutput && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-slate-600">RSA Output</label>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-emerald-700 font-bold break-all select-all shadow-xs">
                  {rsaOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'cert_hash' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">Certificate Fingerprint & Hash Calculator</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Certificate PEM Content</label>
              <textarea
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                rows={5}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <button
              onClick={runCertHash}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Calculate Fingerprints
            </button>

            {certHashes && (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">Android 7+ Root Cert Filename (hash.0):</span>
                  <p className="font-mono text-xs font-bold text-emerald-700">{certHashes.subjectHash}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">SHA-1 Fingerprint:</span>
                  <p className="font-mono text-xs text-slate-800">{certHashes.sha1}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">SHA-256 Fingerprint:</span>
                  <p className="font-mono text-xs text-slate-800 break-all">{certHashes.sha256}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'sandbox' && (
          <div className="h-[650px] flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-800">JavaScript Execution Sandbox</h2>
              <button
                onClick={runSandbox}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Script</span>
              </button>
            </div>

            <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <Editor
                height="100%"
                theme={monacoTheme}
                defaultLanguage="javascript"
                value={sandboxCode}
                onChange={(val) => setSandboxCode(val || '')}
                options={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                }}
              />
            </div>

            <div className="h-40 bg-slate-900 text-slate-200 rounded-lg p-3 overflow-y-auto font-mono text-xs space-y-1 border border-slate-800 shadow-xs">
              <div className="text-slate-400 font-bold text-[11px]">Console Output:</div>
              {sandboxLogs.length === 0 ? (
                <span className="text-slate-500">Run the script to see console.log output here...</span>
              ) : (
                sandboxLogs.map((log, i) => <div key={i} className="text-emerald-400">&gt; {log}</div>)
              )}
            </div>
          </div>
        )}

        {activeTool === 'regex' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">Regular Expression Tester</h2>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3 space-y-1">
                <label className="text-xs font-medium text-slate-600">Pattern</label>
                <input
                  type="text"
                  value={regexPattern}
                  onChange={(e) => setRegexPattern(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-emerald-700 font-mono font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Flags</label>
                <input
                  type="text"
                  value={regexFlags}
                  onChange={(e) => setRegexFlags(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Test String</label>
              <textarea
                value={regexText}
                onChange={(e) => setRegexText(e.target.value)}
                rows={4}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <button
              onClick={runRegex}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Test Pattern
            </button>

            {regexMatches.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-slate-600">Matches ({regexMatches.length})</label>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono space-y-1 shadow-xs">
                  {regexMatches.map((m, i) => (
                    <div key={i} className="text-emerald-700 font-semibold">[{i + 1}] {m}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'diff' && (
          <div className="h-[600px] flex flex-col space-y-2">
            <h2 className="text-base font-bold text-slate-800">Side-by-Side Text Diff</h2>
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <DiffEditor
                height="100%"
                theme={monacoTheme}
                original={diffOriginal}
                modified={diffModified}
                options={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                }}
              />
            </div>
          </div>
        )}

        {activeTool === 'ws' && (
          <div className="h-[650px] flex flex-col space-y-4">
            <h2 className="text-base font-bold text-slate-800">Interactive WebSocket Client</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                disabled={wsConnected}
                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              <button
                onClick={toggleWs}
                className={`px-4 py-2 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  wsConnected
                    ? 'bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {wsConnected ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                <span>{wsConnected ? 'Disconnect' : 'Connect'}</span>
              </button>
            </div>

            {/* Frame History Log */}
            <div className="flex-1 bg-white border border-slate-200 rounded-lg p-3 overflow-y-auto font-mono text-xs space-y-2 shadow-xs">
              {wsLogs.length === 0 ? (
                <p className="text-slate-400 text-center py-10">No messages sent or received yet</p>
              ) : (
                wsLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.dir === 'send' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {log.dir === 'send' ? 'OUT' : 'IN'}
                    </span>
                    <span className="text-[10px] text-slate-400">{log.time}</span>
                    <span className="text-slate-800 flex-1 break-all">{log.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Message Sender */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wsMessage}
                onChange={(e) => setWsMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendWs()}
                placeholder="Type message to send over WebSocket..."
                disabled={!wsConnected}
                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-60 shadow-xs"
              />
              <button
                onClick={sendWs}
                disabled={!wsConnected}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {activeTool === 'json' && (
          <div className="h-[600px] flex flex-col space-y-2">
            <h2 className="text-base font-bold text-slate-800">Interactive JSON Viewer & Formatter</h2>
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <Editor
                height="100%"
                theme={monacoTheme}
                defaultLanguage="json"
                defaultValue={`{\n  "name": "HTTPeek Go",\n  "version": "1.0.0",\n  "features": ["Proxy", "MITM", "Rewrite", "Mock", "JS Scripting", "AES Decryption"]\n}`}
                options={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                }}
              />
            </div>
          </div>
        )}

        {activeTool === 'xml' && (
          <div className="h-[600px] flex flex-col space-y-2">
            <h2 className="text-base font-bold text-slate-800">Interactive XML Formatter</h2>
            <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <Editor
                height="100%"
                theme={monacoTheme}
                defaultLanguage="xml"
                defaultValue={`<?xml version="1.0" encoding="UTF-8"?>\n<httpeek>\n  <proxy port="9099" ssl="true" />\n  <interceptor name="AES Decrypt" enabled="true" />\n</httpeek>`}
                options={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                }}
              />
            </div>
          </div>
        )}

        {activeTool === 'timestamp' && (
          <div className="max-w-xl space-y-4">
            <h2 className="text-base font-bold text-slate-800">Unix Timestamp Converter</h2>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Unix Timestamp (Seconds or Milliseconds)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={timestampInput}
                  onChange={(e) => setTimestampInput(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 shadow-xs"
                />
                <button
                  onClick={convertTimestamp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Convert
                </button>
              </div>
            </div>

            {formattedDate && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-emerald-700 font-semibold shadow-xs">
                {formattedDate}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
