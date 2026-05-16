import { createClient, createServiceClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Layers } from 'lucide-react';
import DivisionsManager from '@/components/tournaments/DivisionsManager';

export default async function DivisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments').select('*').eq('id', id).eq('box_id', box.id).single();
  if (!t) redirect('/tournaments');
  if (t.format !== 'league_div') redirect(`/tournaments/${id}`);

  const svc = createServiceClient();
  const [{ data: divisions }, { data: members }, { data: participants }] = await Promise.all([
    svc.from('tournament_divisions').select('*').eq('tournament_id', id).order('level'),
    svc.from('tournament_division_members')
       .select('*, athlete:profiles!tournament_division_members_athlete_id_fkey(id, username, level, elo)')
       .order('points', { ascending: false }),
    svc.from('tournament_participants')
       .select('athlete_id, profile:profiles!tournament_participants_athlete_id_fkey(id, username, level, elo)')
       .eq('tournament_id', id),
  ]);

  // Filter members to those of this tournament's divisions
  const divIds = new Set((divisions ?? []).map((d: any) => d.id));
  const tournamentMembers = (members ?? []).filter((m: any) => divIds.has(m.division_id));

  // Build pool of athletes registered to the tournament but not yet in any division
  const memberAthleteIds = new Set(tournamentMembers.map((m: any) => m.athlete_id));
  const unassigned = (participants ?? [])
    .map((p: any) => Array.isArray(p.profile) ? p.profile[0] : p.profile)
    .filter((p: any) => p && !memberAthleteIds.has(p.id));

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
        initialDivisions={(divisions ?? []) as any}
        initialMembers={tournamentMembers as any}
        unassigned={unassigned as any}
      />
    </div>
  );
}
