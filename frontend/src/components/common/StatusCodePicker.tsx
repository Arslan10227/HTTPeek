import React from 'react';

export const COMMON_STATUS_CODES = [
  { code: 200, label: '200 OK', color: 'badge-2xx' },
  { code: 201, label: '201 Created', color: 'badge-2xx' },
  { code: 204, label: '204 No Content', color: 'badge-2xx' },
  { code: 301, label: '301 Moved', color: 'badge-3xx' },
  { code: 302, label: '302 Found', color: 'badge-3xx' },
  { code: 304, label: '304 Cached', color: 'badge-3xx' },
  { code: 400, label: '400 Bad Req', color: 'badge-4xx' },
  { code: 401, label: '401 Unauth', color: 'badge-4xx' },
  { code: 403, label: '403 Forbidden', color: 'badge-4xx' },
  { code: 404, label: '404 Not Found', color: 'badge-4xx' },
  { code: 500, label: '500 Error', color: 'badge-5xx' },
  { code: 502, label: '502 Bad GW', color: 'badge-5xx' },
  { code: 503, label: '503 Unavail', color: 'badge-5xx' },
];

interface StatusCodePickerProps {
  value: number | string;
  onChange: (code: number) => void;
  className?: string;
}

export const StatusCodePicker: React.FC<StatusCodePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const currentCode = typeof value === 'string' ? parseInt(value, 10) || 200 : value;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {COMMON_STATUS_CODES.map(({ code, label, color }) => {
          const isSelected = currentCode === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onChange(code)}
              className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                isSelected
                  ? `${color} ring-2 ring-emerald-400 dark:ring-emerald-500 shadow-md scale-105 font-extrabold`
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
