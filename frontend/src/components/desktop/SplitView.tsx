import React, { useState, useRef, useCallback } from 'react';

interface VerticalSplitViewProps {
  ratio: number;
  minRatio?: number;
  maxRatio?: number;
  onRatioChanged?: (ratio: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
}

export const VerticalSplitView: React.FC<VerticalSplitViewProps> = ({
  ratio,
  minRatio = 0.15,
  maxRatio = 0.85,
  onRatioChanged,
  left,
  right,
}) => {
  const [currentRatio, setCurrentRatio] = useState(ratio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      const clamped = Math.max(minRatio, Math.min(maxRatio, newRatio));
      setCurrentRatio(clamped);
      onRatioChanged?.(clamped);
    },
    [minRatio, maxRatio, onRatioChanged]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0 w-full h-full relative">
      {/* Left Pane */}
      <div
        className="flex overflow-hidden min-h-0 h-full"
        style={{ width: `${currentRatio * 100}%` }}
      >
        {left}
      </div>

      {/* Splitter Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="split-divider shrink-0 z-20"
        title="Drag to resize"
      />

      {/* Right Pane */}
      <div
        className="flex overflow-hidden min-h-0 h-full flex-1"
        style={{ width: `${(1 - currentRatio) * 100}%` }}
      >
        {right}
      </div>
    </div>
  );
};
