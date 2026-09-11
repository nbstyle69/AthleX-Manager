'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import { HELP_STRINGS, THEMES, type Locale } from '@/lib/tutorials/i18n';
import { buildIndex, matchesRole, searchSlugs } from '@/lib/tutorials/search';
import { excerpt } from '@/lib/tutorials/text';
import type { TutorialMeta } from '@/lib/tutorials';

type RoleFilter = 'all' | 'owner' | 'coach';

/**
 * Liste, filtres et recherche de la page Aide. Les deux langues arrivent déjà
 * rendues depuis le serveur : changer de langue ne déclenche aucune requête, et
 * la recherche reste dans la langue courante (§6).
 */
export default function HelpBrowser({ indexes }: { indexes: Record<Locale, TutorialMeta[]> }) {
  const { lang } = useLanguage();
  const strings = HELP_STRINGS[lang];
  const tutorials = indexes[lang] ?? indexes.fr;

  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const input = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => buildIndex(tutorials), [tutorials]);

  // Raccourci « / » : la recherche est le geste le plus fréquent de cette page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const byRole = useCallback(
    (list: TutorialMeta[]) => list.filter((t) => matchesRole(t.role, role)),
    [role],
  );

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const ranked = searchSlugs(fuse, query);
    const bySlug = new Map(tutorials.map((t) => [t.slug, t]));
    return byRole(ranked.map((slug) => bySlug.get(slug)).filter((t): t is TutorialMeta => Boolean(t)));
  }, [query, fuse, tutorials, byRole]);

  const filters: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: strings.filterAll },
    { key: 'owner', label: strings.filterOwner },
    { key: 'coach', label: strings.filterCoach },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">{strings.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{strings.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            ref={input}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={strings.searchLabel}
            placeholder={strings.searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={strings.seeAll}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setRole(f.key)}
              aria-pressed={role === f.key}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                role === f.key
                  ? 'bg-white text-[#0A0A0A]'
                  : 'border border-white/10 text-gray-400 hover:text-white',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {results ? (
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {strings.resultsCount(results.length)}
          </p>
          {results.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center">
              <p className="text-sm text-gray-400">{strings.noResults}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setRole('all');
                }}
                className="mt-3 text-sm font-bold text-white underline underline-offset-4"
              >
                {strings.seeAll}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {results.map((t) => (
                <Card key={t.slug} tutorial={t} lang={lang} snippet={excerpt(t.plain, query)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {THEMES.map((theme) => {
            const list = byRole(tutorials.filter((t) => t.theme === theme));
            if (list.length === 0) return null;
            return (
              <section key={theme}>
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">
                  {strings.themes[theme]}
                </h2>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {list.map((t) => (
                    <Card key={t.slug} tutorial={t} lang={lang} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({
  tutorial,
  lang,
  snippet,
}: {
  tutorial: TutorialMeta;
  lang: Locale;
  snippet?: string;
}) {
  const strings = HELP_STRINGS[lang];
  return (
    <Link
      href={`/help/${tutorial.slug}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/25 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-white">{tutorial.title}</p>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {strings.roles[tutorial.role]}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{tutorial.summary}</p>
      {snippet && <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{snippet}</p>}
    </Link>
  );
}
