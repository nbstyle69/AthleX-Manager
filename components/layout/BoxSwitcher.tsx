'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import { setActiveBox } from '@/app/(dashboard)/actions';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-colors disabled:opacity-60"
      >
        <span className="text-xs font-semibold text-white truncate flex-1 text-left">
          {active?.name}
        </span>
        <ChevronsUpDown size={14} className="text-white/40 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-50 rounded-lg bg-[#111111] border border-white/10 shadow-xl py-1 max-h-72 overflow-y-auto">
          {boxes.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => select(b.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors',
                b.id === activeBoxId ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5',
              )}
            >
              <span className="truncate flex-1">{b.name}</span>
              {b.id === activeBoxId && <Check size={13} className="text-white shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
