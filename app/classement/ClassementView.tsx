'use client';

import { useMemo, useState } from 'react';
import { Search, Trophy, Users } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import type { AthleteRow, BoxRow } from '@/lib/leaderboard';

const PAGE_SIZE = 50;

function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export function ClassementView({
  athletes,
  boxes,
}: {
  athletes: AthleteRow[];
  boxes: BoxRow[];
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'athletes' | 'boxes'>('athletes');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Keep the global ELO rank stable even while filtering.
  const rankedAthletes = useMemo(
    () => athletes.map((a, i) => ({ ...a, rank: i + 1 })),
    [athletes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rankedAthletes;
    return rankedAthletes.filter((a) => a.username.toLowerCase().includes(q));
  }, [rankedAthletes, query]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <div className="mb-8 inline-flex rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab('athletes')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'athletes'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Trophy className="h-4 w-4" /> {t.leaderboard.athletes}
        </button>
        <button
          type="button"
          onClick={() => setTab('boxes')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            tab === 'boxes'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="h-4 w-4" /> {t.leaderboard.boxes}
        </button>
      </div>

      {tab === 'athletes' ? (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder={t.leaderboard.searchPlaceholder}
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
              />
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
              {athletes.length} {t.leaderboard.countAthletes}
            </span>
          </div>

          <ul className="space-y-2">
            {shown.length === 0 && (
              <li className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
                {query ? t.leaderboard.noResults : t.leaderboard.empty}
              </li>
            )}
            {shown.map((a) => (
              <li
                key={`${a.username}-${a.rank}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="w-10 shrink-0 text-center text-sm font-bold text-muted-foreground">
                  {medal(a.rank)}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-bold text-foreground">
                  {a.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar_url} alt={a.username} className="h-full w-full object-cover" />
                  ) : (
                    initials(a.username)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{a.username}</p>
                  {a.level && (
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{a.level}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-foreground">{a.elo}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.leaderboard.elo}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {visible < filtered.length && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/30"
              >
                {t.leaderboard.viewMore}
              </button>
            </div>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {boxes.length === 0 && (
            <li className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
              {t.leaderboard.empty}
            </li>
          )}
          {boxes.map((b, i) => (
            <li key={b.slug}>
              <a
                href={`/box/${b.slug}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30"
              >
                <span className="w-10 shrink-0 text-center text-sm font-bold text-muted-foreground">
                  {medal(i + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[b.city, `${b.members} ${t.leaderboard.membersLabel}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-foreground">{b.avgElo}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.leaderboard.avgElo}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
