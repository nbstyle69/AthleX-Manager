'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { StoreBadges } from '@/components/store-badges';

export function AthleteCta() {
  const { t } = useLanguage();

  return (
    <section id="athletes" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="grid grid-cols-1 gap-10 rounded-2xl border border-border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.athleteCta.tag}
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {t.athleteCta.title}
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">{t.athleteCta.subtitle}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="/signup">{t.athleteCta.cta}</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t.athleteCta.note}</p>

            <StoreBadges className="mt-4" />
          </div>

          <ul className="flex flex-col justify-center gap-4">
            {t.athleteCta.benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={2.5} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
