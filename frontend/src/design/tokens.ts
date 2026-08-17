export const methodColors: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  POST: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PUT: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  DELETE: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  PATCH: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  HEAD: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  OPTIONS: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  CONNECT: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  TRACE: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

export const defaultMethodColor = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

export function getMethodColor(method: string) {
  return methodColors[method?.toUpperCase()] || defaultMethodColor;
}

export function getStatusColor(code?: number): { text: string; bg: string; border: string } {
  if (!code) return { text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' };
  if (code >= 200 && code < 300) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (code >= 300 && code < 400) return { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' };
  if (code >= 400 && code < 500) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
}

export const spacing = {
  rowHeight: 44,
  rowHeightMobile: 84,
  splitMinLeft: 280,
  splitMinRight: 320,
  drawerWidth: 480,
  sidebarWidth: 56,
  statusBarHeight: 32,
  pageHeaderHeight: 44,
} as const;

/** HTTP Toolkit–inspired chrome palette */
export const chrome = {
  sidebarBg: '#2b2d42',
  sidebarBorder: '#3d4058',
  sidebarText: '#a8b0c8',
  sidebarTextActive: '#ffffff',
  sidebarAccent: '#4a90e2',
  statusBarBg: '#252836',
  statusBarText: '#c8cdd8',
  statusBarBorder: '#3d4058',
  statusRunning: '#50c878',
  statusStopped: '#8b93a8',
  mainBg: '#f4f5f7',
  panelBg: '#ffffff',
} as const;
