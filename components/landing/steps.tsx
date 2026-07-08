'use client';

import { useLanguage } from '@/components/language-provider';

export function Steps() {
  const { t } = useLanguage();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.steps.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.steps.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {t.steps.items.map((item) => (
            <div key={item.n} className="relative">
              <span className="font-display text-5xl font-bold text-muted-foreground/30">{item.n}</span>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
