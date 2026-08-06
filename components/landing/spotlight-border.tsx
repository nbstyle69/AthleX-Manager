'use client';

import { useCallback, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightBorderProps {
  children: ReactNode;
  className?: string;
  /** Diameter of the halo that lights up the ring, in px. */
  size?: number;
  /** Peak opacity of the ring under the cursor, 0 → 1. */
  intensity?: number;
  /** Ring colour as raw RGB channels, e.g. '52, 211, 153'. */
  color?: string;
}

/** Parked far outside the box so the ring is dark until the cursor arrives. */
const OFF = '-9999px';

/**
 * 1px gradient ring that follows the cursor.
 *
 * The ring is a radial gradient clipped to the element's 1px padding box
 * via `mask-composite: exclude` — the standard "gradient border" trick,
 * which keeps the border perfectly rounded without a second element.
 * Position is fed through CSS custom properties updated on pointermove,
 * so no React state changes and no re-render happens while moving.
 */
export function SpotlightBorder({
  children,
  className,
  size = 520,
  intensity = 0.5,
  color = '255, 255, 255',
}: SpotlightBorderProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, []);

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--spot-x', OFF);
    el.style.setProperty('--spot-y', OFF);
  }, []);

  const maskLayers = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn('group/spot relative rounded-2xl', className)}
      style={
        {
          '--spot-x': OFF,
          '--spot-y': OFF,
          '--spot-size': `${size}px`,
          '--spot-intensity': intensity,
        } as CSSProperties
      }
    >
      {/* Static hairline, always visible. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl border border-landing-border"
      />

      {/* Cursor-following ring. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-70 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          padding: 1,
          background: `radial-gradient(circle var(--spot-size) at var(--spot-x) var(--spot-y), rgba(${color}, var(--spot-intensity)), transparent 60%)`,
          WebkitMask: maskLayers,
          mask: maskLayers,
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      <div className="relative h-full">{children}</div>
    </div>
  );
}
