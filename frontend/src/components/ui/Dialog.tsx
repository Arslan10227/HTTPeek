import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  /** If true, clicking the overlay closes the dialog */
  closeOnOverlay?: boolean;
  /** Extra class name for the panel */
  className?: string;
}

/**
 * Shared Dialog primitive.
 * Handles: overlay click-to-close, Escape key, scale-in animation, aria-modal, focus trap.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconColor = 'var(--color-primary)',
  footer,
  children,
  maxWidth = 'max-w-lg',
  closeOnOverlay = true,
  className = '',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: focus first focusable element when dialog opens
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      requestAnimationFrame(() => focusable[0].focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlay && e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="dialog-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className={`dialog-panel w-full ${maxWidth} ${className}`}
      >
        {/* Header */}
        {(title || icon) && (
          <div className="dialog-header">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                  style={{ background: `color-mix(in srgb, ${iconColor} 15%, transparent)`, color: iconColor }}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h2 className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--color-text)' }}>
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-icon shrink-0 ml-3"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="dialog-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="dialog-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable form label for dialog forms.
 */
export const FormLabel: React.FC<{ label: string; htmlFor?: string; required?: boolean; hint?: string }> = ({
  label,
  htmlFor,
  required,
  hint,
}) => (
  <label
    htmlFor={htmlFor}
    className="block text-xs font-semibold mb-1.5"
    style={{ color: 'var(--color-text-muted)' }}
  >
    {label}
    {required && <span className="text-rose-500 ml-0.5">*</span>}
    {hint && (
      <span className="font-normal ml-1.5" style={{ color: 'var(--color-text-subtle)' }}>
        {hint}
      </span>
    )}
  </label>
);

/**
 * Styled input for use inside dialogs.
 */
export const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`input-base ${props.className ?? ''}`}
  />
);

/**
 * Monospace code/URL/regex input for use inside dialogs.
 */
export const FormMonospaceInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`input-base font-mono text-xs ${props.className ?? ''}`}
  />
);

/**
 * Styled select for use inside dialogs.
 */
export const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...props }) => (
  <select
    {...props}
    className={`input-base appearance-none cursor-pointer ${props.className ?? ''}`}
  >
    {children}
  </select>
);

/**
 * Styled textarea for use inside dialogs.
 */
export const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    className={`input-base resize-none ${props.className ?? ''}`}
  />
);

/**
 * Section divider with label inside dialogs.
 */
export const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <span className="section-label shrink-0">{title}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
    </div>
    {children}
  </div>
);
