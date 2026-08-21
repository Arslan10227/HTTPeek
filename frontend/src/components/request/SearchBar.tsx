import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, SlidersHorizontal, Cpu } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { useProxyStore } from '../../store/useProxyStore';
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

const METHOD_CHIPS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'WS', 'SSE'];
const STATUS_CHIPS = ['2xx', '4xx', '5xx'];

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  conditions,
  onConditionsChange,
}) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const { processFilter, setProcessFilter } = useProxyStore();
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const activeColor = getActiveColorPreset();

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const toggleFilter = (key: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const methods = METHOD_CHIPS.filter((m) => activeFilters.has(m));
    const newConditions = { ...conditions };
    newConditions.method = methods.length === 1 ? methods[0] : '';
    const statusFilters = STATUS_CHIPS.filter((s) => activeFilters.has(s));
    newConditions.statusCode = statusFilters.length === 1 ? statusFilters[0] : '';
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
    !conditions.searchResponseBody ||
    conditions.protocol ||
    conditions.minDurationMs ||
    conditions.maxDurationMs ||
    conditions.minSizeBytes ||
    conditions.maxSizeBytes ||
    conditions.hasRuleHits ||
    conditions.bodyRegex;

  return (
    <>
      {/* ── Filter chip strip ─────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-t shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
      >
        {[...METHOD_CHIPS, ...STATUS_CHIPS].map((chip) => {
          const isActive = activeFilters.has(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggleFilter(chip)}
              className={`chip shrink-0 font-mono text-[10px] ${isActive ? 'chip-active' : ''}`}
              style={isActive ? { background: `${activeColor.hex}18`, color: activeColor.hex, borderColor: `${activeColor.hex}40` } : {}}
            >
              {chip}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors border"
            style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}
          >
            <X className="w-2.5 h-2.5" />
            Clear
          </button>
        )}
        {processFilter && (
          <button
            type="button"
            onClick={() => setProcessFilter(null)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors border"
            style={{ color: '#c084fc', borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.10)' }}
            title={`Filtering by process: ${processFilter}. Click to clear.`}
          >
            <Cpu className="w-2.5 h-2.5" />
            {processFilter}
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* ── Search input ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="relative flex-1 flex items-center">
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isZh ? '搜索请求 URL...' : 'Search URL…'}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-all border"
            style={{
              background: 'var(--color-surface-raised)',
              borderColor: value ? 'var(--color-primary-border)' : 'var(--color-border)',
              color: 'var(--color-text)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = value ? 'var(--color-primary-border)' : 'var(--color-border)')}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 cursor-pointer transition-opacity"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Advanced filter */}
        <button
          type="button"
          onClick={() => setIsConditionModalOpen(true)}
          className="relative flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition-all border"
          style={{
            background: hasActiveConditions ? 'rgba(0,229,163,0.10)' : 'var(--color-surface-raised)',
            borderColor: hasActiveConditions ? 'var(--color-primary-border)' : 'var(--color-border)',
            color: hasActiveConditions ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
          title={isZh ? '高级搜索条件' : 'Advanced Filters'}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {hasActiveConditions && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-primary)' }}
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
