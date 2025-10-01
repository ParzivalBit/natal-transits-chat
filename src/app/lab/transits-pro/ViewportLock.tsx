'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

export default function ViewportLock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      // Misura una sola volta la distanza dall’inizio della viewport
      // e calcola l’altezza residua. Non reagiamo allo scroll!
      const topInViewport = el.getBoundingClientRect().top;
      const remaining = Math.max(0, window.innerHeight - topInViewport);
      setH(remaining);
    };

    compute();

    // Solo resize/zoom: niente scroll handler (era la causa del loop)
    const ro = new ResizeObserver(compute);
    ro.observe(document.documentElement);
    window.addEventListener('resize', compute);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={h != null ? { height: `${h}px` } : undefined}
      className="overflow-hidden"
    >
      {children}
    </div>
  );
}
