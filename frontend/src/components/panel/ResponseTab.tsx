import React from 'react';
import { HttpRequest } from '../../types';
import { HeadersViewer } from './HeadersViewer';
import { HttpBodyViewer } from './HttpBodyViewer';

interface ResponseTabProps {
  request: HttpRequest;
}

const getStatusColor = (status?: number): string => {
  if (!status) return '#9E9E9E';
  if (status >= 200 && status < 300) return '#4CAF50';
  if (status >= 300 && status < 400) return '#2196F3';
  if (status >= 400 && status < 500) return '#FF9800';
  return '#F44336';
};

export const ResponseTab: React.FC<ResponseTabProps> = ({ request }) => {
  const response = request.response;
  const statusColor = getStatusColor(response?.statusCode);

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs italic p-8">
        Waiting for response...
      </div>
    );
  }

  const rawContentType =
    response.contentType ||
    response.headers?.['content-type'] ||
    response.headers?.['Content-Type'] ||
    '';
  const contentType = Array.isArray(rawContentType)
    ? rawContentType.join(', ')
    : String(rawContentType || '');

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none flex flex-col gap-3">
      {/* Status Code Row */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono shadow-2xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-500">Status Code:</span>
          <span
            className="font-bold px-2 py-0.5 rounded text-white text-xs"
            style={{ backgroundColor: statusColor }}
          >
            {response.statusCode}
          </span>
          <span className="text-gray-400 text-[11px]">{response.statusText || ''}</span>
        </div>

        {response.duration !== undefined && (
          <div className="text-gray-400 text-[11px]">
            {response.duration} ms
          </div>
        )}
      </div>

      {/* Response Headers */}
      <HeadersViewer title="Response" headers={response.headers} />

      {/* Response Body */}
      <HttpBodyViewer
        title="Response"
        body={response.body}
        contentType={contentType}
        bodySize={response.bodySize || (response.body ? response.body.length : 0)}
      />
    </div>
  );
};
