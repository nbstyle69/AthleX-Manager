'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3, Users, Trophy, Swords, MapPin, Loader2,
  TrendingUp, Calendar, Activity, Target, MessageCircle,
  CalendarCheck, Sparkles, Award, Dumbbell, Building2,
  Download, AlertTriangle, TrendingDown, Info, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PURPLE_SOFT, chipClass } from '@/components/admin/adminTokens';

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

// Couleurs de niveau de l'application (`--ax-level-*`), comme la page
// Statistiques du dashboard depuis le lot 6b.
const ELO_LEVELS = [
  { label: 'Scaled',  min: 0,    max: 599,  color: 'var(--ax-level-scaled)' },
  { label: 'Inter',   min: 600,  max: 799,  color: 'var(--ax-level-inter)' },
  { label: 'RX',      min: 800,  max: 999,  color: 'var(--ax-level-rx)' },
  { label: 'RX+',     min: 1000, max: 1199, color: 'var(--ax-level-rx-plus)' },
  { label: 'GX',      min: 1200, max: 1399, color: 'var(--ax-level-gx)' },
  { label: 'Pro',     min: 1400, max: 9999, color: 'var(--ax-level-pro)' },
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
      // « Actifs » : sans les archivés (#371) ; le total ne change pas.
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'closed').is('archived_at', null),
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
  // Même sens qu'avant, en jetons lisibles dans les deux thèmes.
  const ROLE_COLORS: Record<string, string> = {
    athlete: 'bg-ax-success', admin: 'bg-ax-warning', super_admin: 'bg-ax-danger',
    box_owner: 'bg-ax-purple', member: 'bg-ax-info',
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
    critical: 'bg-ax-danger-soft border-ax-danger text-ax-danger',
    warning:  'bg-ax-warning-soft border-ax-warning text-ax-warning',
    info:     'bg-ax-info-soft border-ax-info text-ax-info',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-ax-accent-text animate-spin" />
      </div>
    );
  }

  const nDays = stats.registrationsByDay.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-accent-soft flex items-center justify-center">
            <BarChart3 size={22} className="text-ax-accent-text" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Statistiques</h1>
            <p className="text-sm text-ax-text-secondary">Vue d&apos;ensemble de la plateforme</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([7, 30, 90] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={chipClass(period === p)}
            >
              {p}j
            </button>
          ))}
          <Button variant="ax-outline" size="ax-compact" onClick={() => exportCSV(stats, period)}>
            <Download size={13} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-ax-control border ${alertStyles[alert.level]}`}>
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
        <h2 className="text-sm font-black text-ax-text-secondary uppercase tracking-wider mb-3">Engagement</h2>
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
        <Card className="p-4 col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 shrink-0 rounded-ax-control ${KPI_COLORS.teal.bg} flex items-center justify-center`}>
              <Activity size={16} className={KPI_COLORS.teal.text} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-ax-text-secondary">Rétention 7j</p>
              <p className="text-[10px] text-ax-text-secondary">Utilisateurs actifs cette semaine / total</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-black text-ax-text">{stats.retentionRate}%</p>
            <div className="flex-1 h-3 bg-ax-neutral-soft rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-gradient-to-r from-[var(--ax-sub-teal-text)] to-[var(--ax-success)] rounded-full transition-all"
                style={{ width: `${Math.min(100, stats.retentionRate)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Registrations chart + Roles breakdown + Top Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="md:col-span-2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} className="text-ax-accent-text" />
            <h2 className="text-sm font-black text-ax-text">Inscriptions ({period} derniers jours)</h2>
          </div>
          {stats.registrationsByDay.length === 0 ? (
            <p className="text-ax-text-secondary text-sm py-8 text-center">Aucune inscription sur cette période.</p>
          ) : (
            <div className="flex items-end gap-[2px] h-40 pt-7">
              {stats.registrationsByDay.map((d, i) => (
                // La valeur du jour s'affiche au survol, et aussi au focus
                // (clavier, ou toucher sous 1024 px) : chaque barre est focusable.
                <div key={d.date} tabIndex={0} aria-label={`${d.date.slice(5)} : ${d.count}`}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                  <div
                    className="w-full bg-[color-mix(in_srgb,var(--ax-accent-text)_60%,transparent)] rounded-t-sm min-h-[2px] transition-colors group-hover:bg-ax-accent-text group-focus:bg-ax-accent-text"
                    style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                  />
                  {/* Bornée au graphique : à gauche au début, à droite à la fin. */}
                  <div className={`absolute -top-6 bg-ax-surface-secondary border border-ax-border rounded-ax-control px-1.5 py-0.5 text-[10px] text-ax-text font-bold opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 ${
                    i < nDays / 3 ? 'left-0' : i > (2 * nDays) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    {d.date.slice(5)} : {d.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Roles breakdown */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-ax-accent-text" />
            <h2 className="text-sm font-black text-ax-text">Répartition par rôle</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.usersByRole)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <div key={role} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${ROLE_COLORS[role] ?? 'bg-ax-neutral'}`} />
                  <span className="text-xs text-ax-text-secondary flex-1 break-words">{ROLE_LABELS[role] ?? role}</span>
                  <span className="text-xs font-black text-ax-text">{count}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* ELO Distribution */}
      {stats.eloDistribution.some(l => l.count > 0) && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} className="text-ax-warning" />
            <h2 className="text-sm font-black text-ax-text">Distribution par niveau ELO</h2>
          </div>
          {(() => {
            const total = stats.eloDistribution.reduce((s, l) => s + l.count, 0) || 1;
            return (
              <div className="space-y-2.5">
                {stats.eloDistribution.map((lvl) => (
                  <div key={lvl.label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-ax-text-secondary w-14 shrink-0">{lvl.label}</span>
                    <div className="flex-1 h-5 bg-ax-neutral-soft rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(2, Math.round((lvl.count / total) * 100))}%`, backgroundColor: lvl.color }}
                      >
                        {lvl.count > 0 && <span className="text-[10px] font-black text-ax-background">{Math.round((lvl.count / total) * 100)}%</span>}
                      </div>
                    </div>
                    <span className="text-xs font-black text-ax-text w-10 text-right">{lvl.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Top Boxes */}
      {stats.topBoxes.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-ax-purple" />
            <h2 className="text-sm font-black text-ax-text">Top Boxs par membres</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {stats.topBoxes.map((box, i) => {
              const maxMembers = Math.max(1, stats.topBoxes[0]?.members ?? 1);
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-ax-control bg-ax-hover border border-ax-border">
                  <div className={`w-7 h-7 rounded-ax-control ${KPI_COLORS.purple.bg} flex items-center justify-center text-ax-purple text-[10px] font-black shrink-0`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Nom saisi par la box : lisible en entier, sur plusieurs lignes au besoin. */}
                    <p className="text-xs font-bold text-ax-text break-words">{box.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-ax-neutral-soft rounded-full overflow-hidden">
                        <div className="h-full bg-ax-purple rounded-full" style={{ width: `${(box.members / maxMembers) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-ax-text-secondary">{box.members}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// Même sens qu'avant pour chaque indicateur, en jetons lisibles dans les deux thèmes.
const KPI_COLORS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-ax-success-soft', text: 'text-ax-success' },
  amber: { bg: 'bg-ax-warning-soft', text: 'text-ax-warning' },
  purple: { bg: PURPLE_SOFT, text: 'text-ax-purple' },
  red: { bg: 'bg-ax-danger-soft', text: 'text-ax-danger' },
  blue: { bg: 'bg-ax-info-soft', text: 'text-ax-info' },
  pink: { bg: 'bg-[color-mix(in_srgb,var(--ax-sub-rose-text)_12%,var(--ax-surface))]', text: 'text-[color:var(--ax-sub-rose-text)]' },
  teal: { bg: 'bg-[color-mix(in_srgb,var(--ax-sub-teal-text)_12%,var(--ax-surface))]', text: 'text-[color:var(--ax-sub-teal-text)]' },
};

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number; sub: string; color: string;
}) {
  const c = KPI_COLORS[color] ?? KPI_COLORS.emerald;

  return (
    <Card className="p-4 min-w-0">
      <div className={`w-8 h-8 rounded-ax-control ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={16} className={c.text} />
      </div>
      <p className="text-2xl font-black text-ax-text">{value.toLocaleString('fr-FR')}</p>
      <p className="text-[11px] font-bold text-ax-text-secondary mt-0.5 break-words">{label}</p>
      <p className="text-[10px] text-ax-text-secondary mt-0.5 break-words">{sub}</p>
    </Card>
  );
}
