import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { ColorfulIcon } from '../common/ColorfulIcon';
import { toast } from '../../store/useToastStore';
import { ReportWebhooksPanel } from './ReportWebhooksPanel';
import { PageContainer } from '../ui/PageContainer';

export const SettingsView: React.FC = () => {
  const { maxRequests, setMaxRequests } = useProxyStore();
  const [caDetails, setCaDetails] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const [autoSystemProxy, setAutoSystemProxy] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem('httpeek_auto_system_proxy') !== 'false';
  });
  const [bypassDomains, setBypassDomains] = useState(() => {
    if (typeof localStorage === 'undefined') return 'localhost, 127.0.0.1, ::1';
    return localStorage.getItem('httpeek_bypass_domains') || 'localhost, 127.0.0.1, ::1';
  });

  const handleAutoSystemProxyChange = (checked: boolean) => {
    setAutoSystemProxy(checked);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('httpeek_auto_system_proxy', String(checked));
    }
  };

  const handleBypassDomainsChange = (value: string) => {
    setBypassDomains(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('httpeek_bypass_domains', value);
    }
  };

  const fetchCAInfo = async () => {
    if (window.go?.main?.App?.GetCADetails) {
      const details = await window.go.main.App.GetCADetails();
      setCaDetails(details);
    }
  };

  useEffect(() => {
    fetchCAInfo();
  }, []);

  const handleInstallCA = async () => {
    setInstalling(true);
    setInstallMessage(null);
    try {
      if (window.go?.main?.App?.InstallRootCA) {
        await window.go.main.App.InstallRootCA();
        setInstallMessage('Root CA successfully installed into Windows Trusted Root Certification Authorities!');
        toast.success('Root CA installed in Windows Certificate Store');
        await fetchCAInfo();
      }
    } catch (e: any) {
      setInstallMessage('Installation error: ' + (e.message || e));
      toast.error('Root CA installation failed', e.message || String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstallCA = async () => {
    setUninstalling(true);
    try {
      if (window.go?.main?.App?.UninstallRootCA) {
        await window.go.main.App.UninstallRootCA();
        setInstallMessage('Root CA uninstalled from system store.');
        toast.info('Root CA uninstalled');
        await fetchCAInfo();
      }
    } catch (e: any) {
      setInstallMessage('Uninstall error: ' + (e.message || e));
      toast.error('Root CA uninstall failed', e.message || String(e));
    } finally {
      setUninstalling(false);
    }
  };

  const handleExportPEM = async () => {
    if (window.go?.main?.App?.ExportRootCA) {
      const pem = await window.go.main.App.ExportRootCA();
      const blob = new Blob([pem], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'httpeek-root-ca.crt';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported Root CA certificate');
    }
  };

  const copyFingerprint = () => {
    if (caDetails?.fingerprint) {
      navigator.clipboard.writeText(caDetails.fingerprint);
      setCopiedFingerprint(true);
      toast.info('Certificate SHA-256 fingerprint copied');
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  return (
    <PageContainer description="Configure Root CA certificate and traffic capture runtime options.">
      <div className="space-y-5">
        <div className="htk-section space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ColorfulIcon name="shield-ssl" size={28} />
              <div>
                <h2 className="htk-section-title">Root Certificate Authority (CA)</h2>
                <p className="htk-section-desc mb-0">Required to decrypt HTTPS / TLS traffic without browser warnings.</p>
              </div>
            </div>

            <span className={`htk-badge ${caDetails?.installed ? 'htk-badge-success' : 'htk-badge-warning'}`}>
              {caDetails?.installed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Installed & Trusted in Windows Store</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Not Yet Installed</span>
                </>
              )}
            </span>
          </div>

          <div className="htk-meta-grid">
            <div>
              <span className="htk-meta-label">Common Name (Subject):</span>
              <span className="htk-meta-value">{caDetails?.subject || 'HTTPeek Root CA'}</span>
            </div>
            <div>
              <span className="htk-meta-label">Validity Period:</span>
              <span className="htk-meta-value">10 Years (2026 - 2036)</span>
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <span className="htk-meta-label">SHA-256 Fingerprint:</span>
                <button type="button" onClick={copyFingerprint} className="htk-btn">
                  {copiedFingerprint ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedFingerprint ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <span className="htk-meta-value break-all select-all block mt-1 p-2 rounded border border-[var(--htk-panel-border)] bg-[var(--htk-panel)]">
                {caDetails?.fingerprint || 'Loading fingerprint...'}
              </span>
            </div>
          </div>

          {installMessage && (
            <div className="htk-alert htk-alert-success">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{installMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleInstallCA}
              disabled={installing}
              className="htk-btn htk-btn-primary"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{installing ? 'Installing Root CA...' : 'Install Root Certificate into Windows'}</span>
            </button>

            <button type="button" onClick={handleExportPEM} className="htk-btn">
              <Download className="w-4 h-4" />
              <span>Export Certificate (.crt / .pem)</span>
            </button>

            {caDetails?.installed && (
              <button
                type="button"
                onClick={handleUninstallCA}
                disabled={uninstalling}
                className="htk-btn htk-btn-danger"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Uninstall Root CA</span>
              </button>
            )}
          </div>
        </div>

        <div className="htk-section space-y-4">
          <div className="flex items-center gap-2.5">
            <ColorfulIcon name="system-proxy" size={24} />
            <h2 className="htk-section-title mb-0">Proxy & Traffic Capture Settings</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="htk-field flex items-center justify-between gap-4">
              <div>
                <p className="htk-field-label">Auto-Enable System Proxy on Start</p>
                <p className="htk-field-desc">Automatically configure Windows system proxy when you click "Start Proxy".</p>
              </div>
              <input
                type="checkbox"
                checked={autoSystemProxy}
                onChange={(e) => handleAutoSystemProxyChange(e.target.checked)}
                className="rounded border-[var(--htk-panel-border)] cursor-pointer w-4 h-4"
                style={{ accentColor: 'var(--htk-accent)' }}
              />
            </div>

            <div className="htk-field flex items-center justify-between gap-4">
              <div>
                <p className="htk-field-label">Memory History Buffer Limit</p>
                <p className="htk-field-desc">Maximum number of live requests kept in UI virtual scroll table.</p>
              </div>
              <select
                value={String(maxRequests)}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setMaxRequests(next);
                  toast.info(`Memory buffer limit set to ${next.toLocaleString()} requests`);
                }}
                className="htk-input w-auto cursor-pointer"
              >
                <option value="1000">1,000 Requests</option>
                <option value="5000">5,000 Requests</option>
                <option value="10000">10,000 Requests</option>
                <option value="50000">50,000 Requests</option>
              </select>
            </div>

            <div className="htk-field space-y-1.5">
              <p className="htk-field-label">Bypass Domains (No Interception)</p>
              <p className="htk-field-desc">Comma-separated list of hostnames or wildcards to bypass.</p>
              <input
                type="text"
                value={bypassDomains}
                onChange={(e) => handleBypassDomainsChange(e.target.value)}
                className="htk-input"
              />
            </div>

            <ReportWebhooksPanel />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
