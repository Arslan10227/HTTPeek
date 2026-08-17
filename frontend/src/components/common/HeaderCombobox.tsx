import React from 'react';
import { AutocompleteCombobox, ComboboxOption } from './AutocompleteCombobox';
import {
  COMMON_REQUEST_HEADERS,
  COMMON_RESPONSE_HEADERS,
  COMMON_HEADER_VALUES,
} from '../../constants/httpTemplates';

interface HeaderKeyComboboxProps {
  value: string;
  onChange: (key: string) => void;
  type?: 'request' | 'response' | 'all';
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const HeaderKeyCombobox: React.FC<HeaderKeyComboboxProps> = ({
  value,
  onChange,
  type = 'all',
  placeholder = 'Header Key (e.g. Content-Type)...',
  className = '',
  disabled = false,
}) => {
  let list: string[] = [];
  if (type === 'request') {
    list = COMMON_REQUEST_HEADERS;
  } else if (type === 'response') {
    list = COMMON_RESPONSE_HEADERS;
  } else {
    list = Array.from(new Set([...COMMON_REQUEST_HEADERS, ...COMMON_RESPONSE_HEADERS]));
  }

  const options: ComboboxOption[] = list.map((h) => ({
    value: h,
    label: h,
    category: COMMON_REQUEST_HEADERS.includes(h) && COMMON_RESPONSE_HEADERS.includes(h)
      ? 'General Headers'
      : COMMON_REQUEST_HEADERS.includes(h)
      ? 'Request Headers'
      : 'Response Headers',
  }));

  return (
    <AutocompleteCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      allowCustom={true}
    />
  );
};

interface HeaderValueComboboxProps {
  headerKey: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const HeaderValueCombobox: React.FC<HeaderValueComboboxProps> = ({
  headerKey,
  value,
  onChange,
  placeholder = 'Header Value (e.g. application/json)...',
  className = '',
  disabled = false,
}) => {
  const suggestions = COMMON_HEADER_VALUES[headerKey] || [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/html; charset=utf-8',
    'no-cache',
    'Bearer <token>',
    '*',
  ];

  const options: ComboboxOption[] = suggestions.map((s) => ({
    value: s,
    label: s,
    category: headerKey ? `${headerKey} Presets` : 'Common Values',
  }));

  return (
    <AutocompleteCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      allowCustom={true}
    />
  );
};
