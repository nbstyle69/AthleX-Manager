'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MAX_LINES = 3;

/**
 * Description d'une séance du Whiteboard, limitée à 3 lignes avec « Afficher
 * tout » / « Réduire ». Le bouton n'existe que si le texte dépasse réellement
 * 3 lignes, mesuré sur le rendu (hauteur du contenu contre 3 hauteurs de ligne),
 * et la mesure suit la largeur de la carte.
 *
 * Sans JavaScript ni mesure, rien n'est limité : la limite n'est posée qu'une
 * fois le dépassement constaté, et elle est levée à l'impression. L'état est
 * propre à chaque carte et n'est pas persisté.
 */
export default function ClampedDescription({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      setOverflows(Number.isFinite(lineHeight) && el.scrollHeight > MAX_LINES * lineHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const clamped = overflows && !expanded;

  return (
    <>
      <p ref={ref} id={id} className={cn(className, clamped && 'line-clamp-3 print:line-clamp-none')}>{text}</p>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(e => !e)}
          className="print:hidden -ml-1 inline-flex min-h-8 items-center rounded-ax-control px-1 text-[11px] font-semibold text-ax-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
        >
          {expanded ? 'Réduire' : 'Afficher tout'}
        </button>
      )}
    </>
  );
}
