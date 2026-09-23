'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { setActiveBox } from '@/app/(dashboard)/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface SwitcherBox {
  id: string;
  name: string;
}

export default function BoxSwitcher({
  boxes,
  activeBoxId,
}: {
  boxes: SwitcherBox[];
  activeBoxId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = boxes.find((b) => b.id === activeBoxId) ?? boxes[0];

  function select(id: string) {
    setOpen(false);
    if (id === activeBoxId) return;
    startTransition(async () => {
      await setActiveBox(id);
      // Full reload so every component (incl. client-only cards that fetch
      // their own box) picks up the new active box, not just server ones.
      window.location.reload();
    });
  }

  return (
    <div ref={ref} className="relative mt-3">
      <Button
        variant="ax-outline"
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="w-full min-h-10 px-2.5 py-2"
      >
        <span className="text-xs font-semibold text-ax-text truncate flex-1 text-left">
          {active?.name}
        </span>
        <ChevronsUpDown size={14} className="text-ax-text-muted shrink-0" />
      </Button>

      {open && (
        <Card className="absolute left-0 right-0 mt-1 z-50 shadow-ax-panel py-1 max-h-72 overflow-y-auto">
          {boxes.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => select(b.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-focus motion-reduce:transition-none',
                b.id === activeBoxId ? 'text-ax-accent-text bg-ax-accent-soft' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover',
              )}
            >
              <span className="truncate flex-1">{b.name}</span>
              {b.id === activeBoxId && <Check size={13} className="text-ax-accent-text shrink-0" />}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
