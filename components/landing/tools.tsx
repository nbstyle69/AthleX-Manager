'use client';

import { Video, Timer, Calculator, Trophy, CalendarClock, Sparkles, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

const ICONS: LucideIcon[] = [Video, Timer, Calculator, Trophy, CalendarClock, Sparkles];

export function Tools() {
  const { t } = useLanguage();
  return (
    <section id="tools" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t.tools.tag}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.tools.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.tools.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.tools.items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={item.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/25"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-secondary/50">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={2} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
