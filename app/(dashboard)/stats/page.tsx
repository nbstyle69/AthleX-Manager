'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, Trophy, Dumbbell, TrendingUp, Loader2 } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';

const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS' };
const LEVEL_COLOR: Record<string, string> = { 'rx+': '#C9A227', rx: '#3B82F6', scaled: '#10B981', foundations: '#8B5CF6' };

interface KPI { label: string; value: number | string; icon: any; color: string }

export default function BoxStatsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [levelBreakdown, setLevelBreakdown] = useState<{ level: string; count: number }[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<{ role: string; count: number }[]>([]);
  const [joinChart, setJoinChart] = useState<{ date: string; count: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(30);
  const [topMembers, setTopMembers] = useState<{ username: string; elo: number; level: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { router.push('/login'); return; }

    const [
      { count: totalMembers },
      { count: activeMembers },
      { count: bannedMembers },
      { count: coachCount },
      { count: totalTournaments },
      { count: activeTournaments },
      { count: totalWods },
      { data: membersData },
      { data: joinData },
    ] = await Promise.all([
      supabase.from('box_members').select('*', { count: 'exact', head: true }).eq('box_id', box.id),
      supabase.from('box_members').select('*', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'active'),
      supabase.from('box_members').select('*', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'banned'),
      supabase.from('box_members').select('*', { count: 'exact', head: true }).eq('box_id', box.id).eq('role', 'coach'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('box_id', box.id),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('box_id', box.id).in('status', ['open', 'active']),
      supabase.from('box_wods').select('*', { count: 'exact', head: true }).eq('box_id', box.id),
      supabase.from('box_members')
        .select('member_id, status, role, joined_at, profile:profiles!box_members_member_id_fkey(username, level, elo)')
        .eq('box_id', box.id).eq('status', 'active'),
      supabase.from('box_members')
        .select('joined_at')
        .eq('box_id', box.id)
        .order('joined_at', { ascending: true }),
    ]);

    setKpis([
      { label: 'Total membres', value: totalMembers ?? 0, icon: Users, color: '#22C55E' },
      { label: 'Membres actifs', value: activeMembers ?? 0, icon: Users, color: '#3B82F6' },
      { label: 'Coachs', value: coachCount ?? 0, icon: Users, color: '#8B5CF6' },
      { label: 'Bannis', value: bannedMembers ?? 0, icon: Users, color: '#EF4444' },
      { label: 'Tournois créés', value: totalTournaments ?? 0, icon: Trophy, color: '#C9A227' },
      { label: 'Tournois actifs', value: activeTournaments ?? 0, icon: Trophy, color: '#D97706' },
      { label: 'WODs publiés', value: totalWods ?? 0, icon: Dumbbell, color: '#EC4899' },
    ]);

    // Level breakdown
    const levelMap: Record<string, number> = {};
    const members = (membersData ?? []).map((m: any) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return p ? { username: p.username, level: p.level ?? 'rx', elo: p.elo ?? 1000 } : null;
    }).filter(Boolean) as { username: string; level: string; elo: number }[];

    for (const m of members) {
      levelMap[m.level] = (levelMap[m.level] ?? 0) + 1;
    }
    setLevelBreakdown(Object.entries(levelMap).map(([level, count]) => ({ level, count })).sort((a, b) => b.count - a.count));

    // Role breakdown
    const roleMap: Record<string, number> = { member: 0, coach: 0 };
    for (const m of membersData ?? []) {
      const role = (m as any).role ?? 'member';
      roleMap[role] = (roleMap[role] ?? 0) + 1;
    }
    setRoleBreakdown(Object.entries(roleMap).map(([role, count]) => ({ role, count })));

    // Join chart
    const joins = (joinData ?? []).map((j: any) => j.joined_at?.slice(0, 10)).filter(Boolean);
    const joinsByDate: Record<string, number> = {};
    for (const d of joins) {
      joinsByDate[d] = (joinsByDate[d] ?? 0) + 1;
    }
    setJoinChart(Object.entries(joinsByDate).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)));

    // Top 10 ELO
    setTopMembers([...members].sort((a, b) => b.elo - a.elo).slice(0, 10));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 size={28} className="animate-spin text-[#C9A227]" />
    </div>
  );

  // Chart data
  const now = new Date();
  const cutoff = new Date(now.getTime() - chartPeriod * 86400000).toISOString().slice(0, 10);
  const filteredChart = joinChart.filter(d => d.date >= cutoff);
  const filledChart: { date: string; count: number }[] = [];
  for (let i = chartPeriod - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    const existing = filteredChart.find(c => c.date === d);
    filledChart.push({ date: d, count: existing?.count ?? 0 });
  }
  const maxCount = Math.max(...filledChart.map(d => d.count), 1);
  const totalLevel = levelBreakdown.reduce((s, l) => s + l.count, 0) || 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Statistiques</h1>
        <p className="text-sm text-gray-400 mt-1">Vue d&apos;ensemble de votre box</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#111111] border border-white/8 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Join chart */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#C9A227]" />
              <h2 className="text-sm font-bold text-white">Inscriptions membres</h2>
            </div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map(p => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${chartPeriod === p ? 'bg-[#C9A227]/20 text-[#C9A227]' : 'text-gray-500 hover:text-gray-300'}`}>
                  {p}j
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-[2px] h-40">
            {filledChart.map((d) => (
              <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                <div className="absolute -top-8 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {d.date.slice(5)} · {d.count}
                </div>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max((d.count / maxCount) * 100, 2)}%`,
                    backgroundColor: d.count > 0 ? '#C9A227' : '#ffffff08',
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            {filteredChart.reduce((s, d) => s + d.count, 0)} inscription(s) sur {chartPeriod} jours
          </p>
        </div>

        {/* Level breakdown */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
            <Dumbbell size={16} className="text-[#C9A227]" />
            Répartition par niveau
          </h2>
          <div className="space-y-3">
            {levelBreakdown.map(({ level, count }) => {
              const pct = Math.round((count / totalLevel) * 100);
              const color = LEVEL_COLOR[level] ?? '#6B7280';
              return (
                <div key={level}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color }}>{LEVEL_LABEL[level] ?? level.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            {levelBreakdown.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Aucun membre</p>}
          </div>

          {/* Role breakdown */}
          <div className="mt-6 pt-5 border-t border-white/8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Rôles</h3>
            <div className="flex gap-4">
              {roleBreakdown.map(({ role, count }) => (
                <div key={role} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role === 'coach' ? '#8B5CF6' : '#3B82F6' }} />
                  <span className="text-xs text-gray-300 font-semibold">{role === 'coach' ? 'Coachs' : 'Membres'}</span>
                  <span className="text-xs text-gray-500 font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 ELO */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
          <Trophy size={16} className="text-[#C9A227]" />
          Top 10 membres (ELO)
        </h2>
        {topMembers.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Aucun membre</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {topMembers.map((m, i) => {
              const lvlColor = LEVEL_COLOR[m.level] ?? '#6B7280';
              return (
                <div key={m.username + i} className="flex items-center gap-3 bg-[#0A0A0A] rounded-xl px-4 py-3">
                  <span className="text-sm font-black text-gray-500 w-5 text-right">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-xs font-black shrink-0">
                    {m.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.username}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>
                      {LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-[#C9A227]">{m.elo}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
