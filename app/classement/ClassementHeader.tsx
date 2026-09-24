'use client';

import { useLanguage } from '@/components/language-provider';

export function ClassementHeader() {
  const { t } = useLanguage();
  return (
    <section className="border-b border-ax-border">
      <div className="mx-auto max-w-3xl px-6 pb-4 pt-12 md:pt-16">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ax-text-secondary">
          {t.leaderboard.tag}
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ax-text md:text-4xl">
          {t.leaderboard.title}
        </h1>
        <p className="mt-4 text-ax-text-secondary">{t.leaderboard.subtitle}</p>
      </div>
    </section>
  );
}
