import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export interface SettingDialogTriggers {
  onOpenPreferences?: () => void;
  onOpenFilter?: () => void;
  onOpenHosts?: () => void;
  onOpenBlock?: () => void;
  onOpenRewrite?: () => void;
  onOpenMap?: () => void;
  onOpenCrypto?: () => void;
  onOpenScript?: () => void;
  onOpenBreakpoint?: () => void;
  onOpenWeakNetwork?: () => void;
  onOpenExternalProxy?: () => void;
  onOpenAbout?: () => void;
}

interface SettingMenuProps extends SettingDialogTriggers {}

export const SettingMenu: React.FC<SettingMenuProps> = ({
  onOpenPreferences,
  onOpenAbout,
}) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpenPreferences || onOpenAbout}
      className="btn-icon shrink-0"
      title={t.setting || 'Preferences & Settings'}
    >
      <SettingsIcon className="w-4 h-4" />
    </button>
  );
};
