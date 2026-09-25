'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS', inter: 'INTER', gx: 'GX', pro: 'PRO' };
// Niveaux : memes jetons que le reste du Manager, lisibles dans les deux themes.
const LEVEL_COLOR: Record<string, string> = { 'rx+': 'var(--ax-level-rx-plus)', rx: 'var(--ax-level-rx)', scaled: 'var(--ax-level-scaled)', foundations: 'var(--ax-purple)', inter: 'var(--ax-level-inter)', gx: 'var(--ax-level-gx)', pro: 'var(--ax-level-pro)' };

const PAGE_SIZE = 10;

interface MemberRow { username: string; elo: number; level: string; gender: string | null }

interface ProfileRow { username: string | null; level: string | null; elo: number | null; gender: string | null }

/**
 * Classement ELO des membres de la box. Vit avec les Tournois : c'est un
 * classement sportif, pas un indicateur de gestion.
 */
export default function TopEloCard({ boxId }: { boxId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const load = useCallback(async () => {
    // `gender` n'est plus lisible en colonne par `authenticated` (Lot 0-bis) :
    // le staff de la box le lit par cette RPC, seul lecteur autorisé.
    const { data } = await supabase.rpc('get_box_members_private_profiles', { p_box_id: boxId });

    const rows = ((data ?? []) as ProfileRow[])
      .filter((p): p is ProfileRow => Boolean(p?.username))
      .map(p => ({
        username: p.username as string,
        level: p.level ?? 'rx',
        elo: p.elo ?? 1000,
        gender: p.gender ?? null,
      }));

    setMembers(rows);
    setLoading(false);
  }, [boxId, supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => (genderFilter === 'all' ? members : members.filter(m => m.gender === genderFilter)),
    [members, genderFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = useMemo(
    () => [...filtered].sort((a, b) => b.elo - a.elo).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  if (loading) {
    return (
      <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-ax-text" />
        <span className="text-sm text-ax-text-secondary">Chargement du classement…</span>
      </div>
    );
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-ax-text flex items-center gap-2">
          <Trophy size={16} className="text-ax-text" />
          Classement ELO — {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {([['all', 'Tous'], ['male', '♂ Hommes'], ['female', '♀ Femmes']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setGenderFilter(key); setPage(0); }}
                className={`px-2.5 py-1 rounded-ax-control text-xs font-bold transition-colors ${genderFilter === key ? 'bg-ax-hover text-ax-text' : 'text-ax-text-muted hover:text-ax-text'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1 rounded-ax-control text-ax-text-muted hover:text-ax-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-ax-text-secondary font-bold min-w-[40px] text-center">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1 rounded-ax-control text-ax-text-muted hover:text-ax-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-ax-text-muted text-center py-4">Aucun membre</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {shown.map((m, i) => {
            const rank = page * PAGE_SIZE + i + 1;
            const lvlColor = LEVEL_COLOR[m.level] ?? 'var(--ax-neutral)';
            return (
              <div key={m.username + rank} className="flex items-center gap-3 bg-ax-background rounded-ax-control px-4 py-3">
                <span className="text-sm font-black text-ax-text-muted w-6 text-right">{rank}</span>
                <div className="w-8 h-8 rounded-full bg-ax-hover flex items-center justify-center text-ax-text text-xs font-black shrink-0">
                  {m.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-ax-text truncate">{m.username}</p>
                    {m.gender && <span className="text-[10px]">{m.gender === 'male' ? '♂' : '♀'}</span>}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>
                    {LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-ax-text">{m.elo}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
