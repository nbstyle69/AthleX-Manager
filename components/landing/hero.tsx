'use client';

import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';

export function Hero() {
  const { t } = useLanguage();
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-24 pt-24 md:pt-32 lg:grid-cols-2">
        <div className="flex flex-col items-start">
          <span className="mb-6 inline-flex items-center rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t.hero.badge}
          </span>

          <h1 className="font-display text-6xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
            <span className="block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t.hero.title1}
            </span>
            <span className="block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t.hero.title2}
            </span>
            <span className="block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t.hero.title3}
            </span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            {t.hero.subtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="/pricing/onboarding">
                {t.hero.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#app">
                <Play className="h-4 w-4" />
                {t.hero.ctaSecondary}
              </a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">{t.hero.note}</p>
        </div>

        {/* Cinematic visual (CSS) */}
        <div className="relative hidden lg:block">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-secondary/60 to-background">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_55%)]" />
            <div className="absolute inset-0 flex items-end p-8">
              <div className="w-full rounded-xl border border-border bg-background/60 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                    WOD · Fran
                  </span>
                  <span className="text-xs text-muted-foreground">21-15-9</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {['02:41', '03:18', '04:02'].map((v, i) => (
                    <div key={v} className="rounded-lg border border-border bg-secondary/40 p-3 text-center">
                      <div className="font-display text-lg font-bold text-foreground">{v}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">#{i + 1}</div>
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
