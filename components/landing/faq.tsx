'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export function Faq() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <span className="mb-4 inline-flex items-center rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t.faq.tag}
          </span>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.faq.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.faq.subtitle}</p>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-secondary/30"
                >
                  <span className="font-display text-base font-semibold text-foreground">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
