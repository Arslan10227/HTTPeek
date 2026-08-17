import React from 'react';
import { useToastStore, ToastItem } from '../../store/useToastStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useAppConfig } from '../../theme/useAppConfig';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none font-sans select-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const getStyleAndIcon = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
          borderClass: 'border-green-200 dark:border-green-900/60 bg-green-50/95 dark:bg-green-950/80 text-green-950 dark:text-green-100',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
          borderClass: 'border-red-200 dark:border-red-900/60 bg-red-50/95 dark:bg-red-950/80 text-red-950 dark:text-red-100',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
          borderClass: 'border-amber-200 dark:border-amber-900/60 bg-amber-50/95 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: activeColor.hex }} />,
          borderClass: 'border-blue-200 dark:border-blue-900/60 bg-blue-50/95 dark:bg-blue-950/80 text-blue-950 dark:text-blue-100',
        };
    }
  };

  const config = getStyleAndIcon();

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${config.borderClass}`}
    >
      {config.icon}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-xs font-bold leading-tight">{toast.title}</h4>
        {toast.message && (
          <p className="text-[11px] mt-0.5 leading-snug break-words opacity-90">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
