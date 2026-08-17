import { create } from 'zustand';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'question';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolvePromise?: (value: boolean) => void;
  showConfirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: {
    title: 'Confirm Action',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
  },
  resolvePromise: undefined,

  showConfirm: (opts: ConfirmOptions | string) => {
    const options: ConfirmOptions =
      typeof opts === 'string'
        ? { message: opts, title: 'Confirm', type: 'warning' }
        : {
            title: opts.title || 'Confirm',
            message: opts.message,
            confirmText: opts.confirmText || 'Confirm',
            cancelText: opts.cancelText || 'Cancel',
            type: opts.type || 'warning',
          };

    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options,
        resolvePromise: resolve,
      });
    });
  },

  handleConfirm: () => {
    const { resolvePromise } = get();
    if (resolvePromise) resolvePromise(true);
    set({ isOpen: false, resolvePromise: undefined });
  },

  handleCancel: () => {
    const { resolvePromise } = get();
    if (resolvePromise) resolvePromise(false);
    set({ isOpen: false, resolvePromise: undefined });
  },
}));

/**
 * Global helper to show a confirmation dialog.
 * Usage:
 * const ok = await confirm({
 *   title: 'Reset Root CA',
 *   message: 'Are you sure you want to regenerate the Root Certificate Authority?',
 *   type: 'danger',
 *   confirmText: 'Regenerate',
 * });
 * if (!ok) return;
 */
export const confirm = (opts: ConfirmOptions | string): Promise<boolean> => {
  return useConfirmStore.getState().showConfirm(opts);
};
