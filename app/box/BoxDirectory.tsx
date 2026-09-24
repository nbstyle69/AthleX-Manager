'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Users, Dumbbell, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { Input } from '@/components/ui/input';

export interface DirectoryBox {
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  city: string | null;
  sport_type: string[];
  member_count: number;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function BoxDirectory({ boxes }: { boxes: DirectoryBox[] }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');

  const cities = useMemo(() => {
    const set = new Set<string>();
    boxes.forEach((b) => b.city && set.add(b.city));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [boxes]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return boxes.filter((b) => {
      if (city && b.city !== city) return false;
      if (!q) return true;
      const haystack = normalize(
        [b.name, b.city ?? '', b.tagline ?? '', ...(b.sport_type ?? [])].join(' '),
      );
      return haystack.includes(q);
    });
  }, [boxes, query, city]);

  return (
    <div className="max-w-5xl mx-auto px-6">
      <section className="pb-8 pt-12 md:pt-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ax-text md:text-4xl">
          {t.directory.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ax-text-secondary">{t.directory.subtitle}</p>
      </section>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ax-text-secondary" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.directory.searchPlaceholder}
            className="pl-10"
          />
        </div>
        {cities.length > 0 && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label={t.directory.allCities}
            className="rounded-ax-control border border-ax-border bg-ax-surface px-4 py-3 text-sm text-ax-text outline-none transition-colors focus:border-ax-focus sm:w-52"
          >
            <option value="">{t.directory.allCities}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-ax-text-secondary">{t.directory.noResults}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pb-4">
          {filtered.map((b) => (
            <Link
              key={b.slug}
              href={`/box/${b.slug}`}
              className="group flex flex-col overflow-hidden rounded-ax-card border border-ax-border bg-ax-surface transition-colors hover:border-ax-input-border"
            >
              <div className="relative h-28 bg-ax-hover">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-ax-surface-secondary" />
                )}
                {/* Logo overlaps the banner, in front */}
                <div className="absolute left-5 -bottom-7 z-10">
                  {b.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.logo_url}
                      alt={b.name}
                      className="h-14 w-14 rounded-ax-control border-2 border-ax-surface bg-ax-surface object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-ax-control border-2 border-ax-surface bg-ax-surface-secondary shadow-lg">
                      <span className="text-xl font-bold text-ax-text">{b.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 pt-10 flex-1 flex flex-col">
                <h2 className="font-display font-semibold leading-tight text-ax-text">{b.name}</h2>
                {b.tagline && (
                  <p className="mt-1 line-clamp-2 text-xs text-ax-text-secondary">{b.tagline}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ax-text-secondary">
                  {b.city && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {b.city}
                    </span>
                  )}
                  {b.member_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {b.member_count}
                    </span>
                  )}
                  {(b.sport_type ?? []).slice(0, 1).map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <Dumbbell size={12} /> {s}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1 border-t border-ax-border pt-4 text-xs font-semibold text-ax-text-secondary transition-colors group-hover:text-ax-text">
                  {t.directory.viewBox} <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
