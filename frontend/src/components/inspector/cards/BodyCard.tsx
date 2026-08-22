import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { getHexDump } from '../../../lib/httpFormat';
import { useThemeStore } from '../../../store/useThemeStore';
import { HexViewer } from './HexViewer';

interface BodyCardProps {
  id: string;
  title: string;
  bodyRaw: string;
  formatted: string;
  language: string;
  contentType?: string;
  isImage?: boolean;
}

export const BodyCard: React.FC<BodyCardProps> = ({
  id,
  title,
  bodyRaw,
  formatted,
  language,
  contentType,
  isImage,
}) => {
  const { monacoTheme } = useThemeStore();
  const [viewMode, setViewMode] = useState<'editor' | 'raw' | 'hex'>('editor');
  const [fullscreen, setFullscreen] = useState(false);

  if (!bodyRaw && !formatted) return null;

  const content = (
    <div className={`space-y-2 ${fullscreen ? 'fixed inset-4 z-[60] bg-white p-4 rounded-xl shadow-2xl border flex flex-col' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
          className="text-[10px] font-semibold border border-slate-200 rounded-lg px-2 py-1 cursor-pointer"
        >
          <option value="editor">{language.toUpperCase()}</option>
          <option value="raw">Raw</option>
          <option value="hex">Hex</option>
        </select>
        <button type="button" onClick={() => setFullscreen(!fullscreen)} className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer">
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      {isImage && viewMode === 'editor' ? (
        <img src={`data:${contentType};base64,${bodyRaw}`} alt="response" className="max-h-64 object-contain rounded border" />
      ) : viewMode === 'hex' ? (
        <div className="rounded-lg border border-white/10 overflow-hidden max-h-80">
          <HexViewer data={bodyRaw} />
        </div>
      ) : viewMode === 'raw' ? (
        <pre className="font-mono text-[11px] bg-slate-50 p-3 rounded-lg border overflow-auto max-h-80 select-all whitespace-pre-wrap">{bodyRaw}</pre>
      ) : (
        <div className={`border border-slate-200 rounded-lg overflow-hidden ${fullscreen ? 'flex-1 min-h-[300px]' : 'h-48'}`}>
          <Editor
            height={fullscreen ? '100%' : '192px'}
            theme={monacoTheme}
            language={language}
            value={formatted}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 11, scrollBeyondLastLine: false }}
          />
        </div>
      )}
    </div>
  );

  return (
    <CollapsibleCard id={id} title={title} subtitle={contentType || `${bodyRaw.length} bytes`} defaultOpen>
      {content}
    </CollapsibleCard>
  );
};

export const RequestBodyCard: React.FC<Omit<BodyCardProps, 'id' | 'title'>> = (props) => (
  <BodyCard id="request-body" title="Request Body" {...props} />
);

export const ResponseBodyCard: React.FC<Omit<BodyCardProps, 'id' | 'title'>> = (props) => (
  <BodyCard id="response-body" title="Response Body" {...props} />
);
