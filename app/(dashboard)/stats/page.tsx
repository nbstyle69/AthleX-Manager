'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, Trophy, Dumbbell, TrendingUp, Loader2, CalendarCheck } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import MoneyBlock from '@/components/stats/MoneyBlock';
import AttendanceBlock from '@/components/stats/AttendanceBlock';
import GrowthBlock from '@/components/stats/GrowthBlock';

const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS', inter: 'INTER', gx: 'GX', pro: 'PRO' };
const LEVEL_COLOR: Record<string, string> = { 'rx+': '#FFFFFF', rx: '#3B82F6', scaled: '#10B981', foundations: '#8B5CF6', inter: '#F59E0B', gx: '#EC4899', pro: '#EF4444' };

interface KPI { label: string; value: number | string; icon: any; color: string }
interface MemberRow { username: string; elo: number; level: string; gender: string | null }

export default function BoxStatsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [isOwnerAdmin, setIsOwnerAdmin] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [levelBreakdown, setLevelBreakdown] = useState<{ level: string; count: number }[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<{ role: string; count: number }[]>([]);
  const [joinChart, setJoinChart] = useState<{ date: string; count: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(30);
  const [resaChart, setResaChart] = useState<{ date: string; count: number }[]>([]);
  const [resaChartPeriod, setResaChartPeriod] = useState<7 | 30 | 90>(30);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase);
    if (!box) { router.push('/login'); return; }
    setBoxId(box.id);
    // L'argent et la croissance sont réservés au gérant/co-gérant : les RPC
    // refusent le coach, autant ne pas lui afficher des blocs qui échoueront.
    const { data: ownerAdmin } = await supabase.rpc('is_box_owner_admin', { p_box_id: box.id });
    setIsOwnerAdmin(ownerAdmin === true);

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
      { data: resaData },
      { data: privateProfiles },
    ] = await Promise.all([
      // `box_members` n'a plus de SELECT au niveau table pour `authenticated` : les
      // colonnes de facturation sont exclues. Compter sur `*` demande donc une
      // colonne interdite et renvoie 42501 — on compte sur une colonne autorisée.
      supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', box.id),
      supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'active'),
      supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', box.id).eq('status', 'banned'),
      supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', box.id).eq('role', 'coach'),
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
      supabase.from('class_reservations')
        .select('created_at, member_id')
        .eq('box_id', box.id)
        .order('created_at', { ascending: true }),
      // `gender` n'est plus lisible en colonne par `authenticated` (Lot 0-bis) :
      // le staff de la box le lit par cette RPC, seul lecteur autorisé.
      supabase.rpc('get_box_members_private_profiles', { p_box_id: box.id }),
    ]);

    const genderById = new Map<string, string | null>(
      ((privateProfiles ?? []) as { member_id: string; gender: string | null }[])
        .map(p => [p.member_id, p.gender]),
    );

    setKpis([
      { label: 'Total membres', value: totalMembers ?? 0, icon: Users, color: '#22C55E' },
      { label: 'Membres actifs', value: activeMembers ?? 0, icon: Users, color: '#3B82F6' },
      { label: 'Coachs', value: coachCount ?? 0, icon: Users, color: '#8B5CF6' },
      { label: 'Bannis', value: bannedMembers ?? 0, icon: Users, color: '#EF4444' },
      { label: 'Tournois créés', value: totalTournaments ?? 0, icon: Trophy, color: '#FFFFFF' },
      { label: 'Tournois actifs', value: activeTournaments ?? 0, icon: Trophy, color: '#D97706' },
      { label: 'WODs publiés', value: totalWods ?? 0, icon: Dumbbell, color: '#EC4899' },
    ]);

    // Level breakdown
    const levelMap: Record<string, number> = {};
    const members: MemberRow[] = (membersData ?? []).map((m: any) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return p ? { username: p.username, level: p.level ?? 'rx', elo: p.elo ?? 1000, gender: genderById.get(m.member_id) ?? null } : null;
    }).filter(Boolean) as MemberRow[];

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

    // Reservation stats
    const resas = (resaData ?? []) as { created_at: string; member_id: string }[];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const resaByDate: Record<string, number> = {};
    const activeWeekSet = new Set<string>();
    const activeMonthSet = new Set<string>();
    for (const r of resas) {
      const d = r.created_at?.slice(0, 10);
      if (!d) continue;
      resaByDate[d] = (resaByDate[d] ?? 0) + 1;
      if (d >= weekAgo) activeWeekSet.add(r.member_id);
      if (d >= monthAgo) activeMonthSet.add(r.member_id);
    }
    setActiveWeek(activeWeekSet.size);
    setActiveMonth(activeMonthSet.size);
    setResaChart(Object.entries(resaByDate).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 size={28} className="animate-spin text-white" />
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

  // Reservation chart data
  const resaCutoff = new Date(now.getTime() - resaChartPeriod * 86400000).toISOString().slice(0, 10);
  const filteredResaChart = resaChart.filter(d => d.date >= resaCutoff);
  const filledResaChart: { date: string; count: number }[] = [];
  for (let i = resaChartPeriod - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    const existing = filteredResaChart.find(c => c.date === d);
    filledResaChart.push({ date: d, count: existing?.count ?? 0 });
  }
  const maxResaCount = Math.max(...filledResaChart.map(d => d.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Statistiques</h1>
        <p className="text-sm text-gray-400 mt-1">Vue d&apos;ensemble de votre box</p>
      </div>

      {boxId && isOwnerAdmin && <MoneyBlock boxId={boxId} />}
      {boxId && <AttendanceBlock boxId={boxId} />}
      {boxId && isOwnerAdmin && <GrowthBlock boxId={boxId} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => {
          const isActiveCard = label === 'Membres actifs';
          return (
            <div key={label} className="bg-[#111111] border border-white/8 rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-1">{label}</p>
              {isActiveCard && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">7 derniers jours</span>
                    <span className="font-bold text-emerald-400">{activeWeek}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">30 derniers jours</span>
                    <span className="font-bold text-blue-400">{activeMonth}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Join chart */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-white" />
              <h2 className="text-sm font-bold text-white">Inscriptions membres</h2>
            </div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map(p => (
                <button key={p} onClick={() => setChartPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${chartPeriod === p ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
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
                    backgroundColor: d.count > 0 ? '#FFFFFF' : '#ffffff08',
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            {filteredChart.reduce((s, d) => s + d.count, 0)} inscription(s) sur {chartPeriod} jours
          </p>
        </div>

        {/* Composition — une ligne suffit : le niveau et le rôle ne déclenchent
            aucune action du gérant, ils situent seulement la salle. */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Dumbbell size={16} className="text-white" />
            Composition
          </h2>
          {levelBreakdown.length === 0 ? (
            <p className="text-xs text-gray-600 py-4">Aucun membre</p>
          ) : (
            <>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                {levelBreakdown.map(({ level, count }) => (
                  <div
                    key={level}
                    title={`${LEVEL_LABEL[level] ?? level.toUpperCase()} · ${count}`}
                    style={{ width: `${(count / totalLevel) * 100}%`, backgroundColor: LEVEL_COLOR[level] ?? '#6B7280' }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                {levelBreakdown.map(({ level, count }) => (
                  <span key={level} className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LEVEL_COLOR[level] ?? '#6B7280' }} />
                    {LEVEL_LABEL[level] ?? level.toUpperCase()}
                    <span className="font-bold text-gray-300">{count}</span>
                  </span>
                ))}
                {roleBreakdown.map(({ role, count }) => (
                  <span key={role} className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role === 'coach' ? '#8B5CF6' : '#3B82F6' }} />
                    {role === 'coach' ? 'Coachs' : 'Membres'}
                    <span className="font-bold text-gray-300">{count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Volume de réservations dans le temps — le « quand » est traité par la
          heatmap du bloc Assiduité, celui-ci ne montre que la tendance. */}
      <div>
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-[#10B981]" />
              <h2 className="text-sm font-bold text-white">Réservations</h2>
            </div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map(p => (
                <button key={p} onClick={() => setResaChartPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${resaChartPeriod === p ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-gray-500 hover:text-gray-300'}`}>
                  {p}j
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-[2px] h-40">
            {filledResaChart.map((d) => (
              <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end group relative">
                <div className="absolute -top-8 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {d.date.slice(5)} · {d.count}
                </div>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max((d.count / maxResaCount) * 100, 2)}%`,
                    backgroundColor: d.count > 0 ? '#10B981' : '#ffffff08',
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            {filteredResaChart.reduce((s, d) => s + d.count, 0)} réservation(s) sur {resaChartPeriod} jours
          </p>
        </div>
      </div>

    </div>
  );
}
