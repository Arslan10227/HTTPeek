import React, { useState, useMemo, useCallback } from 'react';
import {
  Copy,
  Code2,
  Sparkles,
  WrapText,
  Image as ImageIcon,
  Download,
} from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';

export type BodyFormat = 'auto' | 'json' | 'xml' | 'form' | 'text' | 'hex' | 'preview';

interface HttpBodyViewerProps {
  title: string;
  body?: string;
  contentType?: string;
  bodySize?: number;
}

const toHexDump = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, '0');
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(48, ' ');
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${offset}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
};

export const HttpBodyViewer: React.FC<HttpBodyViewerProps> = ({
  title,
  body = '',
  contentType = '',
  bodySize = 0,
}) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<BodyFormat>('auto');
  const [isWrap, setIsWrap] = useState(true);

  const ct = (Array.isArray(contentType) ? contentType.join(', ') : String(contentType || '')).toLowerCase();
  const isImage = ct.startsWith('image/');
  const isAudio = ct.startsWith('audio/');
  const isJson =
    ct.includes('json') ||
    (String(body || '').trimStart().startsWith('{') && String(body || '').trimEnd().endsWith('}')) ||
    (String(body || '').trimStart().startsWith('[') && String(body || '').trimEnd().endsWith(']'));
  const isXml = ct.includes('xml') || ct.includes('html');
  const isForm = ct.includes('x-www-form-urlencoded');

  const formattedContent = useMemo(() => {
    if (!body) return '';

    const effectiveFormat = format === 'auto'
      ? (isJson ? 'json' : isXml ? 'xml' : isForm ? 'form' : 'text')
      : format;

    if (effectiveFormat === 'hex') {
      return toHexDump(body);
    }

    if (effectiveFormat === 'json') {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch (_) {
        return body;
      }
    }

    if (effectiveFormat === 'form') {
      try {
        const params = new URLSearchParams(body);
        const entries: string[] = [];
        params.forEach((v, k) => entries.push(`${k} = ${decodeURIComponent(v)}`))
        return entries.join('\n');
      } catch (_) {
        return body;
      }
    }

    return body;
  }, [body, format, isJson, isXml, isForm]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formattedContent);
    toast.success(t.copied, `${bodySize || body.length} bytes`);
  }, [formattedContent, bodySize, body, t]);

  const handleBeautify = useCallback(() => {
    if (isJson) {
      setFormat('json');
      toast.success(t.success, 'JSON formatted');
    } else if (isXml) {
      setFormat('xml');
    } else {
      toast.info('Auto-detection: body is not JSON or XML');
    }
  }, [isJson, isXml, t]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([formattedContent], { type: contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\\s+/g, '_')}_body`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formattedContent, contentType, title]);

  if (!body && !isImage) {
    return (
      <div
        className="rounded-xl border p-6 text-center text-gray-400 text-xs italic"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        No body content
      </div>
    );
  }

  // Auto-preview images
  const effectiveFormat = (isImage && format === 'auto') ? 'preview' : format;

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-2xs text-xs flex flex-col"
      style={{
        backgroundColor: 'var(--md-dialog-bg)',
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Top Controls Bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800/40 border-b select-none"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700 dark:text-gray-300">{title} Body</span>
          <span className="text-[10px] text-gray-400 font-mono">
            ({bodySize || body.length} bytes)
          </span>
          {isImage && (
            <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
              <ImageIcon className="w-3 h-3" /> Image
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as BodyFormat)}
            className="px-2 py-0.5 rounded-md border text-[11px] font-medium bg-transparent focus:outline-none cursor-pointer"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <option value="auto">Auto</option>
            <option value="json">JSON</option>
            <option value="text">Text</option>
            <option value="form">Form URL</option>
            <option value="xml">XML / HTML</option>
            <option value="hex">Hex Dump</option>
            {isImage && <option value="preview">Preview</option>}
          </select>

          <button
            type="button"
            onClick={handleBeautify}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Auto-format / Beautify"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsWrap(!isWrap)}
            className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
              isWrap ? 'text-blue-500' : 'text-gray-400'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Copy Body"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Download Body"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Renderer */}
      <div className="p-3">
        {effectiveFormat === 'preview' && isImage ? (
          <div className="flex flex-col items-center justify-center p-4 bg-black/5 dark:bg-white/5 rounded-lg">
            <img
              src={`data:${contentType};base64,${body}`}
              alt="Response Preview"
              className="max-h-64 max-w-full object-contain rounded-md shadow-xs"
            />
            <span className="mt-2 text-[10px] text-gray-400">{contentType}</span>
          </div>
        ) : (
          <textarea
            readOnly
            value={formattedContent}
            rows={Math.min(Math.max(String(formattedContent || '').split('\n').length + 1, 6), 28)}
            wrap={isWrap ? 'soft' : 'off'}
            className="w-full p-2.5 rounded-lg border font-mono text-[11px] bg-transparent focus:outline-none resize-y select-text leading-relaxed"
            style={{
              borderColor: 'var(--md-sys-color-divider)',
              color: 'var(--md-sys-color-on-surface)',
              fontFamily: format === 'hex' ? 'monospace' : undefined,
            }}
          />
        )}
      </div>
    </div>
  );
};
