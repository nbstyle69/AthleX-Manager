'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';

export function FinalCta() {
  const { t } = useLanguage();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            {t.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">{t.finalCta.subtitle}</p>
          <Button asChild size="lg" className="mt-8">
            <a href="/pricing/onboarding">
              {t.finalCta.cta}
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
