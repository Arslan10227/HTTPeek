import React, { useMemo } from 'react';
import { ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { scanForSecrets, SecretFinding } from '../../../lib/secretScanner';
import { HttpRequest } from '../../../types';

interface SecretDetectionCardProps {
  request: HttpRequest;
  reqHeaders: Record<string, any>;
  respHeaders: Record<string, any>;
  reqBodyRaw: string;
  respBodyRaw: string;
}

const severityConfig = {
  high: {
    icon: ShieldAlert,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900',
    label: 'High',
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900',
    label: 'Medium',
  },
  low: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900',
    label: 'Low',
  },
};

const locationLabels: Record<SecretFinding['location'], string> = {
  'request-header': 'Req Header',
  'request-body': 'Req Body',
  'response-header': 'Resp Header',
  'response-body': 'Resp Body',
  'url': 'URL',
  'cookie': 'Cookie',
};

export const SecretDetectionCard: React.FC<SecretDetectionCardProps> = ({
  request,
  reqHeaders,
  respHeaders,
  reqBodyRaw,
  respBodyRaw,
}) => {
  const findings = useMemo(() => {
    return scanForSecrets({
      url: request.url,
      requestHeaders: reqHeaders,
      requestBody: reqBodyRaw,
      responseHeaders: respHeaders,
      responseBody: respBodyRaw,
    });
  }, [request.url, reqHeaders, respHeaders, reqBodyRaw, respBodyRaw]);

  if (findings.length === 0) return null;

  const highCount = findings.filter((f) => f.severity === 'high').length;
  const subtitle = `${findings.length} detected${highCount > 0 ? ` (${highCount} high)` : ''}`;

  return (
    <CollapsibleCard
      id="secret-detection"
      title="Secret Detection"
      subtitle={subtitle}
      defaultOpen={true}
    >
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
          Potential secrets detected in this exchange. Values are masked — do not share captures without review.
        </p>
        {findings.map((finding, idx) => {
          const cfg = severityConfig[finding.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={`${finding.id}-${idx}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    {finding.label}
                  </span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {locationLabels[finding.location]}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {finding.key && <span className="font-semibold">{finding.key}: </span>}
                  <span>{finding.preview}</span>
                  {finding.line && finding.line > 1 && <span className="ml-1">L{finding.line}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
};
