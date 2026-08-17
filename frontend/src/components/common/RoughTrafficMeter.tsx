import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';

interface RoughTrafficMeterProps {
  requestCount: number;
  activeCount: number;
  className?: string;
}

export const RoughTrafficMeter: React.FC<RoughTrafficMeterProps> = ({
  requestCount,
  activeCount,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);

    // Draw background rough box
    rc.rectangle(2, 2, canvas.width - 4, canvas.height - 4, {
      stroke: '#cbd5e1',
      strokeWidth: 1.2,
      fill: '#f8fafc',
      fillStyle: 'cross-hatch',
      roughness: 1.1,
    });

    // Draw active animated spark bars
    const barCount = 6;
    for (let i = 0; i < barCount; i++) {
      const height = Math.min(18, Math.max(4, ((requestCount + i * 3) % 18) + (activeCount > 0 ? 4 : 1)));
      rc.line(16 + i * 10, 24, 16 + i * 10, 24 - height, {
        stroke: i % 2 === 0 ? '#10b981' : '#059669',
        strokeWidth: 2,
        roughness: 0.8,
      });
    }
  }, [requestCount, activeCount]);

  return (
    <div className={`relative inline-flex items-center gap-2 px-2.5 py-1 select-none font-sans text-xs ${className}`}>
      <canvas ref={canvasRef} width={80} height={28} className="pointer-events-none" />
      <span className="font-mono text-[11px] font-bold text-slate-700">{requestCount} reqs</span>
    </div>
  );
};
