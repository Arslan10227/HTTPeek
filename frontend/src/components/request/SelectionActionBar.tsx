import React from 'react';
import { Play, Download, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';

interface SelectionActionBarProps {
  selectedCount: number;
  onRepeat: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  selectedCount,
  onRepeat,
  onExport,
  onDelete,
  onClearSelection,
}) => {
  const { t } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  if (selectedCount === 0) return null;

  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 border-b text-xs select-none animate-in fade-in slide-in-from-top-1 duration-100"
      style={{
        backgroundColor: activeColor.primaryContainer,
        color: activeColor.onPrimaryContainer,
        borderColor: 'var(--md-sys-color-divider)',
      }}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span>Selected {selectedCount} items</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRepeat}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 font-medium cursor-pointer shadow-2xs transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{t.repeat}</span>
        </button>

        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 font-medium cursor-pointer shadow-2xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.exportHAR}</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 font-medium cursor-pointer text-red-600 dark:text-red-400 shadow-2xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.delete}</span>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
          title={t.close}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
