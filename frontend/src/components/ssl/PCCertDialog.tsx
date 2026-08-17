import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  RefreshCw, 
  FolderOpen, 
  Coffee, 
  Layers, 
  ShieldPlus,
  Plus
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';
import { confirm } from '../../store/useConfirmDialog';
import { api } from '../../store/apiAdapter';

interface JavaInstallItem {
  path: string;
  version: string;
  vendor: string;
  keytoolPath: string;
  cacertsPath: string;
  isInstalled: boolean;
}

interface PCCertDialogProps {
  onClose: () => void;
}

export const PCCertDialog: React.FC<PCCertDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const { status, setStatus } = useProxyStore();
  const activeColor = getActiveColorPreset();

  const [activeTab, setActiveTab] = useState<'system' | 'java'>('system');
  const [installing, setInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(status.caInstalled ?? null);
  const [caDetails, setCaDetails] = useState<any>(null);

  // Java Keystore Management
  const [javaInstalls, setJavaInstalls] = useState<JavaInstallItem[]>([]);
  const [loadingJava, setLoadingJava] = useState(false);

  const isZh = language.startsWith('zh');

  const refreshStatus = async () => {
    try {
      const installed = await api.checkCaInstalled();
      setIsInstalled(installed);
      setStatus({ ...status, caInstalled: installed, isCaInstalled: installed });
      const details = await api.getCADetails();
      setCaDetails(details);
    } catch (e) {
      console.warn('CA check error:', e);
    }
  };

  const refreshJavaInstalls = async () => {
    setLoadingJava(true);
    try {
      if ((window as any).go?.main?.App?.DetectJavaInstallations) {
        const list = await (window as any).go.main.App.DetectJavaInstallations();
        setJavaInstalls(list || []);
      }
    } catch (e) {
      console.warn('Java detect error:', e);
    } finally {
      setLoadingJava(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    refreshJavaInstalls();
  }, []);

  const handleInstallLocal = async () => {
    setInstalling(true);
    try {
      if (api.installCA) {
        await api.installCA();
        toast.success(t.success, isZh ? '根证书已成功安装并信任至系统' : 'Root CA installed to system trust store');
        await refreshStatus();
      } else {
        toast.info('Root CA installation is available in desktop app');
      }
    } catch (e: any) {
      toast.error(t.fail, e?.message || 'Failed to install Root CA');
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstallLocal = async () => {
    const ok = await confirm({
      title: isZh ? '卸载系统根证书' : 'Uninstall Root CA',
      message: isZh ? '确认从系统证书区卸载 HTTPeek 根证书？' : 'Are you sure you want to remove Root CA from system trust store?',
      type: 'danger',
      confirmText: isZh ? '确认卸载' : 'Uninstall',
    });
    if (!ok) return;

    setInstalling(true);
    try {
      if ((window as any).go?.main?.App?.UninstallRootCA) {
        await (window as any).go.main.App.UninstallRootCA();
        toast.success(t.success, isZh ? '根证书已从系统卸载' : 'Root CA removed from trust store');
        await refreshStatus();
      } else {
        toast.info('Uninstall is available in desktop app');
      }
    } catch (e: any) {
      toast.error(t.fail, e?.message || 'Failed to uninstall Root CA');
    } finally {
      setInstalling(false);
    }
  };

  const handleSelectJavaFolder = async () => {
    try {
      if ((window as any).go?.main?.App?.SelectJavaFolder) {
        const item: JavaInstallItem = await (window as any).go.main.App.SelectJavaFolder();
        if (item && item.path) {
          const exists = javaInstalls.some((j) => j.path === item.path);
          if (!exists) {
            setJavaInstalls([...javaInstalls, item]);
          }
          toast.success('Java JDK / JRE Detected', `${item.vendor} ${item.version}`);
        }
      }
    } catch (e: any) {
      if (!String(e).includes('cancelled')) {
        toast.error('Invalid Java Folder', e?.message || 'Could not find keytool or cacerts');
      }
    }
  };

  const handleInstallToJava = async (javaPath: string) => {
    try {
      if ((window as any).go?.main?.App?.InstallCertToJava) {
        await (window as any).go.main.App.InstallCertToJava(javaPath);
        toast.success('Installed to Java Keystore', 'HTTPeek CA trusted in cacerts');
        await refreshJavaInstalls();
      }
    } catch (e: any) {
      toast.error('Java Install Error', e?.message || 'Failed to install cert into Java cacerts');
    }
  };

  const handleUninstallFromJava = async (javaPath: string) => {
    const ok = await confirm({
      title: 'Remove CA from Java',
      message: `Remove HTTPeek CA certificate from Java keystore (${javaPath})?`,
      type: 'warning',
      confirmText: 'Remove',
    });
    if (!ok) return;

    try {
      if ((window as any).go?.main?.App?.UninstallCertFromJava) {
        await (window as any).go.main.App.UninstallCertFromJava(javaPath);
        toast.info('Removed from Java Keystore');
        await refreshJavaInstalls();
      }
    } catch (e: any) {
      toast.error('Java Uninstall Error', e?.message);
    }
  };

  const handleDownloadCert = () => {
    window.open('http://127.0.0.1:9099/ssl', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none font-sans">
      <div
        className="w-[620px] max-h-[85vh] rounded-3xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg, #ffffff)',
          borderColor: 'var(--md-sys-color-divider, rgba(128,128,128,0.2))',
          color: 'var(--md-sys-color-on-surface, #1f2937)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" style={{ color: activeColor.hex }} />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Root Certificate Authority (CA) Manager</h2>
              <p className="text-[11px] text-gray-500">Install and trust Root CA for OS browsers and Java runtimes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
              activeTab === 'system'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Operating System Trust Store</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('java')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
              activeTab === 'java'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Java JDK / JRE cacerts ({javaInstalls.length})</span>
          </button>
        </div>

        {activeTab === 'system' ? (
          <div className="flex flex-col gap-3.5">
            {/* Live Status Card */}
            <div
              className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                isInstalled
                  ? 'bg-green-50/90 dark:bg-green-950/40 border-green-200 dark:border-green-800/60 text-green-950 dark:text-green-200'
                  : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isInstalled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-xs">
                    {isInstalled
                      ? isZh
                        ? '证书状态: 已安装并信任 (Installed & Trusted)'
                        : 'System Status: Installed & Trusted'
                      : isZh
                      ? '证书状态: 未安装 (Not Installed)'
                      : 'System Status: Not Installed in System Trust Store'}
                  </span>
                  <span className="text-[11px] opacity-80 mt-0.5 font-mono">
                    {caDetails?.subject ? `Subject: ${caDetails.subject} | Valid to: ${caDetails.validTo}` : 'HTTPeek Root CA Certificate'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={refreshStatus}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Info Box */}
            <div className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
              {isZh
                ? '为了解密 HTTPS 流量，需要将 HTTPeek 的根证书安装并信任到本机的系统受信任根证书颁发机构存储区。'
                : 'To decrypt HTTPS traffic, HTTPeek installs and trusts the Root Certificate Authority (CA) into your operating system trust store.'}
            </div>

            {/* Step Guide */}
            <div className="flex flex-col gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="font-semibold text-gray-800 dark:text-gray-200">
                {isZh ? '操作选项:' : 'Installation Options:'}
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-gray-600 dark:text-gray-400">
                  {isZh ? '1. 一键自动安装至系统受信任区:' : '1. Automatic one-click system trust:'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInstallLocal}
                    disabled={installing}
                    className="px-4 py-1.5 rounded-xl font-bold text-white shadow-xs cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: isInstalled ? '#16a34a' : activeColor.hex }}
                  >
                    {installing ? 'Processing...' : isInstalled ? (isZh ? '重新安装证书' : 'Reinstall Cert') : (isZh ? '一键安装证书' : 'Install Certificate')}
                  </button>
                  {isInstalled && (
                    <button
                      type="button"
                      onClick={handleUninstallLocal}
                      disabled={installing}
                      className="px-3 py-1.5 rounded-xl font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer text-[11px]"
                    >
                      {isZh ? '卸载' : 'Uninstall'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-gray-200 dark:border-gray-800 pt-2.5">
                <span className="text-[11px] text-gray-600 dark:text-gray-400">
                  {isZh ? '2. 手动下载证书文件 (.crt):' : '2. Download certificate file manually:'}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadCert}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-700 dark:text-gray-300"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isZh ? '下载证书 (.crt)' : 'Download CRT'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Java Keystore Tab */
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 text-[11px]">
                Inject HTTPeek Root CA into Java JDK / JRE keystores (<code>cacerts</code>) for Maven, Gradle, Spring Boot, and OkHttp interception.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshJavaInstalls}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  title="Rescan standard Java paths"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingJava ? 'animate-spin' : ''}`} />
                  <span>Scan</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectJavaFolder}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-xs text-white cursor-pointer shadow-xs hover:opacity-90"
                  style={{ backgroundColor: activeColor.hex }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse Java Folder...</span>
                </button>
              </div>
            </div>

            {/* List of Java Installations */}
            <div className="flex-1 max-h-[280px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-2xl p-2 space-y-2 bg-gray-50/50 dark:bg-gray-900/50">
              {javaInstalls.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
                  <p className="font-bold">No standard Java JDK / JRE installations auto-detected</p>
                  <p className="text-[11px] mt-1">Click "Browse Java Folder..." to select your custom JDK directory</p>
                </div>
              ) : (
                javaInstalls.map((inst, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                          {inst.vendor || 'Java Runtime'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          v{inst.version}
                        </span>
                        {inst.isInstalled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Trusted in cacerts</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Not Installed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono truncate mt-1" title={inst.path}>
                        {inst.path}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inst.isInstalled ? (
                        <button
                          type="button"
                          onClick={() => handleUninstallFromJava(inst.path)}
                          className="px-3 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          Uninstall
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleInstallToJava(inst.path)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-white cursor-pointer hover:opacity-90 shadow-xs"
                          style={{ backgroundColor: activeColor.hex }}
                        >
                          <ShieldPlus className="w-3.5 h-3.5" />
                          <span>Install CA</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl font-bold text-xs text-white cursor-pointer shadow-xs hover:opacity-90"
            style={{ backgroundColor: activeColor.hex }}
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
