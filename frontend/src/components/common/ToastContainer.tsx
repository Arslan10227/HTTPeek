import React, { useEffect, useState } from 'react';
import { useToastStore, ToastItem } from '../../store/useToastStore';
import { X, Sparkles, AlertTriangle, ShieldAlert, Check } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-[340px] w-full pointer-events-none font-sans select-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ICON_META: Record<string, { icon: React.ReactNode; bg: string; color: string; border: string; progress: string }> = {
  success: {
    icon: (
      <svg className="w-4 h-4 animate-draw-check" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    bg: 'rgba(16,185,129,0.12)',
    color: '#34d399',
    border: 'rgba(16,185,129,0.25)',
    progress: '#34d399',
  },
  error: {
    icon: <ShieldAlert className="w-4 h-4 animate-shield-wobble" />,
    bg: 'rgba(239,68,68,0.12)',
    color: '#f87171',
    border: 'rgba(239,68,68,0.25)',
    progress: '#f87171',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 animate-warning-pulse" />,
    bg: 'rgba(245,158,11,0.12)',
    color: '#fbbf24',
    border: 'rgba(245,158,11,0.25)',
    progress: '#fbbf24',
  },
  info: {
    icon: <Sparkles className="w-4 h-4 animate-orbital-spin" />,
    bg: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    border: 'rgba(59,130,246,0.25)',
    progress: '#60a5fa',
  },
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [leaving, setLeaving] = useState(false);
  const duration = toast.duration || 4000;
  const meta = ICON_META[toast.type] ?? ICON_META.info;

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => handleDismiss(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 280);
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden flex flex-col rounded-2xl border backdrop-blur-xl shadow-xl ${
        leaving ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      style={{
        background: 'var(--color-surface)',
        borderColor: meta.border,
        boxShadow: `var(--shadow-lg), 0 0 0 1px ${meta.border}`,
      }}
    >
      <div className="flex items-start gap-3 p-3.5 pr-2">
        {/* Animated Icon */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-xl shrink-0 mt-0.5"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4
            className="text-[13px] font-bold leading-tight"
            style={{ color: 'var(--color-text)' }}
          >
            {toast.title}
          </h4>
          {toast.message && (
            <p
              className="text-[11px] mt-1 leading-snug break-words"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {toast.message}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg cursor-pointer opacity-50 hover:opacity-100 transition-opacity shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-[2px]" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full"
          style={{
            background: meta.progress,
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};
