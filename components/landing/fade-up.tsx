'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FadeUpProps {
  children: ReactNode;
  /** Delay before the transition starts, in seconds. */
  delay?: number;
  className?: string;
}

/**
 * Scroll-triggered fade + rise, played once.
 *
 * Zero-dependency stand-in for framer-motion's
 * `initial / whileInView / viewport={{ once: true }}` pattern:
 * an IntersectionObserver flips a class, the transition is pure CSS.
 * Honours `prefers-reduced-motion` and degrades to "always visible"
 * when IntersectionObserver is unavailable, so content is never
 * trapped at opacity 0.
 */
export function FadeUp({ children, delay = 0, className }: FadeUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -4% 0px' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform]',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
      // Duration and easing are set inline rather than with Tailwind's
      // arbitrary-value duration / ease utilities: tailwindcss-animate also
      // registers those prefixes for animation-*, so Tailwind treats the
      // arbitrary values as ambiguous and emits no rule at all.
      // (Deliberately phrased without the literal class syntax -- Tailwind
      // scans raw file text, comments included, and would flag it again.)
      style={{
        transitionDelay: `${delay}s`,
        transitionDuration: '600ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
}
