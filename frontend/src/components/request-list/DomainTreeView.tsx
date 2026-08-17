import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Folder,
  FileCode,
  Download,
  Upload,
  Copy,
  Trash2,
  ExternalLink,
  Layers,
  FileJson,
  FileSpreadsheet,
  Terminal,
  MoreVertical
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { LottiePlayer } from '../common/LottiePlayer';
import { HttpRequest } from '../../types';
import { exportRequests, importHarOrJsonFile, ExportFormat } from '../../utils/exportHelper';
import { toast } from '../../store/useToastStore';
import { ExportModal } from '../common/ExportModal';

interface TreeNode {
  name: string;
  fullPath: string;
  children: Record<string, TreeNode>;
  requests: HttpRequest[];
}

export const DomainTreeView: React.FC = () => {
  const { requests, favorites, selectedRequestId, selectRequest, searchQuery, activeTab, deleteRequest } = useProxyStore();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [blinkingDomains, setBlinkingDomains] = useState<Record<string, number>>({});
  const lastRequestCountRef = useRef<number>(requests.length);
  const lastRequestIdRef = useRef<string | null>(requests.length > 0 ? requests[requests.length - 1].id : null);

  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    domain?: string;
    selectedRequests?: HttpRequest[];
  }>({ isOpen: false });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'domain' | 'request';
    domainName?: string;
    domainRequests?: HttpRequest[];
    request?: HttpRequest;
  } | null>(null);

  const [activeExportMenu, setActiveExportMenu] = useState<string | null>(null);

  // Detect when new traffic arrives or updates to blink the specific domain
  useEffect(() => {
    if (requests.length > 0) {
      const latest = requests[requests.length - 1];
      if (latest && latest.id !== lastRequestIdRef.current) {
        lastRequestIdRef.current = latest.id;
        const host = latest.hostPort?.host || 'unknown';
        const now = Date.now();
        setBlinkingDomains((prev) => ({ ...prev, [host]: now }));

        // Clear blink after 1.5 seconds
        const timer = setTimeout(() => {
          setBlinkingDomains((prev) => {
            const next = { ...prev };
            if (next[host] === now) {
              delete next[host];
            }
            return next;
          });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [requests]);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setActiveExportMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    Object.keys(tree).forEach((k) => (all[k] = true));
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Collect all requests recursively under a node
  const collectNodeRequests = (node: TreeNode): HttpRequest[] => {
    let list = [...node.requests];
    Object.values(node.children).forEach((c) => {
      list = list.concat(collectNodeRequests(c));
    });
    return list;
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

  const handleExportDomain = (domainName: string, domainReqs: HttpRequest[], format: ExportFormat) => {
    exportRequests(domainReqs, format, `domain_${domainName}`);
  };

  const handleDomainContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    const reqs = collectNodeRequests(node);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'domain',
      domainName: node.name,
      domainRequests: reqs,
    });
  };

  const handleRequestContextMenu = (e: React.MouseEvent, req: HttpRequest) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'request',
      request: req,
    });
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = Object.keys(node.children).length > 0 || node.requests.length > 0;
    const isExpanded = expandedNodes[node.fullPath] ?? false;
    const isDomainRoot = depth === 0;
    const isBlinking = isDomainRoot && Boolean(blinkingDomains[node.name]);
    const allDomainRequests = isDomainRoot ? collectNodeRequests(node) : [];

    return (
      <div key={node.fullPath} className="text-xs select-none">
        <div
          onClick={() => toggleNode(node.fullPath)}
          onContextMenu={(e) => isDomainRoot ? handleDomainContextMenu(e, node) : undefined}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center gap-1.5 py-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer rounded-lg text-slate-700 dark:text-gray-200 transition-all ${
            isDomainRoot ? 'font-bold bg-slate-50/70 dark:bg-gray-800/30 my-0.5 border-y border-slate-100 dark:border-gray-800' : ''
          } ${isBlinking ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 text-amber-950 dark:text-amber-200 shadow-sm animate-pulse' : ''}`}
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

          {isDomainRoot ? (
            <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}

          <span className="truncate flex-1 font-mono text-[11px]">{node.name}</span>

          {/* Request Count Badge */}
          {isDomainRoot ? (
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded-full font-mono">
              {allDomainRequests.length}
            </span>
          ) : node.requests.length > 0 ? (
            <span className="text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-500 border border-slate-200 dark:border-gray-700 px-1.5 py-0.2 rounded-full font-mono">
              {node.requests.length}
            </span>
          ) : null}

          {/* Domain Quick Export Dropdown Action */}
          {isDomainRoot && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setActiveExportMenu(activeExportMenu === node.fullPath ? null : node.fullPath)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded cursor-pointer transition-opacity mr-1"
                title="Export Domain Traffic"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {activeExportMenu === node.fullPath && (
                <div className="absolute right-0 top-6 z-40 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-1 text-[11px] font-sans flex flex-col gap-0.5">
                  <span className="px-2 py-1 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Export {node.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportDomain(node.name, allDomainRequests, 'har');
                      setActiveExportMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>Export as .HAR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportDomain(node.name, allDomainRequests, 'json');
                      setActiveExportMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <FileJson className="w-3.5 h-3.5 text-amber-500" />
                    <span>Export as .JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportDomain(node.name, allDomainRequests, 'csv');
                      setActiveExportMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Export as .CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportDomain(node.name, allDomainRequests, 'sh');
                      setActiveExportMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200"
                  >
                    <Terminal className="w-3.5 h-3.5 text-purple-500" />
                    <span>Export as .SH Script</span>
                  </button>
                </div>
              )}
            </div>
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
                  onContextMenu={(e) => handleRequestContextMenu(e, req)}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 14}px` }}
                  className={`flex items-center gap-2 py-1.5 cursor-pointer rounded-lg transition-colors text-[11px] font-mono select-none ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-white border-l-3 border-l-emerald-600 font-bold'
                      : 'text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <FileCode className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className={`font-bold text-[9px] px-1.5 py-0.2 rounded border ${getMethodBadge(req.method)}`}>
                    {req.method}
                  </span>
                  <span className="truncate flex-1 font-sans">{req.path}</span>
                  <span className={`text-[10px] font-bold mr-2 ${
                    req.response?.statusCode && req.response.statusCode < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
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

  const domainCount = Object.keys(tree).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden font-sans">
      {/* Top Tree Controls Bar */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-950/50 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2 text-gray-500 font-bold text-[11px]">
          <span>{domainCount} Domains</span>
          <span>•</span>
          <span>{requests.length} Requests</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
          >
            Expand
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
          >
            Collapse
          </button>
          <button
            type="button"
            onClick={() => importHarOrJsonFile()}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
            title="Import .HAR or .JSON file"
          >
            <Upload className="w-3 h-3" />
            <span>Import HAR</span>
          </button>
          <button
            type="button"
            onClick={() => setExportModalState({ isOpen: true })}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs"
            title="Export Domain Traffic"
          >
            <Download className="w-3 h-3" />
            <span>Export HAR</span>
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {domainCount === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs select-none p-6 text-center">
            <LottiePlayer type="radar" width={90} height={90} className="mb-2" />
            <p className="font-bold text-slate-700 dark:text-gray-300 text-sm">No Domains Captured</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Captured network requests will be organized hierarchically by domain and URL path tree.
            </p>
          </div>
        ) : (
          Object.values(tree).map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          className="fixed z-50 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-1.5 text-xs font-sans flex flex-col gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'domain' && contextMenu.domainRequests ? (
            <>
              <div className="px-2.5 py-1 text-[10px] font-black uppercase text-gray-400 tracking-wider truncate">
                Domain: {contextMenu.domainName}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleExportDomain(contextMenu.domainName || 'domain', contextMenu.domainRequests!, 'har');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Export Domain as .HAR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportDomain(contextMenu.domainName || 'domain', contextMenu.domainRequests!, 'json');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-500" />
                <span>Export Domain as .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportDomain(contextMenu.domainName || 'domain', contextMenu.domainRequests!, 'csv');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export Domain as .CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportDomain(contextMenu.domainName || 'domain', contextMenu.domainRequests!, 'sh');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-500" />
                <span>Export as .SH cURL Script</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.domainName || '');
                  toast.success('Domain Copied');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-gray-400" />
                <span>Copy Domain Name</span>
              </button>
            </>
          ) : contextMenu.request ? (
            <>
              <button
                type="button"
                onClick={() => {
                  exportRequests([contextMenu.request!], 'har', `request_${contextMenu.request!.id}`);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Export as .HAR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  exportRequests([contextMenu.request!], 'json', `request_${contextMenu.request!.id}`);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-500" />
                <span>Export as .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  exportRequests([contextMenu.request!], 'sh', `request_${contextMenu.request!.id}`);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-500" />
                <span>Export as .SH cURL Script</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.request!.url);
                  toast.success('URL Copied');
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-left font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-gray-400" />
                <span>Copy URL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRequest(contextMenu.request!.id);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-left font-semibold text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Request</span>
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* Advanced Export Modal */}
      {exportModalState.isOpen && (
        <ExportModal
          isOpen={exportModalState.isOpen}
          onClose={() => setExportModalState({ isOpen: false })}
          allRequests={requests}
          activeDomain={exportModalState.domain}
          selectedRequests={exportModalState.selectedRequests}
        />
      )}
    </div>
  );
};
