import React from 'react';

export type IconName = 
  | 'capture' 
  | 'favorites' 
  | 'history' 
  | 'rules' 
  | 'toolbox' 
  | 'settings' 
  | 'play' 
  | 'stop' 
  | 'shield-ssl' 
  | 'system-proxy' 
  | 'trash' 
  | 'composer' 
  | 'filter' 
  | 'logs' 
  | 'palette' 
  | 'mobile' 
  | 'cloud'
  | 'layers'
  | 'code'
  | 'rocket'
  | 'lock'
  | 'check'
  | 'alert'
  | 'speed'
  | 'search';

interface ColorfulIconProps {
  name: IconName;
  size?: number;
  className?: string;
  animate?: boolean;
}

export const ColorfulIcon: React.FC<ColorfulIconProps> = ({ 
  name, 
  size = 20, 
  className = '', 
  animate = false 
}) => {
  const s = size;

  switch (name) {
    case 'capture':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <circle cx="12" cy="12" r="10" fill="url(#grad-emerald)" opacity="0.15" />
          <circle cx="12" cy="12" r="7" stroke="#10b981" strokeWidth="1.8" strokeDasharray="3 2" className={animate ? 'animate-spin' : ''} style={{ transformOrigin: 'center' }} />
          <circle cx="12" cy="12" r="3.5" fill="#059669" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
          <defs>
            <linearGradient id="grad-emerald" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'favorites':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#grad-gold)" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="1.5" fill="#fff" opacity="0.8" />
          <defs>
            <linearGradient id="grad-gold" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'history':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <circle cx="12" cy="12" r="9" fill="url(#grad-indigo)" opacity="0.15" stroke="#6366f1" strokeWidth="1.6" />
          <polyline points="12 7 12 12 15 15" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" />
          <polygon points="19 3 19 7 15 7" fill="#4f46e5" />
          <defs>
            <linearGradient id="grad-indigo" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8" />
              <stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'rules':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <rect x="3" y="4" width="18" height="4" rx="2" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="8" cy="6" r="2.5" fill="#059669" />
          <rect x="3" y="10" width="18" height="4" rx="2" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
          <circle cx="16" cy="12" r="2.5" fill="#2563eb" />
          <rect x="3" y="16" width="18" height="4" rx="2" fill="#fdf2f8" stroke="#ec4899" strokeWidth="1.5" />
          <circle cx="10" cy="18" r="2.5" fill="#db2777" />
        </svg>
      );

    case 'toolbox':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <rect x="3" y="7" width="18" height="13" rx="3" fill="url(#grad-amber)" opacity="0.2" stroke="#d97706" strokeWidth="1.5" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 11v3M9 13h6" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <circle cx="6" cy="10" r="1" fill="#f59e0b" />
          <circle cx="18" cy="10" r="1" fill="#f59e0b" />
          <defs>
            <linearGradient id="grad-amber" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fde68a" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'settings':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <circle cx="12" cy="12" r="3.2" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="#f8fafc" />
        </svg>
      );

    case 'play':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <circle cx="12" cy="12" r="10" fill="url(#grad-play)" />
          <polygon points="10 8 16 12 10 16 10 8" fill="#ffffff" />
          <defs>
            <linearGradient id="grad-play" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10b981" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'stop':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <circle cx="12" cy="12" r="10" fill="url(#grad-stop)" />
          <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" fill="#ffffff" />
          <defs>
            <linearGradient id="grad-stop" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ef4444" />
              <stop offset="1" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'shield-ssl':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <path d="M12 2l7 3v6c0 5.25-3.5 10-7 11-3.5-1-7-5.75-7-11V5l7-3z" fill="url(#grad-shield)" stroke="#059669" strokeWidth="1.5" />
          <path d="M9 12l2 2 4-4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="grad-shield" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'system-proxy':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <rect x="2" y="3" width="20" height="14" rx="2" fill="url(#grad-sys)" stroke="#4f46e5" strokeWidth="1.5" />
          <line x1="8" y1="21" x2="16" y2="21" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="10" r="3" fill="#ffffff" opacity="0.9" />
          <defs>
            <linearGradient id="grad-sys" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8" />
              <stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'trash':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="11" x2="10" y2="17" stroke="#fb7185" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="14" y1="11" x2="14" y2="17" stroke="#fb7185" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'composer':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill="#f43f5e" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" fill="url(#grad-rocket)" stroke="#db2777" strokeWidth="1.5" />
          <circle cx="15.5" cy="8.5" r="1.5" fill="#ffffff" />
          <defs>
            <linearGradient id="grad-rocket" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f472b6" />
              <stop offset="1" stopColor="#db2777" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'filter':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" fill="url(#grad-cyan)" opacity="0.25" stroke="#0891b2" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="7" r="2" fill="#06b6d4" />
          <defs>
            <linearGradient id="grad-cyan" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67e8f9" />
              <stop offset="1" stopColor="#0891b2" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'logs':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <rect x="2" y="3" width="20" height="18" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <polyline points="6 9 9 12 6 15" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="15" x2="17" y2="15" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'palette':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <path d="M12 2C6.49 2 2 6.49 2 12c0 5.06 3.79 9.24 8.68 9.91.55.08.82-.24.82-.53v-1.92c0-.52.26-1 .7-1.28l1.37-.87c.72-.45 1.16-1.24 1.16-2.09 0-1.38 1.12-2.5 2.5-2.5h1.27c1.93 0 3.5-1.57 3.5-3.5C22 6.13 17.51 2 12 2z" fill="#f8fafc" stroke="#6366f1" strokeWidth="1.6" />
          <circle cx="7.5" cy="8.5" r="1.5" fill="#ef4444" />
          <circle cx="12" cy="6.5" r="1.5" fill="#f59e0b" />
          <circle cx="16.5" cy="8.5" r="1.5" fill="#10b981" />
          <circle cx="18" cy="13" r="1.5" fill="#3b82f6" />
        </svg>
      );

    case 'mobile':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={`shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}>
          <rect x="5" y="2" width="14" height="20" rx="3" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.8" />
          <line x1="10" y1="19" x2="14" y2="19" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="5" r="1" fill="#38bdf8" />
        </svg>
      );

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#64748b" strokeWidth="1.5" />
        </svg>
      );
  }
};
