'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3, Users, Trophy, Swords, MapPin, Loader2,
  TrendingUp, Calendar, Activity, Target,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  recentUsers7d: number;
  recentUsers30d: number;
  totalTournaments: number;
  activeTournaments: number;
  totalPhysicalComps: number;
  activePhysicalComps: number;
  totalInterComps: number;
  totalDailyContests: number;
  totalBoxes: number;
  usersByRole: Record<string, number>;
  registrationsByDay: { date: string; count: number }[];
}

const EMPTY: Stats = {
  totalUsers: 0, recentUsers7d: 0, recentUsers30d: 0,
  totalTournaments: 0, activeTournaments: 0,
  totalPhysicalComps: 0, activePhysicalComps: 0,
  totalInterComps: 0, totalDailyContests: 0, totalBoxes: 0,
  usersByRole: {}, registrationsByDay: [],
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
      { count: totalDailyContests },
      { count: totalBoxes },
      { data: recentProfiles },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      supabase.from('profiles').select('role'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
      supabase.from('physical_competitions').select('*', { count: 'exact', head: true }),
      supabase.from('physical_competitions').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
      supabase.from('inter_competitions').select('*', { count: 'exact', head: true }),
      supabase.from('daily_contests').select('*', { count: 'exact', head: true }),
      supabase.from('boxes').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('created_at').gte('created_at', dPeriod).order('created_at', { ascending: true }),
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

    setStats({
      totalUsers: totalUsers ?? 0,
      recentUsers7d: recentUsers7d ?? 0,
      recentUsers30d: recentUsers30d ?? 0,
      totalTournaments: totalTournaments ?? 0,
      activeTournaments: activeTournaments ?? 0,
      totalPhysicalComps: totalPhysicalComps ?? 0,
      activePhysicalComps: activePhysicalComps ?? 0,
      totalInterComps: totalInterComps ?? 0,
      totalDailyContests: totalDailyContests ?? 0,
      totalBoxes: totalBoxes ?? 0,
      usersByRole,
      registrationsByDay,
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
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Utilisateurs" value={stats.totalUsers} sub={`+${stats.recentUsers7d} cette semaine`} color="emerald" />
        <KpiCard icon={Trophy} label="Tournois" value={stats.totalTournaments} sub={`${stats.activeTournaments} actif${stats.activeTournaments > 1 ? 's' : ''}`} color="amber" />
        <KpiCard icon={MapPin} label="Compét. Physiques" value={stats.totalPhysicalComps} sub={`${stats.activePhysicalComps} actif${stats.activePhysicalComps > 1 ? 's' : ''}`} color="purple" />
        <KpiCard icon={Swords} label="Contestations" value={stats.totalDailyContests} sub="total" color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Inter-box" value={stats.totalInterComps} sub="compétitions" color="blue" />
        <KpiCard icon={Target} label="Boxes" value={stats.totalBoxes} sub="créées" color="pink" />
        <KpiCard icon={TrendingUp} label="Inscrits (7j)" value={stats.recentUsers7d} sub="nouveaux" color="emerald" />
        <KpiCard icon={TrendingUp} label="Inscrits (30j)" value={stats.recentUsers30d} sub="nouveaux" color="emerald" />
      </div>

      {/* Registrations chart + Roles breakdown */}
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
