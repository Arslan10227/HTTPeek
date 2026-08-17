import React from 'react';
import { X, Star, RotateCw } from 'lucide-react';
import { HttpRequest } from '../../types';
import { InspectorPanel } from './InspectorPanel';
import { useProxyStore } from '../../store/useProxyStore';
import { toast } from '../../store/useToastStore';

interface MobileInspectorSheetProps {
  request: HttpRequest | null;
  onClose: () => void;
  onToggleFavorite: () => void;
}

export const MobileInspectorSheet: React.FC<MobileInspectorSheetProps> = ({
  request,
  onClose,
  onToggleFavorite,
}) => {
  const { toggleFavorite } = useProxyStore();

  if (!request) return null;

  const handleReplay = async () => {
    try {
      if ((window as any).go?.main?.App?.ReplayRequest) {
        await (window as any).go.main.App.ReplayRequest(request);
        toast.success('Request replayed');
      }
    } catch (e: any) {
      toast.error('Replay error', e.message || String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in select-none font-sans">
      <div className="flex-1" onClick={onClose} role="presentation" />
      <div className="bg-white rounded-t-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="pt-2.5 pb-2 px-4 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-slate-50/50">
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[11px] font-bold text-slate-700 truncate flex-1">{request.method} {request.hostPort?.host}</span>
          <button type="button" onClick={handleReplay} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer"><RotateCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => { toggleFavorite(request.id); onToggleFavorite(); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer">
            <Star className={`w-4 h-4 ${request.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
          <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <InspectorPanel request={request} />
        </div>
      </div>
    </div>
  );
};
