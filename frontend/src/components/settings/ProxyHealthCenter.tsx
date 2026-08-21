import React, { useEffect, useState } from 'react';
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Server,
  Globe,
  Smartphone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useProxyStore } from '../../store/useProxyStore';
import { api } from '../../store/apiAdapter';
import { toast } from '../../store/useToastStore';
import { PageContainer } from '../ui/PageContainer';

interface HealthItemProps {
  label: string;
  value: string | boolean | undefined;
  icon: React.ReactNode;
  ok?: boolean;
  warn?: boolean;
  detail?: string;
}

const HealthItem: React.FC<HealthItemProps> = ({ label, value, icon, ok, warn, detail }) => {
  const statusColor = ok
    ? 'text-emerald-600 dark:text-emerald-400'
    : warn
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-400';
  const bgColor = ok
    ? 'bg-emerald-50 dark:bg-emerald-950/30'
    : warn
      ? 'bg-amber-50 dark:bg-amber-950/30'
      : 'bg-slate-50 dark:bg-slate-900/30';
  const StatusIcon = ok ? CheckCircle2 : warn ? AlertCircle : XCircle;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgColor}`} style={{ borderColor: 'var(--md-sys-color-divider)' }}>
      <div className="shrink-0" style={{ color: 'var(--md-sys-color-on-surface)' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-xs font-mono font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value || '—')}
        </div>
        {detail && <div className="text-[10px] text-gray-400 truncate mt-0.5">{detail}</div>}
      </div>
      <StatusIcon className={`w-4 h-4 shrink-0 ${statusColor}`} />
    </div>
  );
};

export const ProxyHealthCenter: React.FC = () => {
  const { status } = useProxyStore();
  const [caDetails, setCaDetails] = useState<any>(null);
  const [adbDevices, setAdbDevices] = useState<any[]>([]);
  const [mobileDevices, setMobileDevices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    setRefreshing(true);
    try {
      const [ca, devices, mobiles] = await Promise.allSettled([
        api.getCADetails(),
        api.listADBDevices(),
        (window as any).go?.main?.App?.GetConnectedMobileDevices
          ? (window as any).go.main.App.GetConnectedMobileDevices()
          : Promise.resolve([]),
      ]);
      if (ca.status === 'fulfilled') setCaDetails(ca.value);
      if (devices.status === 'fulfilled') setAdbDevices(devices.value || []);
      if (mobiles.status === 'fulfilled') setMobileDevices(mobiles.value || []);
    } catch (e) {
      // Non-fatal — health center degrades gracefully
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const caFingerprint = caDetails?.fingerprint || caDetails?.sha256 || '';
  const caExpiry = caDetails?.notAfter || caDetails?.expiry || '';
  const caDaysLeft = caExpiry ? Math.ceil((new Date(caExpiry).getTime() - Date.now()) / 86400000) : null;

  return (
    <PageContainer description="Real-time status of the proxy engine, CA, system proxy, and connected devices.">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Real-time status of the proxy engine, CA, system proxy, and connected devices.
        </p>
        <button
          type="button"
          onClick={fetchHealth}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
          style={{ borderColor: 'var(--md-sys-color-divider)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Proxy Engine */}
        <HealthItem
          label="Proxy Engine"
          value={status.running ? `Running on :${status.port || 9099}` : 'Stopped'}
          icon={<Server className="w-4 h-4" />}
          ok={status.running}
          warn={!status.running}
        />

        {/* SSL / TLS MITM */}
        <HealthItem
          label="SSL / TLS MITM"
          value={status.sslEnabled ?? status.enableSsl}
          icon={<ShieldCheck className="w-4 h-4" />}
          ok={status.sslEnabled ?? status.enableSsl}
          warn={!(status.sslEnabled ?? status.enableSsl)}
          detail={status.sslEnabled ? 'HTTPS interception active' : 'HTTPS interception disabled'}
        />

        {/* CA Trust */}
        <HealthItem
          label="CA Trust Status"
          value={status.caInstalled ?? status.isCaInstalled ? 'Installed' : 'Not Installed'}
          icon={<ShieldCheck className="w-4 h-4" />}
          ok={status.caInstalled ?? status.isCaInstalled}
          warn={!(status.caInstalled ?? status.isCaInstalled)}
          detail={caFingerprint ? `Fingerprint: ${caFingerprint.slice(0, 24)}...` : undefined}
        />

        {/* CA Expiry */}
        <HealthItem
          label="CA Expiry"
          value={caExpiry ? new Date(caExpiry).toLocaleDateString() : 'Unknown'}
          icon={<AlertCircle className="w-4 h-4" />}
          ok={caDaysLeft != null && caDaysLeft > 30}
          warn={caDaysLeft != null && caDaysLeft <= 30 && caDaysLeft > 0}
          detail={caDaysLeft != null ? `${caDaysLeft} days remaining` : undefined}
        />

        {/* System Proxy */}
        <HealthItem
          label="System Proxy"
          value={status.systemProxy ?? status.systemProxyEnabled ? 'Active' : 'Inactive'}
          icon={<Globe className="w-4 h-4" />}
          ok={status.systemProxy ?? status.systemProxyEnabled}
          warn={!(status.systemProxy ?? status.systemProxyEnabled)}
          detail={status.systemProxy ? 'OS traffic routed through proxy' : 'OS proxy not set'}
        />

        {/* Connected Mobile Devices */}
        <HealthItem
          label="Connected Mobile Devices"
          value={String(mobileDevices.length)}
          icon={<Smartphone className="w-4 h-4" />}
          ok={mobileDevices.length > 0}
          warn={mobileDevices.length === 0}
          detail={mobileDevices.length > 0
            ? mobileDevices.map((d: any) => d.deviceName || d.deviceId || 'Unknown').join(', ')
            : 'No mobile devices paired'}
        />

        {/* ADB Devices */}
        <HealthItem
          label="ADB Devices"
          value={String(adbDevices.length)}
          icon={<Smartphone className="w-4 h-4" />}
          ok={adbDevices.length > 0}
          detail={adbDevices.length > 0
            ? adbDevices.map((d: any) => d.serial || d.name || 'Unknown').join(', ')
            : 'No ADB devices connected'}
        />

        {/* Upstream / External Proxy */}
        <HealthItem
          label="Upstream Proxy"
          value={(status as any).upstreamProxy || 'Direct (no upstream)'}
          icon={<Wifi className="w-4 h-4" />}
          ok={!(status as any).upstreamProxy}
          detail={(status as any).upstreamProxy ? 'Routing through upstream proxy' : 'Direct connection to targets'}
        />
      </div>

      {/* Summary banner */}
      <div
        className="mt-4 p-3 rounded-xl border text-xs"
        style={{
          borderColor: 'var(--md-sys-color-divider)',
          backgroundColor: 'var(--md-sys-color-surface)',
        }}
      >
        <div className="flex items-center gap-2">
          {status.running && (status.caInstalled ?? status.isCaInstalled) ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Proxy is healthy and ready to capture traffic.
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {!status.running
                  ? 'Proxy is not running. Start capture to intercept traffic.'
                  : 'CA is not installed. HTTPS interception will fail for most apps.'}
              </span>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
};
