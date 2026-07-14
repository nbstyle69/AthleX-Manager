'use client';

import { Check, Apple, Smartphone } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';

export function AppShowcase() {
  const { t } = useLanguage();
  return (
    <section id="app" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-24 md:py-28 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.app.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.app.subtitle}</p>
          <ul className="mt-8 space-y-4">
            {t.app.benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary/50">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-foreground/40"
            >
              <Apple className="h-4 w-4" /> App Store
            </a>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-foreground/40"
            >
              <Smartphone className="h-4 w-4" /> Google Play
            </a>
          </div>
        </div>

        {/* Phone mockup (CSS) */}
        <div className="flex justify-center">
          <div className="relative h-[560px] w-[280px] rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl">
            <div className="absolute left-1/2 top-3 h-5 w-28 -translate-x-1/2 rounded-full bg-background" />
            <div className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] bg-background">
              <div className="flex items-center justify-between px-5 pt-10">
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">AthleX</span>
                <span className="h-7 w-7 rounded-full bg-secondary" />
              </div>
              <div className="mt-5 px-5">
                <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.app.mockupTitle}</div>
                  <div className="mt-1 font-display text-lg font-bold text-foreground">Murph</div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-border">
                    <div className="h-1.5 w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {['17h30', '18h30', '19h30', '12h00'].map((h) => (
                    <div key={h} className="rounded-xl border border-border bg-card p-3 text-center">
                      <div className="font-display text-sm font-bold text-foreground">{h}</div>
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{t.app.book}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
