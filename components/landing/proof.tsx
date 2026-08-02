'use client';

import { Quote } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export function Proof() {
  const { t } = useLanguage();
  return (
    <section id="proof" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <span className="mb-4 inline-flex items-center rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t.proof.tag}
          </span>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.proof.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.proof.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {t.proof.pillars.map((p) => (
            <div key={p.title} className="bg-background p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <span className="mb-4 inline-flex items-center rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t.proof.testimonialsTag}
          </span>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {t.proof.testimonialsTitle}
          </h3>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {t.proof.testimonials.map((item) => (
              <figure
                key={item.quote}
                className="flex flex-col rounded-2xl border border-border bg-card p-6"
              >
                <Quote className="h-6 w-6 text-muted-foreground/50" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-border pt-4">
                  <div className="text-sm font-semibold text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
