import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { CollapsibleCard } from '../../ui/CollapsibleCard';
import { HttpRequest } from '../../../types';
import { toast } from '../../../store/useToastStore';

interface ExportCardProps {
  req: HttpRequest;
  curl: string;
}

export const ExportCard: React.FC<ExportCardProps> = ({ req, curl }) => {
  const [lang, setLang] = useState<'curl' | 'python' | 'go'>('curl');
  const [copied, setCopied] = useState(false);

  const code =
    lang === 'curl'
      ? curl
      : lang === 'python'
        ? `import requests\nr = requests.${(req.method || 'get').toLowerCase()}("${req.url}")\nprint(r.status_code)`
        : `// Go replay stub for ${req.method} ${req.url}`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.info('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportHar = async () => {
    if ((window as any).go?.main?.App?.ExportHAR) {
      const har = await (window as any).go.main.App.ExportHAR([req]);
      const blob = new Blob([har], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `exchange-${req.id}.har`;
      a.click();
      toast.success('Exported exchange HAR');
    }
  };

  return (
    <CollapsibleCard id="export" title="Export" defaultOpen={false}>
      <div className="space-y-2">
        <div className="flex gap-2">
          {(['curl', 'python', 'go'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer ${lang === l ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-600'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
          <button type="button" onClick={copy} className="ml-auto p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button type="button" onClick={exportHar} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer" title="Export HAR">
            <Download className="w-4 h-4" />
          </button>
        </div>
        <pre className="font-mono text-[10px] bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto select-all whitespace-pre-wrap max-h-40">{code}</pre>
      </div>
    </CollapsibleCard>
  );
};
