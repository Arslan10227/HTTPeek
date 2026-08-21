import React, { useState, useMemo } from 'react';
import { HttpRequest } from '../../types';
import { useAppConfig } from '../../theme/useAppConfig';
import {
  Binary,
  Copy,
  Check,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  FileCode,
  Sliders,
} from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface StreamTabProps {
  request: HttpRequest;
}

export const StreamTab: React.FC<StreamTabProps> = ({ request }) => {
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [direction, setDirection] = useState<'both' | 'request' | 'response'>('both');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bytesPerRow, setBytesPerRow] = useState<16 | 32>(16);

  // Convert raw base64 or string body into byte array
  const requestBytes = useMemo(() => {
    if (request.bodyBase64) {
      try {
        const bin = atob(request.bodyBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      } catch { /* ignore */ }
    }
    const str = request.bodyString || request.body || '';
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }, [request]);

  const responseBytes = useMemo(() => {
    if (request.response?.bodyBase64) {
      try {
        const bin = atob(request.response.bodyBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      } catch { /* ignore */ }
    }
    const str = request.response?.bodyString || request.response?.body || '';
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }, [request]);

  const activeBuffer = useMemo(() => {
    if (direction === 'request') return requestBytes;
    if (direction === 'response') return responseBytes;
    // Both combined
    const combined = new Uint8Array(requestBytes.length + responseBytes.length);
    combined.set(requestBytes, 0);
    combined.set(responseBytes, requestBytes.length);
    return combined;
  }, [direction, requestBytes, responseBytes]);

  const formatHexRows = useMemo(() => {
    const rows = [];
    const buf = activeBuffer;
    const len = buf.length;

    for (let i = 0; i < len; i += bytesPerRow) {
      const slice = buf.subarray(i, Math.min(i + bytesPerRow, len));
      const offset = i.toString(16).padStart(8, '0');

      // Hex string
      const hexParts: string[] = [];
      for (let j = 0; j < bytesPerRow; j++) {
        if (j < slice.length) {
          hexParts.push(slice[j].toString(16).padStart(2, '0'));
        } else {
          hexParts.push('  ');
        }
      }

      // ASCII string
      let ascii = '';
      for (let j = 0; j < slice.length; j++) {
        const byte = slice[j];
        if (byte >= 32 && byte <= 126) {
          ascii += String.fromCharCode(byte);
        } else {
          ascii += '·';
        }
      }

      rows.push({
        offset,
        hex: hexParts.join(' '),
        ascii,
      });
    }

    return rows;
  }, [activeBuffer, bytesPerRow]);

  const handleCopy = () => {
    let hexStr = '';
    for (let i = 0; i < activeBuffer.length; i++) {
      hexStr += activeBuffer[i].toString(16).padStart(2, '0') + ' ';
    }
    navigator.clipboard.writeText(hexStr.trim());
    setCopied(true);
    toast.success('Hex Copied', `${activeBuffer.length} bytes copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none font-sans" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Stream Controls Topbar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 flex-wrap gap-2 text-xs"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-1.5 bg-neutral-900/40 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setDirection('both')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              direction === 'both'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All Stream ({requestBytes.length + responseBytes.length} B)
          </button>
          <button
            type="button"
            onClick={() => setDirection('request')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              direction === 'request'
                ? 'bg-blue-500/20 text-blue-400 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Client ({requestBytes.length} B)
          </button>
          <button
            type="button"
            onClick={() => setDirection('response')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              direction === 'response'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Server ({responseBytes.length} B)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-900/40 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => setBytesPerRow(16)}
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                bytesPerRow === 16 ? 'bg-white/15 text-white' : 'text-neutral-400'
              }`}
            >
              16-byte
            </button>
            <button
              type="button"
              onClick={() => setBytesPerRow(32)}
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                bytesPerRow === 32 ? 'bg-white/15 text-white' : 'text-neutral-400'
              }`}
            >
              32-byte
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-neutral-300 transition-colors"
            title="Copy Hex"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Wireshark-style Hex / ASCII table */}
      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed select-text">
        {formatHexRows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-2 p-12 text-center">
            <Binary className="w-8 h-8 text-neutral-600" />
            <p className="font-semibold text-sm">Empty Stream</p>
            <p className="text-xs">No raw binary or TCP bytes captured in this exchange.</p>
          </div>
        ) : (
          <div className="inline-block min-w-full">
            {formatHexRows.map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 py-0.5 hover:bg-white/5 rounded px-2"
              >
                {/* Offset */}
                <span className="text-neutral-500 shrink-0 font-bold">{row.offset}</span>

                {/* Hex Bytes */}
                <span className="text-cyan-400/90 tracking-wider shrink-0 whitespace-pre">
                  {row.hex}
                </span>

                {/* Separator */}
                <span className="text-neutral-700 select-none">|</span>

                {/* ASCII */}
                <span className="text-neutral-300 tracking-normal break-all font-mono">
                  {row.ascii}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
