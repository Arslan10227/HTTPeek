import React from 'react';
import { Gauge } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';

interface WeakNetworkIndicatorProps {
  onOpenWeakNetwork?: () => void;
}

export const WeakNetworkIndicator: React.FC<WeakNetworkIndicatorProps> = ({
  onOpenWeakNetwork,
}) => {
  const { t } = useTranslation();
  const { throttleConfig } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const isEnabled = throttleConfig?.enabled ?? false;

  if (!isEnabled || !onOpenWeakNetwork) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenWeakNetwork}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer animate-pulse transition-transform hover:scale-105"
      style={{
        backgroundColor: activeColor.primaryContainer,
        color: activeColor.onPrimaryContainer,
      }}
      title={`${t.weakNetwork} (${t.enable})`}
    >
      <Gauge className="w-3.5 h-3.5" />
      <span>{t.weakNetwork}</span>
    </button>
  );
};
