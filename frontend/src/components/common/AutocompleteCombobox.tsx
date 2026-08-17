import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label?: string;
  category?: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
}

interface AutocompleteComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | ComboboxOption)[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  allowCustom?: boolean;
  icon?: React.ReactNode;
}

export const AutocompleteCombobox: React.FC<AutocompleteComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  className = '',
  inputClassName = '',
  disabled = false,
  allowCustom = true,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options
  const normalizedOptions: ComboboxOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return { ...opt, label: opt.label || opt.value };
  });

  // Filter options
  const filtered = normalizedOptions.filter((opt) => {
    const term = searchTerm.toLowerCase();
    return (
      opt.value.toLowerCase().includes(term) ||
      (opt.label && opt.label.toLowerCase().includes(term)) ||
      (opt.description && opt.description.toLowerCase().includes(term)) ||
      (opt.category && opt.category.toLowerCase().includes(term))
    );
  });

  // Group by category if available
  const grouped: Record<string, ComboboxOption[]> = {};
  filtered.forEach((opt) => {
    const cat = opt.category || 'Standard';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(opt);
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    setSearchTerm(newVal);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
          isOpen ? 'ring-1 ring-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-700'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'} ${inputClassName}`}
      >
        {icon && <div className="shrink-0 text-gray-400">{icon}</div>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            setSearchTerm('');
            setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!allowCustom}
          className="w-full bg-transparent text-xs font-mono focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer shrink-0 transition-transform duration-150"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl shadow-xl border bg-white dark:bg-gray-900 z-50 py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
          style={{
            borderColor: 'var(--md-sys-color-divider, rgba(128,128,128,0.2))',
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-center text-gray-400 italic text-[11px]">
              No matching options {allowCustom && '— press Enter to use custom value'}
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-1 last:mb-0">
                {Object.keys(grouped).length > 1 && (
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                    {category}
                  </div>
                )}
                {items.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                        <div className="truncate">
                          <span className="font-mono text-xs">{opt.label || opt.value}</span>
                          {opt.description && (
                            <span className="text-[10px] text-gray-400 block truncate">
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>
                      {opt.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            opt.badgeColor || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
