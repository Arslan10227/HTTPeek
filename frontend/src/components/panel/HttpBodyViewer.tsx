import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Copy,
  Code2,
  Sparkles,
  WrapText,
  Image as ImageIcon,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  FileCode,
  Music,
  Video,
  FileText,
  Binary,
  Maximize2
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { toast } from '../../store/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useThemeStore } from '../../store/useThemeStore';

export type BodyFormat =
  | 'auto'
  | 'json'
  | 'graphql'
  | 'xml'
  | 'html'
  | 'javascript'
  | 'css'
  | 'yaml'
  | 'form'
  | 'text'
  | 'hex'
  | 'preview';

interface HttpBodyViewerProps {
  title: string;
  body?: string;
  contentType?: string;
  bodySize?: number;
  bodyBase64?: string;
}

const toHexDump = (raw: string): string => {
  const bytes = new TextEncoder().encode(raw);
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
  bodyBase64,
}) => {
  const { t } = useTranslation();
  const { monacoTheme } = useThemeStore();
  const [format, setFormat] = useState<BodyFormat>('auto');
  const [isWrap, setIsWrap] = useState(true);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);

  const ct = (Array.isArray(contentType) ? contentType.join(', ') : String(contentType || '')).toLowerCase();
  
  // Media classifications
  const isImage = ct.startsWith('image/') || ct.includes('svg');
  const isVideo = ct.startsWith('video/');
  const isAudio = ct.startsWith('audio/');
  const isPdf = ct.includes('pdf');
  const isHtml = ct.includes('html');
  const isXml = ct.includes('xml');
  const isCss = ct.includes('css');
  const isJs = ct.includes('javascript') || ct.includes('typescript') || ct.includes('ecmascript');
  const isYaml = ct.includes('yaml') || ct.includes('yml');
  const isForm = ct.includes('x-www-form-urlencoded') || ct.includes('form-data');
  const isGraphql = ct.includes('graphql') || (typeof body === 'string' && (body.trimStart().startsWith('query') || body.trimStart().startsWith('mutation')));
  const isJson =
    ct.includes('json') ||
    (String(body || '').trimStart().startsWith('{') && String(body || '').trimEnd().endsWith('}')) ||
    (String(body || '').trimStart().startsWith('[') && String(body || '').trimEnd().endsWith(']'));

  // Detect appropriate media source URL (Base64 data URL fallback)
  const mediaDataUrl = useMemo(() => {
    if (!isImage && !isVideo && !isAudio && !isPdf) return '';
    if (bodyBase64) {
      return `data:${contentType || 'application/octet-stream'};base64,${bodyBase64}`;
    }
    if (body && (isImage || isPdf)) {
      // If body is already base64 or raw
      if (body.startsWith('data:') || body.length > 50) {
        return body.startsWith('data:') ? body : `data:${contentType || 'image/png'};base64,${body}`;
      }
    }
    return '';
  }, [isImage, isVideo, isAudio, isPdf, bodyBase64, body, contentType]);

  // Determine effective syntax language for Monaco editor
  const detectedLanguage = useMemo(() => {
    if (format !== 'auto') {
      if (format === 'hex' || format === 'preview') return 'plaintext';
      return format;
    }
    if (isJson) return 'json';
    if (isGraphql) return 'graphql';
    if (isXml) return 'xml';
    if (isHtml) return 'html';
    if (isCss) return 'css';
    if (isJs) return 'javascript';
    if (isYaml) return 'yaml';
    return 'plaintext';
  }, [format, isJson, isGraphql, isXml, isHtml, isCss, isJs, isYaml]);

  // Formatted content for display / copy
  const formattedContent = useMemo(() => {
    if (!body) return '';

    if (format === 'hex') {
      return toHexDump(body);
    }

    if (detectedLanguage === 'json') {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch (_) {
        return body;
      }
    }

    if (detectedLanguage === 'form' || (format === 'auto' && isForm)) {
      try {
        const params = new URLSearchParams(body);
        const entries: string[] = [];
        params.forEach((v, k) => entries.push(`${k} = ${decodeURIComponent(v)}`));
        return entries.length > 0 ? entries.join('\n') : body;
      } catch (_) {
        return body;
      }
    }

    return body;
  }, [body, format, detectedLanguage, isForm]);

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
      toast.success(t.success, 'XML formatted');
    } else {
      toast.info('Auto-detection active');
    }
  }, [isJson, isXml, t]);

  const handleDownload = useCallback(() => {
    let blob: Blob;
    let filename = `${title.toLowerCase().replace(/\s+/g, '_')}_body`;

    if (isImage && bodyBase64) {
      const byteChars = atob(bodyBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const ext = ct.split('/')[1]?.split(';')[0] || 'png';
      blob = new Blob([new Uint8Array(byteNums)], { type: contentType || 'image/png' });
      filename += `.${ext}`;
    } else {
      const ext = isJson ? '.json' : isXml ? '.xml' : isHtml ? '.html' : isPdf ? '.pdf' : '.txt';
      blob = new Blob([formattedContent], { type: contentType || 'text/plain' });
      filename += ext;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started', filename);
  }, [formattedContent, contentType, title, isImage, bodyBase64, ct, isJson, isXml, isHtml, isPdf]);

  if (!body && !isImage && !isVideo && !isAudio && !isPdf && !bodyBase64) {
    return (
      <div
        className="rounded-2xl border p-6 text-center text-gray-400 text-xs italic bg-white dark:bg-gray-900"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        No body payload
      </div>
    );
  }

  // Auto-switch to preview for rich media
  const isMedia = isImage || isVideo || isAudio || isPdf;
  const isPreviewMode = format === 'preview' || (format === 'auto' && isMedia);

  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-xs text-xs flex flex-col bg-white dark:bg-gray-900 transition-all"
      style={{
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      {/* Top Controls Bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2 bg-gray-50/80 dark:bg-gray-800/40 border-b select-none shrink-0"
        style={{ borderColor: 'var(--md-sys-color-divider)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 dark:text-gray-200">{title} Payload</span>
          <span className="text-[10px] text-gray-400 font-mono">
            ({bodySize || body.length} bytes)
          </span>

          {isImage && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Image {imageDimensions && `(${imageDimensions.w}×${imageDimensions.h})`}
            </span>
          )}
          {isVideo && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <Video className="w-3 h-3" /> Video Stream
            </span>
          )}
          {isAudio && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <Music className="w-3 h-3" /> Audio Track
            </span>
          )}
          {isPdf && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <FileText className="w-3 h-3" /> PDF Document
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Explicit Format Selector Pills */}
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFormat('auto')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                format === 'auto'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Auto-detect data format based on content-type and payload"
            >
              Auto ({detectedLanguage})
            </button>
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                format === 'json'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setFormat('text')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                format === 'text'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Raw
            </button>
            {isForm && (
              <button
                type="button"
                onClick={() => setFormat('form')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  format === 'form'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Form
              </button>
            )}
            <button
              type="button"
              onClick={() => setFormat('hex')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                format === 'hex'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Hex
            </button>
            {isMedia && (
              <button
                type="button"
                onClick={() => setFormat('preview')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  format === 'preview'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-600 hover:text-purple-900 dark:hover:text-purple-300'
                }`}
              >
                Preview
              </button>
            )}
          </div>

          {isImage && isPreviewMode && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setImageZoom((z) => Math.max(z - 0.25, 0.25))}
                className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold px-1">{Math.round(imageZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setImageZoom((z) => Math.min(z + 0.25, 4))}
                className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setImageZoom(1)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleBeautify}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Auto-format / Beautify"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </button>

          <button
            type="button"
            onClick={() => setIsWrap(!isWrap)}
            className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
              isWrap ? 'text-blue-500' : 'text-gray-400'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Copy Body"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-white"
            title="Download Media / Body"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body / Media Renderer */}
      <div className="p-3">
        {isPreviewMode && isImage ? (
          /* Image Preview with Zoom & Transparency Checkerboard */
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] overflow-auto max-h-[460px] gap-3">
            <img
              src={mediaDataUrl || `data:${contentType};base64,${body}`}
              alt="Preview"
              style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className="max-h-80 max-w-full object-contain rounded-lg shadow-md transition-transform duration-100"
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save / Download Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mediaDataUrl || `data:${contentType};base64,${body}`);
                  toast.success('Image Data URL Copied');
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Data URL</span>
              </button>
            </div>
          </div>
        ) : isPreviewMode && isVideo ? (
          /* Video Player */
          <div className="flex flex-col items-center justify-center p-4 bg-black rounded-xl overflow-hidden gap-3">
            <video
              controls
              src={mediaDataUrl}
              className="max-h-80 max-w-full rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save / Download Video</span>
            </button>
          </div>
        ) : isPreviewMode && isAudio ? (
          /* Audio Player */
          <div className="p-6 bg-gray-50 dark:bg-gray-800/60 rounded-xl flex flex-col items-center gap-3">
            <Music className="w-10 h-10 text-emerald-500" />
            <audio controls src={mediaDataUrl} className="w-full max-w-md">
              Your browser does not support the audio tag.
            </audio>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save / Download Audio</span>
            </button>
          </div>
        ) : isPreviewMode && isPdf ? (
          /* PDF Viewer */
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save / Download PDF</span>
              </button>
            </div>
            <div className="h-96 rounded-xl border overflow-hidden">
              <iframe src={mediaDataUrl} title="PDF Preview" className="w-full h-full" />
            </div>
          </div>
        ) : format === 'hex' ? (
          /* Hex Dump Matrix */
          <pre className="font-mono text-[11px] bg-slate-900 text-emerald-400 p-3.5 rounded-xl overflow-x-auto max-h-96 leading-relaxed select-all">
            {formattedContent}
          </pre>
        ) : format === 'html' && isHtml ? (
          /* Sandboxed HTML Render Frame */
          <div className="h-96 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white">
            <iframe
              sandbox="allow-same-origin"
              srcDoc={body}
              title="HTML Render Preview"
              className="w-full h-full"
            />
          </div>
        ) : (
          /* Monaco Editor with Syntax Highlighting */
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-2xs h-72">
            <Editor
              height="100%"
              theme={monacoTheme}
              language={detectedLanguage}
              value={formattedContent}
              options={{
                readOnly: true,
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                wordWrap: isWrap ? 'on' : 'off',
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
