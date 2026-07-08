'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';

const HREFS = ['/pricing/onboarding', '/pricing/onboarding', 'mailto:contact@athlex.app'];

export function Pricing() {
  const { t } = useLanguage();
  return (
    <section id="pricing" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t.pricing.tag}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.pricing.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.pricing.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {t.pricing.plans.map((plan, i) => {
            const featured = i === 1;
            return (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-7',
                  featured ? 'border-foreground bg-card' : 'border-border bg-card',
                )}
              >
                {featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                    {t.pricing.popular}
                  </span>
                )}
                <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-foreground">{plan.price}</span>
                  {i === 1 && <span className="text-sm text-muted-foreground">{t.pricing.perMonth}</span>}
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={featured ? 'default' : 'outline'} className="mt-7 w-full">
                  <a href={HREFS[i]}>{plan.cta}</a>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
