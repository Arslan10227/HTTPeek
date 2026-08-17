import React, { useEffect, useRef } from 'react';
import lottie, { AnimationItem } from 'lottie-web';

// Embedded high-performance vector Lottie animation JSON schemas
const ANIMATIONS: Record<string, any> = {
  radar: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 120,
    h: 120,
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'PulseRing2',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [80] }, { t: 60, s: [0] }] },
          r: { k: 0 },
          p: { k: [60, 60, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 15, s: [20, 20, 100] }, { t: 60, s: [100, 100, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [100, 100] },
          },
          {
            ty: 'st',
            c: { k: [0.06, 0.72, 0.51, 1] },
            w: { k: 3 },
          },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'PulseRing1',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [100] }, { t: 45, s: [0] }] },
          r: { k: 0 },
          p: { k: [60, 60, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [10, 10, 100] }, { t: 45, s: [80, 80, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [80, 80] },
          },
          {
            ty: 'st',
            c: { k: [0.2, 0.83, 0.6, 1] },
            w: { k: 4 },
          },
        ],
      },
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'CoreDot',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: 0 },
          p: { k: [60, 60, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [90, 90, 100] }, { t: 30, s: [115, 115, 100] }, { t: 60, s: [90, 90, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [22, 22] },
          },
          {
            ty: 'fl',
            c: { k: [0.02, 0.59, 0.41, 1] },
          },
        ],
      },
    ],
  },
  loading: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Orbit1',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [25, 0] },
            s: { k: [14, 14] },
          },
          {
            ty: 'fl',
            c: { k: [0.31, 0.27, 0.9, 1] },
          },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Orbit2',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [180] }, { t: 60, s: [540] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [25, 0] },
            s: { k: [10, 10] },
          },
          {
            ty: 'fl',
            c: { k: [0.06, 0.72, 0.51, 1] },
          },
        ],
      },
    ],
  },
  empty: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 120,
    h: 120,
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'FloatingBox',
        sr: 1,
        ks: {
          o: { k: 90 },
          r: { k: [{ t: 0, s: [-3] }, { t: 30, s: [3] }, { t: 60, s: [-3] }] },
          p: { k: [{ t: 0, s: [60, 58, 0] }, { t: 30, s: [60, 52, 0] }, { t: 60, s: [60, 58, 0] }] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          {
            ty: 'rc',
            p: { k: [0, 0] },
            s: { k: [46, 46] },
            r: { k: 8 },
          },
          {
            ty: 'fl',
            c: { k: [0.94, 0.96, 0.98, 1] },
          },
          {
            ty: 'st',
            c: { k: [0.8, 0.84, 0.88, 1] },
            w: { k: 2.5 },
          },
        ],
      },
    ],
  },
};

interface LottiePlayerProps {
  type: 'radar' | 'loading' | 'empty';
  width?: number;
  height?: number;
  className?: string;
  loop?: boolean;
}

export const LottiePlayer: React.FC<LottiePlayerProps> = ({
  type,
  width = 80,
  height = 80,
  className = '',
  loop = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const animData = ANIMATIONS[type] || ANIMATIONS.empty;

    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay: true,
      animationData: animData,
    });

    return () => {
      animRef.current?.destroy();
    };
  }, [type, loop]);

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`flex items-center justify-center select-none pointer-events-none ${className}`}
    />
  );
};
