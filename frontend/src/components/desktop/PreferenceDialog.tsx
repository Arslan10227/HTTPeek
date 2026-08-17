import React from 'react';
import { X, Settings as SettingsIcon, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig, ThemeMode } from '../../theme/useAppConfig';
import { ColorMapping } from '../../theme/colors';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';

interface PreferenceDialogProps {
  onClose: () => void;
}

export const PreferenceDialog: React.FC<PreferenceDialogProps> = ({ onClose }) => {
  const { t, language, setLanguage } = useTranslation();
  const {
    themeMode,
    setThemeMode,
    useMaterial3,
    setUseMaterial3,
    themeColor,
    setThemeColor,
    autoStartup,
    setAutoStartup,
    minimizeToTray,
    setMinimizeToTray,
    clearConfirm,
    setClearConfirm,
    confirmOnClose,
    setConfirmOnClose,
    enabledHttp2,
    setEnabledHttp2,
    memoryCleanupThreshold,
    setMemoryCleanupThreshold,
    getActiveColorPreset,
  } = useAppConfig();

  const activeColor = getActiveColorPreset();
  const [maxReqInput, setMaxReqInput] = React.useState(String(useProxyStore.getState().maxRequests || 10000));
  const [isHarAssoc, setIsHarAssoc] = React.useState(false);

  React.useEffect(() => {
    if ((window as any).go?.main?.App?.IsHARAssociated) {
      (window as any).go.main.App.IsHARAssociated().then(setIsHarAssoc).catch(() => {});
    }
  }, []);

  const handleToggleHAR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsHarAssoc(checked);
    try {
      if (checked) {
        if ((window as any).go?.main?.App?.RegisterHARAssociation) {
          await (window as any).go.main.App.RegisterHARAssociation();
          toast.success('File Association Active', '.har files will now open in HTTPeek');
        }
      } else {
        if ((window as any).go?.main?.App?.UnregisterHARAssociation) {
          await (window as any).go.main.App.UnregisterHARAssociation();
          toast.info('File Association Removed', '.har files unassociated');
        }
      }
    } catch (err: any) {
      toast.error('File Association Failed', err.message || String(err));
      setIsHarAssoc(!checked);
    }
  };

  const memoryCleanupOptions = [
    { label: t.followSystem, value: null },
    { label: '512 MB', value: 512 },
    { label: '1024 MB', value: 1024 },
    { label: '2048 MB', value: 2048 },
    { label: '4096 MB', value: 4096 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[460px] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Title */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold">{t.preference}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 text-xs">
          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm w-32">{t.language}:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer text-xs"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            >
              <option value="zh">简体中文</option>
              <option value="zh_Hant">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Theme Mode */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm w-32">{t.theme}:</span>
            <select
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
              className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer text-xs"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            >
              <option value="system">{t.followSystem}</option>
              <option value="light">{t.themeLight}</option>
              <option value="dark">{t.themeDark}</option>
            </select>
          </div>

          {/* Material 3 */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm w-32">{t.material3}:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useMaterial3}
                onChange={(e) => setUseMaterial3(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: useMaterial3 ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Theme Color */}
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">{t.themeColor}:</span>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {Object.entries(ColorMapping).map(([name, preset]) => {
                const isSelected = themeColor === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setThemeColor(name)}
                    className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-xs relative"
                    style={{ backgroundColor: preset.hex }}
                    title={name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

          {/* Minimize to Tray */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t.minimizeToTrayTitle}</div>
              <div className="text-gray-500 text-[11px]">{t.minimizeToTraySubtitle}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={minimizeToTray}
                onChange={(e) => setMinimizeToTray(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: minimizeToTray ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Auto Startup */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t.autoStartup}</div>
              <div className="text-gray-500 text-[11px]">{t.autoStartupDescribe}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoStartup}
                onChange={(e) => setAutoStartup(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: autoStartup ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Clear Confirm */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t.clearConfirm}</div>
              <div className="text-gray-500 text-[11px]">{t.clearConfirmSubtitle}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: clearConfirm ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Confirm on Exit */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Confirm Before Exiting</div>
              <div className="text-gray-500 text-[11px]">Prompt confirmation before closing the application</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={confirmOnClose}
                onChange={(e) => setConfirmOnClose(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: confirmOnClose ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Enable HTTP/2 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t.enabledHTTP2 || 'Enable HTTP/2'}</div>
              <div className="text-gray-500 text-[11px]">Intercept and capture HTTP/2 multiplexed streams</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={enabledHttp2}
                onChange={(e) => setEnabledHttp2(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: enabledHttp2 ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Memory Cleanup */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{t.memoryCleanup}</div>
              <div className="text-gray-500 text-[11px]">{t.memoryCleanupSubtitle}</div>
            </div>
            <select
              value={memoryCleanupThreshold === null ? 'null' : String(memoryCleanupThreshold)}
              onChange={(e) => {
                const v = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                setMemoryCleanupThreshold(v);
              }}
              className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer text-xs"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            >
              {memoryCleanupOptions.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* HAR File Association */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Associate with .HAR Files</div>
              <div className="text-[11px] text-gray-500">Open .har HTTP archives directly with HTTPeek</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isHarAssoc}
                onChange={handleToggleHAR}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: isHarAssoc ? activeColor.hex : undefined,
                }}
              />
            </label>
          </div>

          {/* Max Requests */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Max Requests in Memory</div>
              <div className="text-[11px] text-gray-500">Oldest requests are discarded when limit is reached</div>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={maxReqInput}
                onChange={(e) => setMaxReqInput(e.target.value)}
                className="w-20 px-1.5 py-0.5 text-xs font-mono border rounded-md text-right bg-transparent"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
                min={100}
                max={100000}
                step={1000}
              />
              <button
                type="button"
                onClick={() => {
                  const n = parseInt(maxReqInput, 10);
                  if (!isNaN(n) && n >= 100) {
                    useProxyStore.getState().setMaxRequests(n);
                    toast.success(t.saveSuccess || 'Saved', `Max requests set to ${n}`);
                  }
                }}
                className="px-2 py-0.5 text-[11px] rounded-md font-medium text-white cursor-pointer transition-opacity hover:opacity-90 shadow-xs"
                style={{ backgroundColor: activeColor.hex }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-medium text-xs text-white transition-opacity hover:opacity-90 cursor-pointer shadow-xs"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
