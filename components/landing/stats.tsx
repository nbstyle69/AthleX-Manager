'use client';

import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';

export function Stats() {
  const { t } = useLanguage();
  return (
    <section className="border-y border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
        {t.stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              'px-6 py-8 text-center',
              // vertical dividers
              i % 2 === 1 && 'border-l border-border',
              i % 4 !== 0 && 'md:border-l md:border-border',
              // horizontal divider for the 2nd row on mobile
              i >= 2 && 'border-t border-border md:border-t-0',
            )}
          >
            <div className="font-display text-2xl font-bold text-foreground md:text-3xl">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
