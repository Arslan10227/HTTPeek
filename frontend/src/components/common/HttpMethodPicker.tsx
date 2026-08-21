import React from 'react';

export const HTTP_METHODS = [
  { method: 'ALL', label: 'ALL', color: 'badge-connect' },
  { method: 'GET', label: 'GET', color: 'badge-get' },
  { method: 'POST', label: 'POST', color: 'badge-post' },
  { method: 'PUT', label: 'PUT', color: 'badge-put' },
  { method: 'DELETE', label: 'DEL', color: 'badge-delete' },
  { method: 'PATCH', label: 'PATCH', color: 'badge-patch' },
  { method: 'HEAD', label: 'HEAD', color: 'badge-head' },
  { method: 'OPTIONS', label: 'OPT', color: 'badge-options' },
  { method: 'WS', label: 'WS', color: 'badge-ws' },
];

interface HttpMethodPickerProps {
  value: string;
  onChange: (method: string) => void;
  className?: string;
  allowAll?: boolean;
  size?: 'sm' | 'md';
}

export const HttpMethodPicker: React.FC<HttpMethodPickerProps> = ({
  value,
  onChange,
  className = '',
  allowAll = true,
  size = 'md',
}) => {
  const methods = allowAll ? HTTP_METHODS : HTTP_METHODS.filter((m) => m.method !== 'ALL');

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {methods.map(({ method, label, color }) => {
        const isSelected = (value === '' && method === 'ALL') || value.toUpperCase() === method;
        return (
          <button
            key={method}
            type="button"
            onClick={() => onChange(method === 'ALL' ? '' : method)}
            className={`font-mono font-extrabold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
            } ${
              isSelected
                ? `${color} ring-2 ring-emerald-400 dark:ring-emerald-500 shadow-md scale-105 font-black`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
