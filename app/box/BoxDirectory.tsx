'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Users, Dumbbell, ChevronRight } from 'lucide-react';

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

const GOLD = '#FFFFFF';

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function BoxDirectory({ boxes }: { boxes: DirectoryBox[] }) {
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une box, une ville, un sport…"
            className="w-full bg-[#111] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>
        {cities.length > 0 && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="bg-[#111] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 transition-colors sm:w-52"
          >
            <option value="">Toutes les villes</option>
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
          <p className="text-sm text-gray-500">Aucune box ne correspond à ta recherche.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pb-4">
          {filtered.map((b) => (
            <Link
              key={b.slug}
              href={`/box/${b.slug}`}
              className="group bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/20 transition-colors flex flex-col"
            >
              <div className="h-28 bg-[#161616] relative">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#161616] to-[#1f1f1f]" />
                )}
              </div>
              <div className="p-5 -mt-10 flex-1 flex flex-col">
                {b.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.logo_url}
                    alt={b.name}
                    className="w-14 h-14 rounded-xl border-2 border-[#111] object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-[#111] bg-[#1a1a1a] flex items-center justify-center shadow-lg">
                    <span className="text-xl font-black" style={{ color: GOLD }}>
                      {b.name.charAt(0)}
                    </span>
                  </div>
                )}
                <h2 className="font-black text-white mt-3 leading-tight">{b.name}</h2>
                {b.tagline && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{b.tagline}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs text-gray-500">
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
                <div className="flex items-center gap-1 mt-4 pt-4 border-t border-white/[0.06] text-xs font-semibold text-gray-400 group-hover:text-white transition-colors">
                  Voir la box <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
