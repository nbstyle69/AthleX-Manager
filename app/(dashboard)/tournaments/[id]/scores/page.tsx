import { divisionIdsOf, getTournamentForActiveBox } from '@/lib/tournaments/getTournamentForActiveBox';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ScoresClient, { ScoreRow } from './ScoresClient';

export default async function TournamentScoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params;

  // Les scores sont lus en `service_role` : l'appartenance du tournoi à la box
  // active se vérifie donc AVANT, pas après.
  const { tournament, svc } = await getTournamentForActiveBox<Record<string, any>>(
    tournamentId, 'name, box_id, require_video_proof, format',
  );

  const { data: rawScores } = await svc.from('tournament_scores')
    .select('id, score_value, submitted_at, status, video_url, notes, admin_message, athlete_id, tournament_wod_id, division_id, tw:tournament_wods(title, type, reps_per_round)')
    .eq('tournament_id', tournamentId)
    .order('submitted_at', { ascending: false });

  // Ligue : divisions du tournoi et division actuelle de chaque athlète, pour
  // afficher la division figée du score (#350) et la corriger.
  const isLeague = (tournament as any).format === 'league_div';
  let divisions: { id: string; name: string }[] = [];
  const currentDivisionByAthlete: Record<string, string> = {};
  if (isLeague) {
    const divisionIds = await divisionIdsOf(svc, tournamentId);
    const [{ data: divs }, { data: members }] = await Promise.all([
      svc.from('tournament_divisions').select('id, name').eq('tournament_id', tournamentId).order('level'),
      divisionIds.length > 0
        ? svc.from('tournament_division_members').select('athlete_id, division_id').in('division_id', divisionIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    divisions = (divs ?? []) as { id: string; name: string }[];
    (members ?? []).forEach((m: any) => { currentDivisionByAthlete[m.athlete_id] = m.division_id; });
  }

  const athleteIds = [...new Set((rawScores ?? []).map((s: any) => s.athlete_id))];
  let profileMap: Record<string, { username: string; level: string }> = {};
  if (athleteIds.length > 0) {
    const { data: profs } = await svc.from('profiles').select('id, username, level').in('id', athleteIds);
    (profs ?? []).forEach((p: any) => { profileMap[p.id] = { username: p.username, level: p.level }; });
  }

  const scores: ScoreRow[] = (rawScores ?? []).map((s: any) => ({
    id:               s.id,
    score_value:      s.score_value,
    submitted_at:     s.submitted_at,
    status:           s.status,
    video_url:        s.video_url ?? null,
    notes:            s.notes ?? null,
    admin_message:    s.admin_message ?? null,
    athlete_id:       s.athlete_id,
    tournament_wod_id: s.tournament_wod_id,
    division_id:      s.division_id ?? null,
    username:         profileMap[s.athlete_id]?.username ?? null,
    level:            profileMap[s.athlete_id]?.level    ?? null,
    wod_title:        (Array.isArray(s.tw) ? s.tw[0] : s.tw)?.title ?? null,
    wod_type:         (Array.isArray(s.tw) ? s.tw[0] : s.tw)?.type ?? null,
    reps_per_round:   (Array.isArray(s.tw) ? s.tw[0] : s.tw)?.reps_per_round ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${tournamentId}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-black text-white">Scores — {(tournament as any).name}</h1>
      </div>

      <ScoresClient tournamentId={tournamentId} initialScores={scores} requireVideoProof={!!(tournament as any).require_video_proof}
        divisions={isLeague ? divisions : undefined} currentDivisionByAthlete={currentDivisionByAthlete} />
    </div>
  );
}
