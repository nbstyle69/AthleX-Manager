'use client';

import { useState } from 'react';
import { Trophy, Users } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';

export interface AthleteRow {
  username: string;
  level: string | null;
  avatar_url: string | null;
  elo: number;
}

export interface BoxRow {
  name: string;
  city: string | null;
  slug: string;
  avgElo: number;
  members: number;
}

function medal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Leaderboard({
  athletes,
  boxes,
}: {
  athletes: AthleteRow[];
  boxes: BoxRow[];
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'athletes' | 'boxes'>('athletes');

  return (
    <section id="classement" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 md:py-28">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t.leaderboard.tag}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t.leaderboard.title}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.leaderboard.subtitle}</p>
        </div>

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
          <ul className="space-y-2">
            {athletes.length === 0 && (
              <li className="rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
                {t.leaderboard.empty}
              </li>
            )}
            {athletes.map((a, i) => (
              <li
                key={`${a.username}-${i}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold text-muted-foreground">
                  {medal(i + 1)}
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
                  <span className="w-8 shrink-0 text-center text-sm font-bold text-muted-foreground">
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
    </section>
  );
}
