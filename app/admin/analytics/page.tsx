'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3, Users, Trophy, Swords, MapPin, Loader2,
  TrendingUp, Calendar, Activity, Target, MessageCircle,
  CalendarCheck, Sparkles, Award, Dumbbell, Building2,
  Download, AlertTriangle, TrendingDown, Info, Zap,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  recentUsers7d: number;
  recentUsers30d: number;
  eloDistribution: { label: string; count: number; color: string }[];
  totalTournaments: number;
  activeTournaments: number;
  totalPhysicalComps: number;
  activePhysicalComps: number;
  totalInterComps: number;
  totalDailyTournaments: number;
  contestedScores: number;
  totalBoxes: number;
  usersByRole: Record<string, number>;
  registrationsByDay: { date: string; count: number }[];
  totalReservations: number;
  reservationsPeriod: number;
  totalMessages: number;
  messagesPeriod: number;
  totalGeneratedWods: number;
  generatedWodsPeriod: number;
  totalBadgesEarned: number;
  totalScores: number;
  scoresPeriod: number;
  retentionRate: number;
  topBoxes: { name: string; members: number }[];
}

const ELO_LEVELS = [
  { label: 'Scaled',  min: 0,    max: 599,  color: 'bg-gray-400' },
  { label: 'Inter',   min: 600,  max: 799,  color: 'bg-blue-400' },
  { label: 'RX',      min: 800,  max: 999,  color: 'bg-emerald-400' },
  { label: 'RX+',     min: 1000, max: 1199, color: 'bg-amber-400' },
  { label: 'GX',      min: 1200, max: 1399, color: 'bg-orange-400' },
  { label: 'Pro',     min: 1400, max: 9999, color: 'bg-red-400' },
];

function exportCSV(stats: Stats, period: number) {
  const rows: (string | number)[][] = [
    ['Métrique', 'Valeur'],
    ['--- UTILISATEURS ---', ''],
    ['Total utilisateurs', stats.totalUsers],
    ['Inscrits 7 derniers jours', stats.recentUsers7d],
    ['Inscrits 30 derniers jours', stats.recentUsers30d],
    [`Rétention 7j (%)`, stats.retentionRate],
    ['--- COMPÉTITIONS ---', ''],
    ['Tournois total', stats.totalTournaments],
    ['Tournois actifs', stats.activeTournaments],
    ['Mini-tournois', stats.totalDailyTournaments],
    ['Comp. Physiques', stats.totalPhysicalComps],
    ['Comp. Inter-box', stats.totalInterComps],
    ['Scores contestés', stats.contestedScores],
    ['--- ENGAGEMENT ---', ''],
    ['Scores WOD total', stats.totalScores],
    [`Scores WOD (${period}j)`, stats.scoresPeriod],
    ['WODs générés total', stats.totalGeneratedWods],
    [`WODs générés (${period}j)`, stats.generatedWodsPeriod],
    ['Badges débloqués', stats.totalBadgesEarned],
    ['Messages total', stats.totalMessages],
    [`Messages (${period}j)`, stats.messagesPeriod],
    ['Réservations total', stats.totalReservations],
    [`Réservations (${period}j)`, stats.reservationsPeriod],
    ['--- BOXES ---', ''],
    ['Boxs total', stats.totalBoxes],
    ...stats.topBoxes.map(b => [`Box: ${b.name}`, b.members]),
  ];
  Object.entries(stats.usersByRole).forEach(([role, count]) => {
    rows.push([`Rôle: ${role}`, count]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `athlex-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY: Stats = {
  totalUsers: 0, recentUsers7d: 0, recentUsers30d: 0,
  eloDistribution: [],
  totalTournaments: 0, activeTournaments: 0,
  totalPhysicalComps: 0, activePhysicalComps: 0,
  totalInterComps: 0, totalDailyTournaments: 0, contestedScores: 0, totalBoxes: 0,
  usersByRole: {}, registrationsByDay: [],
  totalReservations: 0, reservationsPeriod: 0,
  totalMessages: 0, messagesPeriod: 0,
  totalGeneratedWods: 0, generatedWodsPeriod: 0,
  totalBadgesEarned: 0,
  totalScores: 0, scoresPeriod: 0,
  retentionRate: 0, topBoxes: [],
};

export default function AnalyticsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const dPeriod = new Date(now.getTime() - period * 86400000).toISOString();

    const [
      { count: totalUsers },
      { count: recentUsers7d },
      { count: recentUsers30d },
      { data: profilesData },
      { count: totalTournaments },
      { count: activeTournaments },
      { count: totalPhysicalComps },
      { count: activePhysicalComps },
      { count: totalInterComps },
      { count: totalDailyTournaments },
      { count: totalBoxes },
      { data: recentProfiles },
      { count: totalReservations },
      { count: reservationsPeriod },
      { count: totalMessages },
      { count: messagesPeriod },
      { data: wodsGeneratedProfiles },
      { count: generatedWodsPeriod },
      { count: totalBadgesEarned },
      { count: totalScores },
      { count: scoresPeriod },
      { count: contestedScores },
      { data: activeScoreUsers },
      { data: activeReservationUsers },
      { data: topBoxesRaw },
      { data: eloProfiles },
    ] = await Promise.all([
      // Compter sur une colonne AUTORISÉE : `authenticated` n'a plus SELECT sur
      // toutes les colonnes de profiles, donc un `*` tombe en 42501.
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
      supabase.from('profiles').select('role'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
      supabase.from('physical_competitions').select('*', { count: 'exact', head: true }),
      supabase.from('physical_competitions').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
      supabase.from('inter_competitions').select('*', { count: 'exact', head: true }),
      supabase.from('daily_tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('boxes').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('created_at').gte('created_at', dPeriod).order('created_at', { ascending: true }),
      supabase.from('class_reservations').select('*', { count: 'exact', head: true }),
      supabase.from('class_reservations').select('*', { count: 'exact', head: true }).gte('created_at', dPeriod),
      supabase.from('box_messages').select('*', { count: 'exact', head: true }),
      supabase.from('box_messages').select('*', { count: 'exact', head: true }).gte('created_at', dPeriod),
      supabase.from('profiles').select('total_wods_generated'),
      supabase.from('generated_wods').select('*', { count: 'exact', head: true }).gte('created_at', dPeriod),
      supabase.from('athlete_badges').select('*', { count: 'exact', head: true }),
      supabase.from('wod_scores').select('*', { count: 'exact', head: true }),
      supabase.from('wod_scores').select('*', { count: 'exact', head: true }).gte('submitted_at', dPeriod),
      supabase.from('daily_tournament_scores').select('*', { count: 'exact', head: true }).eq('status', 'contested'),
      supabase.from('wod_scores').select('member_id').gte('submitted_at', d7),
      supabase.from('class_reservations').select('member_id').gte('created_at', d7),
      supabase.from('boxes').select('id, name, box_members(count)').order('name').limit(10),
      supabase.from('profiles').select('elo').not('elo', 'is', null),
    ]);

    // Roles breakdown
    const usersByRole: Record<string, number> = {};
    (profilesData ?? []).forEach((p: any) => {
      const r = p.role || 'athlete';
      usersByRole[r] = (usersByRole[r] || 0) + 1;
    });

    // Registrations by day
    const dayMap: Record<string, number> = {};
    (recentProfiles ?? []).forEach((p: any) => {
      const day = p.created_at?.slice(0, 10);
      if (day) dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const registrationsByDay = Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top boxes by member count
    const topBoxes = (topBoxesRaw ?? [])
      .map((b: any) => ({
        name: b.name ?? '?',
        members: b.box_members?.[0]?.count ?? 0,
      }))
      .sort((a: any, b: any) => b.members - a.members)
      .slice(0, 8);

    // Total WODs generated (sum from all profiles)
    const totalGeneratedWods = (wodsGeneratedProfiles ?? []).reduce(
      (sum: number, p: any) => sum + ((p as any).total_wods_generated ?? 0), 0
    );

    // Retention: distinct active users in last 7d (scored or reserved) / total users
    const activeUserIds = new Set<string>();
    (activeScoreUsers ?? []).forEach((s: any) => { if (s.member_id) activeUserIds.add(s.member_id); });
    (activeReservationUsers ?? []).forEach((r: any) => { if (r.member_id) activeUserIds.add(r.member_id); });
    const retentionRate = (totalUsers ?? 0) > 0
      ? Math.round((activeUserIds.size / (totalUsers ?? 1)) * 100)
      : 0;

    // ELO distribution by level
    const eloDistribution = ELO_LEVELS.map(lvl => ({
      label: lvl.label,
      color: lvl.color,
      count: ((eloProfiles ?? []) as any[]).filter((p: any) => {
        const e = Number(p.elo ?? 0);
        return e >= lvl.min && e <= lvl.max;
      }).length,
    }));

    setStats({
      totalUsers: totalUsers ?? 0,
      recentUsers7d: recentUsers7d ?? 0,
      recentUsers30d: recentUsers30d ?? 0,
      totalTournaments: totalTournaments ?? 0,
      activeTournaments: activeTournaments ?? 0,
      totalPhysicalComps: totalPhysicalComps ?? 0,
      activePhysicalComps: activePhysicalComps ?? 0,
      totalInterComps: totalInterComps ?? 0,
      totalDailyTournaments: totalDailyTournaments ?? 0,
      contestedScores: contestedScores ?? 0,
      totalBoxes: totalBoxes ?? 0,
      usersByRole,
      registrationsByDay,
      totalReservations: totalReservations ?? 0,
      reservationsPeriod: reservationsPeriod ?? 0,
      totalMessages: totalMessages ?? 0,
      messagesPeriod: messagesPeriod ?? 0,
      totalGeneratedWods,
      generatedWodsPeriod: generatedWodsPeriod ?? 0,
      totalBadgesEarned: totalBadgesEarned ?? 0,
      totalScores: totalScores ?? 0,
      scoresPeriod: scoresPeriod ?? 0,
      retentionRate,
      topBoxes,
      eloDistribution,
    });
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxDayCount = Math.max(1, ...stats.registrationsByDay.map(d => d.count));

  const ROLE_LABELS: Record<string, string> = {
    athlete: 'Athlète', admin: 'Admin', super_admin: 'Super Admin',
    box_owner: 'Gérant Box', member: 'Membre Box',
  };
  const ROLE_COLORS: Record<string, string> = {
    athlete: 'bg-emerald-500', admin: 'bg-amber-500', super_admin: 'bg-red-500',
    box_owner: 'bg-purple-500', member: 'bg-blue-500',
  };

  // Alert thresholds
  const alerts: { level: 'critical' | 'warning' | 'info'; message: string; icon: any }[] = [];
  if (!loading && stats.retentionRate < 15 && stats.totalUsers > 0)
    alerts.push({ level: 'critical', message: `Rétention critique : ${stats.retentionRate}% des utilisateurs actifs cette semaine (seuil : 15%)`, icon: TrendingDown });
  if (!loading && stats.contestedScores > 10)
    alerts.push({ level: 'warning', message: `${stats.contestedScores} scores contestés en attente de traitement`, icon: AlertTriangle });
  if (!loading && stats.recentUsers7d === 0 && stats.totalUsers > 0)
    alerts.push({ level: 'info', message: 'Aucune nouvelle inscription cette semaine', icon: Info });
  if (!loading && stats.activeTournaments === 0)
    alerts.push({ level: 'info', message: 'Aucun tournoi actif en ce moment', icon: Zap });

  const alertStyles = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning:  'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info:     'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <BarChart3 size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Statistiques</h1>
            <p className="text-sm text-gray-400">Vue d&apos;ensemble de la plateforme</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#111111] border border-white/8 text-gray-400 hover:text-white'
              }`}
            >
              {p}j
            </button>
          ))}
          <button
            onClick={() => exportCSV(stats, period)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${alertStyles[alert.level]}`}>
              <alert.icon size={16} className="shrink-0" />
              <span className="text-sm font-semibold">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Utilisateurs" value={stats.totalUsers} sub={`+${stats.recentUsers7d} cette semaine`} color="emerald" />
        <KpiCard icon={Trophy} label="Tournois" value={stats.totalTournaments} sub={`${stats.activeTournaments} actif${stats.activeTournaments > 1 ? 's' : ''}`} color="amber" />
        <KpiCard icon={MapPin} label="Compét. Physiques" value={stats.totalPhysicalComps} sub={`${stats.activePhysicalComps} actif${stats.activePhysicalComps > 1 ? 's' : ''}`} color="purple" />
        <KpiCard icon={Swords} label="Contestations" value={stats.contestedScores} sub="scores contestés" color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Inter-box" value={stats.totalInterComps} sub="compétitions" color="blue" />
        <KpiCard icon={Target} label="Boxs" value={stats.totalBoxes} sub="créées" color="pink" />
        <KpiCard icon={TrendingUp} label="Inscrits (7j)" value={stats.recentUsers7d} sub="nouveaux" color="emerald" />
        <KpiCard icon={TrendingUp} label="Inscrits (30j)" value={stats.recentUsers30d} sub="nouveaux" color="emerald" />
      </div>

      {/* Engagement KPIs */}
      <div>
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={CalendarCheck} label="Réservations" value={stats.totalReservations} sub={`+${stats.reservationsPeriod} sur ${period}j`} color="emerald" />
          <KpiCard icon={MessageCircle} label="Messages" value={stats.totalMessages} sub={`+${stats.messagesPeriod} sur ${period}j`} color="blue" />
          <KpiCard icon={Sparkles} label="WODs générés" value={stats.totalGeneratedWods} sub={`+${stats.generatedWodsPeriod} sur ${period}j`} color="purple" />
          <KpiCard icon={Dumbbell} label="Scores WOD" value={stats.totalScores} sub={`+${stats.scoresPeriod} sur ${period}j`} color="amber" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Award} label="Badges débloqués" value={stats.totalBadgesEarned} sub="total" color="amber" />
        <KpiCard icon={Trophy} label="Mini-Tournois" value={stats.totalDailyTournaments} sub="total" color="amber" />
        {/* Retention card */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Activity size={16} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400">Rétention 7j</p>
              <p className="text-[10px] text-gray-600">Utilisateurs actifs cette semaine / total</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black text-white">{stats.retentionRate}%</p>
            <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, stats.retentionRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Registrations chart + Roles breakdown + Top Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="md:col-span-2 bg-[#111111] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white">Inscriptions ({period} derniers jours)</h2>
          </div>
          {stats.registrationsByDay.length === 0 ? (
            <p className="text-gray-600 text-sm py-8 text-center">Aucune inscription sur cette période.</p>
          ) : (
            <div className="flex items-end gap-[2px] h-40">
              {stats.registrationsByDay.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full bg-emerald-500/60 rounded-t-sm min-h-[2px] transition-all group-hover:bg-emerald-400"
                    style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                  />
                  <div className="absolute -top-6 bg-[#1a1a1a] border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {d.date.slice(5)} : {d.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roles breakdown */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-emerald-400" />
            <h2 className="text-sm font-black text-white">Répartition par rôle</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.usersByRole)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <div key={role} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-400 flex-1">{ROLE_LABELS[role] ?? role}</span>
                  <span className="text-xs font-black text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ELO Distribution */}
      {stats.eloDistribution.some(l => l.count > 0) && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} className="text-amber-400" />
            <h2 className="text-sm font-black text-white">Distribution par niveau ELO</h2>
          </div>
          {(() => {
            const total = stats.eloDistribution.reduce((s, l) => s + l.count, 0) || 1;
            return (
              <div className="space-y-2.5">
                {stats.eloDistribution.map((lvl) => (
                  <div key={lvl.label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-14 shrink-0">{lvl.label}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${lvl.color} rounded-full transition-all flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max(2, Math.round((lvl.count / total) * 100))}%` }}
                      >
                        {lvl.count > 0 && <span className="text-[10px] font-black text-black/70">{Math.round((lvl.count / total) * 100)}%</span>}
                      </div>
                    </div>
                    <span className="text-xs font-black text-white w-10 text-right">{lvl.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Top Boxes */}
      {stats.topBoxes.length > 0 && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-purple-400" />
            <h2 className="text-sm font-black text-white">Top Boxs par membres</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.topBoxes.map((box, i) => {
              const maxMembers = Math.max(1, stats.topBoxes[0]?.members ?? 1);
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 text-[10px] font-black shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{box.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500/50 rounded-full" style={{ width: `${(box.members / maxMembers) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{box.members}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number; sub: string; color: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
    purple: 'bg-purple-500/15 text-purple-400',
    red: 'bg-red-500/15 text-red-400',
    blue: 'bg-blue-500/15 text-blue-400',
    pink: 'bg-pink-500/15 text-pink-400',
  };
  const iconColor = colors[color] ?? colors.emerald;

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all">
      <div className={`w-8 h-8 rounded-lg ${iconColor.split(' ')[0]} flex items-center justify-center mb-3`}>
        <Icon size={16} className={iconColor.split(' ')[1]} />
      </div>
      <p className="text-2xl font-black text-white">{value.toLocaleString('fr-FR')}</p>
      <p className="text-[11px] font-bold text-gray-400 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
    </div>
  );
}
