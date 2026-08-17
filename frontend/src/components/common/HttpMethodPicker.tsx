import React from 'react';

const HTTP_METHODS = [
  { method: 'GET', color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300' },
  { method: 'POST', color: 'text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300' },
  { method: 'PUT', color: 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' },
  { method: 'DELETE', color: 'text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300' },
  { method: 'PATCH', color: 'text-purple-700 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300' },
  { method: 'HEAD', color: 'text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border-slate-300' },
  { method: 'OPTIONS', color: 'text-indigo-700 bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300' },
  { method: 'ALL', color: 'text-teal-700 bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300' },
];

interface HttpMethodPickerProps {
  value: string;
  onChange: (method: string) => void;
  className?: string;
  allowAll?: boolean;
}

export const HttpMethodPicker: React.FC<HttpMethodPickerProps> = ({
  value,
  onChange,
  className = '',
  allowAll = true,
}) => {
  const methods = allowAll ? HTTP_METHODS : HTTP_METHODS.filter((m) => m.method !== 'ALL');

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {methods.map(({ method, color }) => {
        const isSelected = (value === '' && method === 'ALL') || value.toUpperCase() === method;
        return (
          <button
            key={method}
            type="button"
            onClick={() => onChange(method === 'ALL' ? '' : method)}
            className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all border cursor-pointer ${
              isSelected
                ? `${color} ring-2 ring-blue-500 shadow-xs scale-105`
                : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'
            }`}
          >
            {method}
          </button>
        );
      })}
    </div>
  );
};
