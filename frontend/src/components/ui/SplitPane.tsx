import React, { useCallback, useEffect, useRef, useState } from 'react';
import { spacing } from '../../design/tokens';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  storageKey?: string;
  minLeft?: number;
  minRight?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultRatio = 0.45,
  storageKey = 'httpeek_split_ratio',
  minLeft = spacing.splitMinLeft,
  minRight = spacing.splitMinRight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => {
    if (typeof localStorage === 'undefined') return defaultRatio;
    const saved = parseFloat(localStorage.getItem(storageKey) || String(defaultRatio));
    return Number.isFinite(saved) ? saved : defaultRatio;
  });
  const dragging = useRef(false);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = (e.clientX - rect.left) / rect.width;
      const minR = minLeft / rect.width;
      const maxR = 1 - minRight / rect.width;
      setRatio(Math.max(minR, Math.min(maxR, next)));
    },
    [minLeft, minRight]
  );

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, String(ratio));
    }
  }, [ratio, storageKey]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden h-full">
      <div className="overflow-hidden flex flex-col" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="htk-splitter"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
      />
      <div className="overflow-hidden flex flex-col flex-1 min-w-0">{right}</div>
    </div>
  );
};
