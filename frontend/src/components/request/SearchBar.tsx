import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import {
  SearchFilterConditions,
  SearchConditionDialog,
  defaultSearchConditions,
} from './SearchConditionDialog';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  conditions: SearchFilterConditions;
  onConditionsChange: (conds: SearchFilterConditions) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  conditions,
  onConditionsChange,
}) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const activeColor = getActiveColorPreset();

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    // Map active chips to conditions
    const methods = ['GET','POST','PUT','DELETE','PATCH'].filter(m => activeFilters.has(m));
    const newConditions = { ...conditions };
    // If one method is active, set it; if none, clear it
    if (methods.length === 1) newConditions.method = methods[0];
    else newConditions.method = '';
    // Status filter
    const statusFilters = ['2xx','4xx','5xx'].filter(s => activeFilters.has(s));
    if (statusFilters.length === 1) newConditions.statusCode = statusFilters[0];
    else newConditions.statusCode = '';
    onConditionsChange(newConditions);
  }, [activeFilters]);

  const isZh = language.startsWith('zh');

  const hasActiveConditions =
    conditions.method ||
    conditions.statusCode ||
    conditions.contentType ||
    conditions.isRegex ||
    conditions.caseSensitive ||
    !conditions.searchRequestHeader ||
    !conditions.searchRequestBody ||
    !conditions.searchResponseHeader ||
    !conditions.searchResponseBody;

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none border-b" style={{ borderColor: 'var(--md-sys-color-divider)' }}>
        {['GET','POST','PUT','DELETE','PATCH','WS','SSE','2xx','4xx','5xx'].map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => toggleFilter(chip)}
            className={`shrink-0 px-1.5 h-5 rounded-full text-[10px] font-bold cursor-pointer transition-colors border ${
              activeFilters.has(chip)
                ? 'text-white border-transparent'
                : 'text-gray-500 border-current hover:border-gray-400'
            }`}
            style={activeFilters.has(chip) ? { backgroundColor: activeColor.hex, borderColor: activeColor.hex } : {}}
          >
            {chip}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="shrink-0 px-1.5 h-5 rounded-full text-[10px] text-red-400 hover:text-red-600 cursor-pointer border border-current"
          >
            ✕ Clear
          </button>
        )}
      </div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-t select-none shrink-0"
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="relative flex-1 flex items-center">
          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isZh ? '搜索请求 URL / 路径...' : 'Search / Filter URL...'}
            className="w-full pl-8 pr-7 py-1 rounded-lg border bg-transparent text-xs font-mono focus:outline-none transition-colors"
            style={{
              borderColor: 'var(--md-sys-color-divider)',
              color: 'var(--md-sys-color-on-surface)',
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter condition trigger button */}
        <button
          type="button"
          onClick={() => setIsConditionModalOpen(true)}
          className={`p-1.5 rounded-lg border cursor-pointer transition-colors relative ${
            hasActiveConditions
              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800'
              : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
          }`}
          style={{ borderColor: hasActiveConditions ? undefined : 'var(--md-sys-color-divider)' }}
          title={isZh ? '高级搜索条件' : 'Filter Conditions'}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {hasActiveConditions && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: activeColor.hex }}
            />
          )}
        </button>
      </div>

      {isConditionModalOpen && (
        <SearchConditionDialog
          conditions={conditions}
          onApply={onConditionsChange}
          onClose={() => setIsConditionModalOpen(false)}
        />
      )}
    </>
  );
};
