'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS', inter: 'INTER', gx: 'GX', pro: 'PRO' };
const LEVEL_COLOR: Record<string, string> = { 'rx+': '#FFFFFF', rx: '#3B82F6', scaled: '#10B981', foundations: '#8B5CF6', inter: '#F59E0B', gx: '#EC4899', pro: '#EF4444' };

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
    const { data } = await supabase
      .from('box_members')
      .select('member_id, profile:profiles!box_members_member_id_fkey(username, level, elo, gender)')
      .eq('box_id', boxId)
      .eq('status', 'active');

    const rows = ((data ?? []) as { profile: ProfileRow | ProfileRow[] | null }[])
      .map(m => (Array.isArray(m.profile) ? m.profile[0] : m.profile))
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
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-white" />
        <span className="text-sm text-gray-400">Chargement du classement…</span>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Trophy size={16} className="text-white" />
          Classement ELO — {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {([['all', 'Tous'], ['male', '♂ Hommes'], ['female', '♀ Femmes']] as const).map(([key, label]) => (
              <button key={key} onClick={() => { setGenderFilter(key); setPage(0); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${genderFilter === key ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1 rounded-lg text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-gray-400 font-bold min-w-[40px] text-center">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1 rounded-lg text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">Aucun membre</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {shown.map((m, i) => {
            const rank = page * PAGE_SIZE + i + 1;
            const lvlColor = LEVEL_COLOR[m.level] ?? '#6B7280';
            return (
              <div key={m.username + rank} className="flex items-center gap-3 bg-[#0A0A0A] rounded-xl px-4 py-3">
                <span className="text-sm font-black text-gray-500 w-6 text-right">{rank}</span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {m.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white truncate">{m.username}</p>
                    {m.gender && <span className="text-[10px]">{m.gender === 'male' ? '♂' : '♀'}</span>}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>
                    {LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-white">{m.elo}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
