import React, { useState, useEffect, useMemo } from 'react';
import { HttpRequest } from '../../types';
import { api } from '../../store/apiAdapter';
import { useAppConfig } from '../../theme/useAppConfig';
import {
  Layers,
  Code,
  Copy,
  Check,
  Search,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle2,
  Cpu,
  CornerDownRight,
  Database,
} from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface GrpcMessage {
  isTrailer?: boolean;
  compressed: boolean;
  length: number;
  decodedJson?: Record<string, any>;
  rawHex?: string;
  trailerText?: string;
}

interface GrpcTabProps {
  request: HttpRequest;
}

export const GrpcTab: React.FC<GrpcTabProps> = ({ request }) => {
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [activeSubTab, setActiveSubTab] = useState<'request' | 'response' | 'trailers'>('response');
  const [reqMessages, setReqMessages] = useState<GrpcMessage[]>([]);
  const [respMessages, setRespMessages] = useState<GrpcMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'json' | 'raw'>('json');

  // Extract gRPC status from headers or trailers
  const grpcStatus = useMemo(() => {
    const headerStatus = request.response?.headers?.['grpc-status']?.[0] ||
      request.response?.headers?.['Grpc-Status']?.[0];
    if (headerStatus !== undefined) {
      return parseInt(headerStatus, 10);
    }
    // Check trailers
    for (const msg of respMessages) {
      if (msg.isTrailer && msg.trailerText) {
        const match = msg.trailerText.match(/grpc-status:\s*(\d+)/i);
        if (match) return parseInt(match[1], 10);
      }
    }
    return request.response?.statusCode === 200 ? 0 : null;
  }, [request, respMessages]);

  const grpcMessageText = useMemo(() => {
    const msg = request.response?.headers?.['grpc-message']?.[0] ||
      request.response?.headers?.['Grpc-Message']?.[0];
    if (msg) return decodeURIComponent(msg);
    for (const m of respMessages) {
      if (m.isTrailer && m.trailerText) {
        const match = m.trailerText.match(/grpc-message:\s*([^\r\n]+)/i);
        if (match) return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [request, respMessages]);

  // Decode request and response gRPC frames
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const decode = async () => {
      try {
        // Request payload
        const reqB64 = request.bodyBase64 || (request.body ? btoa(request.body) : '');
        if (reqB64) {
          const reqParsed = await api.decodeGrpcPayload(reqB64);
          if (isMounted) setReqMessages(reqParsed || []);
        }

        // Response payload
        const respB64 = request.response?.bodyBase64 ||
          (request.response?.body ? btoa(request.response.body) : '');
        if (respB64) {
          const respParsed = await api.decodeGrpcPayload(respB64);
          if (isMounted) setRespMessages(respParsed || []);
        }
      } catch (err) {
        console.warn('Failed to decode gRPC payload:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    decode();
    return () => {
      isMounted = false;
    };
  }, [request]);

  const currentMessages = activeSubTab === 'request' ? reqMessages : respMessages;

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied', 'Decoded Protobuf copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (code: number | null) => {
    if (code === null) return null;
    const isOk = code === 0;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
          isOk
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}
      >
        {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        Status {code} ({isOk ? 'OK' : grpcMessageText || 'ERROR'})
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none font-sans" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Top Bar: Subtabs & Controls */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 flex-wrap gap-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-1.5 bg-neutral-900/40 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveSubTab('request')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'request'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Request ({reqMessages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('response')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'response'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Response ({respMessages.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(grpcStatus)}

          <div className="flex items-center gap-1 bg-neutral-900/40 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'json' ? 'bg-white/15 text-white' : 'text-neutral-400'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'raw' ? 'bg-white/15 text-white' : 'text-neutral-400'
              }`}
            >
              Hex
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(JSON.stringify(currentMessages, null, 2))}
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-neutral-300 transition-colors"
            title="Copy messages"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-xs">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400 gap-2">
            <Activity className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Decoding Protobuf Wire...</span>
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-2 p-8 text-center">
            <Cpu className="w-8 h-8 text-neutral-600" />
            <p className="font-semibold text-sm">No gRPC messages in this frame</p>
            <p className="text-xs text-neutral-500">The payload might be empty or uncompressed raw binary.</p>
          </div>
        ) : (
          currentMessages.map((msg, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-xl border overflow-hidden shadow-xs"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              {/* Message Header */}
              <div
                className="flex items-center justify-between px-3.5 py-2 border-b text-[11px]"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                    style={{
                      backgroundColor: `${activeColor.hex}1F`,
                      color: activeColor.hex,
                    }}
                  >
                    Message #{idx + 1}
                  </span>
                  {msg.isTrailer && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400">
                      TRAILER
                    </span>
                  )}
                  {msg.compressed && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400">
                      GZIP COMPRESSED
                    </span>
                  )}
                </div>
                <span className="text-neutral-400 text-[10px]">
                  Length: {msg.length} bytes
                </span>
              </div>

              {/* Message Body */}
              <div className="p-3.5 overflow-x-auto">
                {msg.isTrailer && msg.trailerText ? (
                  <pre className="text-amber-300 whitespace-pre-wrap">{msg.trailerText}</pre>
                ) : viewMode === 'raw' ? (
                  <pre className="text-neutral-400 break-all whitespace-pre-wrap leading-relaxed">
                    {msg.rawHex || 'No hex available'}
                  </pre>
                ) : msg.decodedJson ? (
                  <pre className="text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(msg.decodedJson, null, 2)}
                  </pre>
                ) : (
                  <div className="text-neutral-500 italic">Could not decode structured protobuf wire fields.</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
