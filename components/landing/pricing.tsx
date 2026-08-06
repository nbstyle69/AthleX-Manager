'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import { FadeUp } from './fade-up';
import { SpotlightBorder } from './spotlight-border';

const HREFS = ['/pricing/onboarding', '/pricing/onboarding'];

/** Emerald-400 channels — the ring colour on the recommended plan. */
const EMERALD = '52, 211, 153';

export function Pricing() {
  const { t } = useLanguage();

  return (
    <section id="pricing" className="border-t border-border">
      {/* Header and cards share one max-w-4xl column so the plan grid lines up
          with the title instead of floating inset inside a wider section. */}
      <div className="mx-auto max-w-4xl px-6 py-24 md:py-28">
        {/* Header: title left, positioning line right on large screens. */}
        <div className="mb-14 flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <FadeUp>
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-landing-border bg-landing-surface px-3 py-1 text-xs text-foreground/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                {t.pricing.tag}
              </span>
            </FadeUp>
            <FadeUp delay={0.1}>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {t.pricing.title}
              </h2>
            </FadeUp>
          </div>
          <FadeUp delay={0.2}>
            <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
              {t.pricing.subtitle}
            </p>
          </FadeUp>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {t.pricing.plans.map((plan, i) => {
            const featured = i === 1;

            return (
              <SpotlightBorder
                key={plan.name}
                size={700}
                intensity={featured ? 0.95 : 0.7}
                color={featured ? EMERALD : '255, 255, 255'}
                className="relative h-full p-2 sm:p-3"
              >
                <div
                  className={cn(
                    'relative flex h-full flex-col rounded-2xl border border-landing-border p-7 sm:p-8',
                    featured ? 'bg-secondary' : 'bg-card',
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      {t.pricing.popular}
                    </span>
                  )}

                  <FadeUp>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {plan.name}
                    </div>
                  </FadeUp>

                  <div className="mt-3 border-t border-landing-border" />

                  <FadeUp delay={0.1}>
                    <div className="mt-10 flex items-baseline gap-2">
                      <span className="font-display text-[2.75rem] font-bold leading-none tracking-tight text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-lg text-muted-foreground">{t.pricing.perMonth}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{plan.priceNote}</p>
                  </FadeUp>

                  <FadeUp delay={0.2}>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{plan.desc}</p>
                  </FadeUp>

                  <FadeUp delay={0.3}>
                    <div className="mt-7">
                      <Button
                        asChild
                        variant={featured ? 'default' : 'secondary'}
                        className={cn(
                          'w-full rounded-full',
                          !featured &&
                            'border border-landing-border bg-landing-surface font-medium backdrop-blur-[2.5px] hover:bg-landing-surface-hover',
                        )}
                      >
                        <a href={HREFS[i] ?? HREFS[0]}>{plan.cta}</a>
                      </Button>
                    </div>
                  </FadeUp>

                  {/* flex-auto, not flex-1: the wrapper absorbs the leftover
                      height of the shorter card without shrinking the longer
                      list below its own content. */}
                  <FadeUp delay={0.4} className="flex flex-auto flex-col">
                    <ul className="mt-7 flex flex-col">
                      {plan.features.map((f, fi) => {
                        // Lines ending in ":" introduce the list ("Tout le plan Coach, plus :")
                        // — they are a label, not a feature, so they get no checkmark.
                        const isLabel = f.trimEnd().endsWith(':');

                        if (isLabel) {
                          return (
                            <li
                              key={f}
                              className={cn(
                                'py-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground',
                                fi !== 0 && 'border-t border-landing-border',
                              )}
                            >
                              {f}
                            </li>
                          );
                        }

                        return (
                          <li
                            key={f}
                            className={cn(
                              'flex items-center gap-3 py-4 text-sm text-foreground/85',
                              fi !== 0 && 'border-t border-landing-border',
                            )}
                          >
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-foreground/20 bg-foreground/[0.06]">
                              <Check className="h-3 w-3 text-foreground" strokeWidth={3} />
                            </span>
                            {f}
                          </li>
                        );
                      })}
                    </ul>
                  </FadeUp>
                </div>
              </SpotlightBorder>
            );
          })}
        </div>
      </div>
    </section>
  );
}
