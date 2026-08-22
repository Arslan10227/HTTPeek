import React, { useState, useMemo } from 'react';
import { Copy, Check, Search } from 'lucide-react';

interface HexViewerProps {
  data: Uint8Array | string | null | undefined;
  className?: string;
}

export const HexViewer: React.FC<HexViewerProps> = ({ data, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const bytes = useMemo(() => {
    if (!data) return new Uint8Array(0);
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return data;
  }, [data]);

  const rows = useMemo(() => {
    const result: { offset: string; hex: string[]; ascii: string }[] = [];
    const len = bytes.length;

    for (let i = 0; i < len; i += 16) {
      const slice = bytes.slice(i, Math.min(i + 16, len));
      const offset = i.toString(16).padStart(8, '0').toUpperCase();
      const hex: string[] = [];
      let ascii = '';

      for (let j = 0; j < 16; j++) {
        if (j < slice.length) {
          const byte = slice[j];
          hex.push(byte.toString(16).padStart(2, '0').toUpperCase());
          // Printable ASCII (32-126)
          ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
        } else {
          hex.push('  ');
        }
      }

      result.push({ offset, hex, ascii });
    }
    return result;
  }, [bytes]);

  const handleCopyHex = () => {
    const hexString = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    navigator.clipboard.writeText(hexString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (bytes.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-gray-500 font-mono">
        No binary payload data available
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-[#0a0f18] text-gray-300 font-mono text-xs select-text ${className}`}>
      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-cyan-400">{bytes.length} bytes</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">16 bytes / row</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyHex}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied Hex' : 'Copy Hex'}</span>
          </button>
        </div>
      </div>

      {/* Hex Grid */}
      <div className="flex-1 overflow-auto p-3 font-mono leading-relaxed space-y-1">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-4 hover:bg-white/5 px-1 py-0.5 rounded">
            {/* Offset */}
            <span className="text-gray-500 font-semibold select-none">{row.offset}</span>

            {/* Hex Bytes (8 + 8) */}
            <div className="flex items-center gap-2 text-cyan-300">
              <span className="space-x-1.5">{row.hex.slice(0, 8).join(' ')}</span>
              <span className="text-gray-600 select-none">|</span>
              <span className="space-x-1.5">{row.hex.slice(8, 16).join(' ')}</span>
            </div>

            {/* ASCII Column */}
            <span className="text-emerald-400/90 tracking-widest pl-2 border-l border-white/10">
              {row.ascii}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
