import React from 'react';

export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'WS' | 'SSE' | 'H3' | 'GRPC' | string;

interface MethodBadgeProps {
  method?: HttpMethodType;
  protocol?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const getMethodBadgeClass = (method?: string, protocol?: string): string => {
  const m = (method || '').toUpperCase();
  const p = (protocol || '').toUpperCase();

  if (p.includes('WS') || p.includes('WEBSOCKET')) return 'badge-ws';
  if (p.includes('SSE')) return 'badge-sse';
  if (p.includes('H3') || p.includes('QUIC') || p.includes('HTTP/3')) return 'badge-h3';
  if (p.includes('GRPC')) return 'badge-grpc';

  switch (m) {
    case 'GET': return 'badge-get';
    case 'POST': return 'badge-post';
    case 'PUT': return 'badge-put';
    case 'PATCH': return 'badge-patch';
    case 'DELETE': return 'badge-delete';
    case 'OPTIONS': return 'badge-options';
    case 'HEAD': return 'badge-head';
    case 'CONNECT': return 'badge-connect';
    case 'WS': return 'badge-ws';
    case 'SSE': return 'badge-sse';
    case 'H3': return 'badge-h3';
    case 'GRPC': return 'badge-grpc';
    default: return 'badge-options';
  }
};

export const MethodBadge: React.FC<MethodBadgeProps> = ({
  method,
  protocol,
  className = '',
  size = 'md',
}) => {
  const badgeClass = getMethodBadgeClass(method, protocol);
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5 font-bold',
    md: 'text-[10px] px-2 py-0.5 font-extrabold',
    lg: 'text-xs px-2.5 py-1 font-extrabold',
  };

  const displayText = method?.toUpperCase() || (protocol?.toUpperCase().includes('WS') ? 'WS' : 'HTTP');

  return (
    <span
      className={`badge-method ${badgeClass} ${sizeClasses[size]} ${className}`}
      title={protocol ? `${displayText} (${protocol})` : displayText}
    >
      {displayText}
    </span>
  );
};
