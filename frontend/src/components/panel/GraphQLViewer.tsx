import React, { useState, useMemo } from 'react';
import {
  Code2,
  Play,
  Copy,
  Check,
  Braces,
  AlertTriangle,
  Send,
  Layers,
  Sparkles,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { HttpRequest, HttpResponse } from '../../types';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';

interface GraphQLViewerProps {
  request: HttpRequest;
  response?: HttpResponse | null;
  onOpenComposer?: (req: HttpRequest) => void;
}

export function parseGraphQLPayload(bodyStr?: string): {
  query: string;
  variables: string;
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription' | 'unknown';
} | null {
  if (!bodyStr || typeof bodyStr !== 'string') return null;
  const trimmed = bodyStr.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.query === 'string') {
      const q = parsed.query.trim();
      let opType: 'query' | 'mutation' | 'subscription' | 'unknown' = 'unknown';
      if (q.startsWith('mutation')) opType = 'mutation';
      else if (q.startsWith('subscription')) opType = 'subscription';
      else if (q.startsWith('query') || q.startsWith('{')) opType = 'query';

      let vars = '';
      if (parsed.variables) {
        vars = typeof parsed.variables === 'string' ? parsed.variables : JSON.stringify(parsed.variables, null, 2);
      }

      return {
        query: q,
        variables: vars,
        operationName: parsed.operationName || extractOperationName(q),
        operationType: opType,
      };
    }
  } catch (_) {
    // Might be raw GraphQL query string
    if (trimmed.startsWith('query') || trimmed.startsWith('mutation') || trimmed.startsWith('subscription') || (trimmed.startsWith('{') && trimmed.includes('}'))) {
      let opType: 'query' | 'mutation' | 'subscription' | 'unknown' = 'query';
      if (trimmed.startsWith('mutation')) opType = 'mutation';
      else if (trimmed.startsWith('subscription')) opType = 'subscription';

      return {
        query: trimmed,
        variables: '',
        operationName: extractOperationName(trimmed),
        operationType: opType,
      };
    }
  }
  return null;
}

function extractOperationName(query: string): string {
  const match = query.match(/(?:query|mutation|subscription)\s+([A-Za-z0-9_]+)/);
  return match ? match[1] : 'Anonymous';
}

export const GraphQLViewer: React.FC<GraphQLViewerProps> = ({
  request,
  response,
  onOpenComposer,
}) => {
  const { monacoTheme } = useThemeStore();
  const [activeSubTab, setActiveSubTab] = useState<'query' | 'variables' | 'response'>('query');

  const gqlData = useMemo(() => {
    return parseGraphQLPayload(request.bodyString || request.body);
  }, [request]);

  const parsedResponse = useMemo(() => {
    if (!response?.bodyString && !response?.body) return null;
    const raw = response.bodyString || (typeof response.body === 'string' ? response.body : '');
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }, [response]);

  const hasErrors = parsedResponse && Array.isArray(parsedResponse.errors) && parsedResponse.errors.length > 0;

  if (!gqlData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 text-xs">
        <Code2 className="w-8 h-8 opacity-40 mb-2" />
        <span>No GraphQL query or mutation detected in this request.</span>
      </div>
    );
  }

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-slate-50 dark:bg-gray-950 font-sans text-xs">
      {/* Top Header Bar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
              gqlData.operationType === 'mutation'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : gqlData.operationType === 'subscription'
                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
            }`}
          >
            {gqlData.operationType}
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm font-mono">
            {gqlData.operationName}
          </span>
          {hasErrors && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>{parsedResponse.errors.length} GraphQL Error(s)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenComposer && (
            <button
              type="button"
              onClick={() => onOpenComposer(request)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 cursor-pointer border border-blue-200 dark:border-blue-800 transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Open in Composer</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleCopy(gqlData.query, 'GraphQL Query Copied')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span>Copy Query</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('query')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeSubTab === 'query'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Query / Mutation
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('variables')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeSubTab === 'variables'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Variables {gqlData.variables ? '(1)' : '(0)'}
          </button>
          {response && (
            <button
              type="button"
              onClick={() => setActiveSubTab('response')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeSubTab === 'response'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Response Data {hasErrors && '⚠️'}
            </button>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 p-3 min-h-0 flex flex-col">
        {activeSubTab === 'query' && (
          <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-gray-900">
            <Editor
              height="100%"
              theme={monacoTheme}
              language="graphql"
              value={gqlData.query}
              options={{
                readOnly: true,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}

        {activeSubTab === 'variables' && (
          <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-gray-900">
            {gqlData.variables ? (
              <Editor
                height="100%"
                theme={monacoTheme}
                language="json"
                value={gqlData.variables}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No variables provided for this GraphQL operation.
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'response' && parsedResponse && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {hasErrors && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1">
                <span className="font-bold text-rose-700 dark:text-rose-300">Errors:</span>
                {parsedResponse.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                    • {err.message || JSON.stringify(err)}
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-gray-900">
              <Editor
                height="100%"
                theme={monacoTheme}
                language="json"
                value={JSON.stringify(parsedResponse.data || parsedResponse, null, 2)}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
