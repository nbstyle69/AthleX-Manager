import { createClient, createServiceClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Layers } from 'lucide-react';
import DivisionsManager from '@/components/tournaments/DivisionsManager';

export default async function DivisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments').select('*').eq('id', id).eq('box_id', box.id).single();
  if (!t) redirect('/tournaments');
  if (t.format !== 'league_div') redirect(`/tournaments/${id}`);

  const svc = createServiceClient();
  const [{ data: divisions }, { data: members }, { data: participants }, { data: history }] = await Promise.all([
    svc.from('tournament_divisions').select('*').eq('tournament_id', id).order('level'),
    svc.from('tournament_division_members')
       .select('id, division_id, athlete_id, points, rank, joined_at')
       .order('points', { ascending: false }),
    svc.from('tournament_participants')
       .select('athlete_id')
       .eq('tournament_id', id),
    svc.from('tournament_season_history')
       .select('*')
       .eq('tournament_id', id)
       .order('season_number', { ascending: false })
       .order('division_level', { ascending: true })
       .order('final_rank', { ascending: true }),
  ]);

  // Filter members to those of this tournament's divisions
  const divIds = new Set((divisions ?? []).map((d: any) => d.id));
  const tournamentMembers = (members ?? []).filter((m: any) => divIds.has(m.division_id));

  // Collect all athlete ids needed (members + participants + history)
  const allAthleteIds = new Set<string>();
  tournamentMembers.forEach((m: any) => allAthleteIds.add(m.athlete_id));
  (participants ?? []).forEach((p: any) => allAthleteIds.add(p.athlete_id));
  (history ?? []).forEach((h: any) => allAthleteIds.add(h.athlete_id));

  // Fetch all profiles in one go
  let profileMap: Record<string, { id: string; username: string; level: string; elo: number }> = {};
  if (allAthleteIds.size > 0) {
    const { data: profs } = await svc.from('profiles')
      .select('id, username, level, elo')
      .in('id', Array.from(allAthleteIds));
    (profs ?? []).forEach((p: any) => { profileMap[p.id] = p; });
  }

  // Attach profiles to members and history
  const tournamentMembersWithProfile = tournamentMembers.map((m: any) => ({
    ...m,
    athlete: profileMap[m.athlete_id] ?? { id: m.athlete_id, username: '?', level: 'rx', elo: 1000 },
  }));
  const historyWithProfile = (history ?? []).map((h: any) => ({
    ...h,
    athlete: profileMap[h.athlete_id] ?? { id: h.athlete_id, username: '?', level: 'rx' },
  }));

  // Build pool of athletes registered to the tournament but not yet in any division
  const memberAthleteIds = new Set(tournamentMembers.map((m: any) => m.athlete_id));
  const unassigned = (participants ?? [])
    .filter((p: any) => !memberAthleteIds.has(p.athlete_id))
    .map((p: any) => profileMap[p.athlete_id])
    .filter(Boolean);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">{t.name} — Divisions</span>
        </div>
      </div>

      <DivisionsManager
        tournamentId={id}
        currentSeason={t.current_season ?? 1}
        initialDivisions={(divisions ?? []) as any}
        initialMembers={tournamentMembersWithProfile as any}
        unassigned={unassigned as any}
        seasonHistory={historyWithProfile as any}
      />
    </div>
  );
}
