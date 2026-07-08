'use client';

import { Dumbbell, Users, LayoutDashboard, Check, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

const ICONS: LucideIcon[] = [Dumbbell, Users, LayoutDashboard];

export function Experiences() {
  const { t } = useLanguage();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.experiences.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.experiences.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {t.experiences.items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <div key={item.role} className="flex flex-col rounded-2xl border border-border bg-card p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                  <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{item.role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                <ul className="mt-6 space-y-3">
                  {item.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
