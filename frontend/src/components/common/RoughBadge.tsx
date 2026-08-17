import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';

interface RoughBadgeProps {
  text: string;
  subtext?: string;
  color?: string;
  fill?: string;
  className?: string;
}

export const RoughBadge: React.FC<RoughBadgeProps> = ({
  text,
  subtext,
  color = '#059669',
  fill = '#ecfdf5',
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
    rc.rectangle(2, 2, canvas.width - 4, canvas.height - 4, {
      stroke: color,
      strokeWidth: 1.5,
      fill: fill,
      fillStyle: 'zigzag',
      roughness: 1.2,
      bowing: 1.5,
    });
  }, [color, fill]);

  return (
    <div className={`relative inline-flex items-center justify-center px-3 py-1 select-none font-sans ${className}`}>
      <canvas ref={canvasRef} width={130} height={32} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="relative z-10 flex items-center gap-1.5 font-bold text-xs" style={{ color }}>
        <span>{text}</span>
        {subtext && <span className="text-[10px] font-mono opacity-80">({subtext})</span>}
      </div>
    </div>
  );
};
