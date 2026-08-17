import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Globe, Folder, FileCode } from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { LottiePlayer } from '../common/LottiePlayer';
import { HttpRequest } from '../../types';

interface TreeNode {
  name: string;
  fullPath: string;
  children: Record<string, TreeNode>;
  requests: HttpRequest[];
}

export const DomainTreeView: React.FC = () => {
  const { requests, favorites, selectedRequestId, selectRequest, searchQuery, activeTab } = useProxyStore();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Build tree from requests
  const tree = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    const sourceList = activeTab === 'favorites' ? favorites : requests;

    sourceList.forEach((req) => {
      const urlStr = typeof req.url === 'string' ? req.url : String(req.url || '');
      if (searchQuery && !urlStr.toLowerCase().includes(searchQuery.toLowerCase())) {
        return;
      }

      const host = req.hostPort?.host || 'unknown';
      if (!root[host]) {
        root[host] = {
          name: host,
          fullPath: host,
          children: {},
          requests: [],
        };
      }

      const pathStr = typeof req.path === 'string' ? req.path : String(req.path || '');
      const pathParts = pathStr.split('/').filter(Boolean);
      let current = root[host];

      pathParts.forEach((part) => {
        const currentPath = `${current.fullPath}/${part}`;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            fullPath: currentPath,
            children: {},
            requests: [],
          };
        }
        current = current.children[part];
      });

      current.requests.push(req);
    });

    return root;
  }, [requests, favorites, activeTab, searchQuery]);

  const getMethodBadge = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'POST': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PUT': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PATCH': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = Object.keys(node.children).length > 0 || node.requests.length > 0;
    const isExpanded = expandedNodes[node.fullPath] ?? depth === 0;

    return (
      <div key={node.fullPath} className="text-xs select-none">
        <div
          onClick={() => toggleNode(node.fullPath)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className="flex items-center gap-1.5 py-1.5 hover:bg-slate-100 cursor-pointer rounded-lg text-slate-700 transition-colors"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )
          ) : (
            <div className="w-3.5" />
          )}

          {depth === 0 ? (
            <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}

          <span className="font-semibold truncate flex-1">{node.name}</span>

          {node.requests.length > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-full mr-2 font-mono">
              {node.requests.length}
            </span>
          )}
        </div>

        {isExpanded && (
          <div>
            {Object.values(node.children).map((child) => renderNode(child, depth + 1))}
            {node.requests.map((req) => {
              const isSelected = selectedRequestId === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => selectRequest(req.id)}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 14}px` }}
                  className={`flex items-center gap-2 py-1.5 cursor-pointer rounded-lg transition-colors text-[11px] font-mono select-none ${
                    isSelected
                      ? 'bg-emerald-50 text-slate-900 border-l-3 border-l-emerald-600 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileCode className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className={`font-bold text-[9px] px-1.5 py-0.2 rounded border ${getMethodBadge(req.method)}`}>
                    {req.method}
                  </span>
                  <span className="truncate flex-1 font-sans">{req.path}</span>
                  <span className={`text-[10px] font-bold mr-2 ${
                    req.response?.statusCode && req.response.statusCode < 400 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {req.response?.statusCode || '...'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white overflow-y-auto p-3 font-sans">
      {Object.keys(tree).length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs select-none p-6 text-center">
          <LottiePlayer type="radar" width={90} height={90} className="mb-2" />
          <p className="font-bold text-slate-700 text-sm">No Domains Captured</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">Captured network requests will be organized hierarchically by domain and URL path tree.</p>
        </div>
      ) : (
        Object.values(tree).map((node) => renderNode(node, 0))
      )}
    </div>
  );
};
