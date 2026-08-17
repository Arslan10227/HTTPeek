import React from 'react';
import { AutocompleteCombobox, ComboboxOption } from './AutocompleteCombobox';
import { COMMON_STATUS_CODES } from '../../constants/httpTemplates';

interface StatusCodePickerProps {
  value: number | string;
  onChange: (code: number) => void;
  className?: string;
  disabled?: boolean;
}

export const StatusCodePicker: React.FC<StatusCodePickerProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const options: ComboboxOption[] = COMMON_STATUS_CODES.map((item) => {
    let category = '2xx Success';
    let badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';

    if (item.code >= 300 && item.code < 400) {
      category = '3xx Redirection';
      badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    } else if (item.code >= 400 && item.code < 500) {
      category = '4xx Client Error';
      badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    } else if (item.code >= 500) {
      category = '5xx Server Error';
      badgeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
    }

    return {
      value: String(item.code),
      label: `${item.code} ${item.text}`,
      description: item.category,
      category,
      badge: `${item.code}`,
      badgeColor,
    };
  });

  const handleSelect = (val: string) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <AutocompleteCombobox
        value={String(value || 200)}
        onChange={handleSelect}
        options={options}
        placeholder="Search code (e.g. 200, 404)..."
        disabled={disabled}
        allowCustom={true}
      />
    </div>
  );
};
