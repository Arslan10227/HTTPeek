import React from 'react';
import { AlertTriangle, AlertCircle, Info, HelpCircle } from 'lucide-react';
import { useConfirmStore } from '../../store/useConfirmDialog';
import { Dialog } from '../ui/Dialog';

export const ConfirmModal: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();

  if (!isOpen) return null;

  const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' } = options;

  const getIconMeta = () => {
    switch (type) {
      case 'danger':
        return { icon: <AlertCircle className="w-5 h-5" />, color: '#f87171' };
      case 'warning':
        return { icon: <AlertTriangle className="w-5 h-5" />, color: '#fbbf24' };
      case 'info':
        return { icon: <Info className="w-5 h-5" />, color: '#60a5fa' };
      default:
        return { icon: <HelpCircle className="w-5 h-5" />, color: '#c084fc' };
    }
  };

  const getConfirmStyle = (): React.CSSProperties => {
    switch (type) {
      case 'danger':
        return { backgroundColor: '#ef4444', color: '#fff' };
      case 'warning':
        return { backgroundColor: '#f59e0b', color: '#fff' };
      case 'info':
        return { backgroundColor: '#3b82f6', color: '#fff' };
      default:
        return { backgroundColor: '#a855f7', color: '#fff' };
    }
  };

  const { icon, color } = getIconMeta();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      icon={icon}
      iconColor={color}
      maxWidth="max-w-md"
      closeOnOverlay
      footer={
        <>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-ghost text-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-full text-sm font-bold cursor-pointer transition-all hover:opacity-90 active:scale-95"
            style={getConfirmStyle()}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p
        className="text-sm leading-relaxed whitespace-pre-line"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {message}
      </p>
    </Dialog>
  );
};
