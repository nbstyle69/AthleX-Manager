import { createClient, createServiceClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, GitBranch } from 'lucide-react';
import BracketManager from '@/components/tournaments/BracketManager';

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getActiveBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments').select('*').eq('id', id).eq('box_id', box.id).single();
  if (!t) redirect('/tournaments');
  if (t.format !== 'bracket' && t.format !== 'swiss') redirect(`/tournaments/${id}`);

  const svc = createServiceClient();
  const [{ data: matches }, { data: participants }, { data: wods }, { data: scoreRows }] = await Promise.all([
    svc.from('tournament_bracket_matches').select('*').eq('tournament_id', id)
       .order('round', { ascending: true }).order('side').order('match_number'),
    svc.from('tournament_participants')
       .select('athlete_id')
       .eq('tournament_id', id),
    svc.from('tournament_wods').select('id, title, type, order_index, bracket_stage, reps_per_round, movements, description, scoring').eq('tournament_id', id).order('order_index'),
    svc.from('tournament_scores')
       .select('athlete_id, tournament_wod_id, score_value, tiebreak_value, video_url, notes, status, submitted_at')
       .eq('tournament_id', id)
       .in('status', ['pending', 'validated']),
  ]);

  // Profiles fetched separately (no FK embed — the relationship name is unreliable
  // and an embed error would silently zero-out the participants count).
  const athleteIds = [...new Set((participants ?? []).map((p: any) => p.athlete_id))];
  const profilesById: Record<string, any> = {};
  if (athleteIds.length > 0) {
    const { data: profs } = await svc.from('profiles')
      .select('id, username, level, elo')
      .in('id', athleteIds);
    (profs ?? []).forEach((p: any) => { profilesById[p.id] = p; });
  }

  // Normalize WODs to the shape expected by BracketManager (name/position/type).
  const wodList = (wods ?? []).map((w: any) => ({
    id: w.id, name: w.title, type: w.type ?? null,
    position: w.order_index ?? null, bracket_stage: w.bracket_stage ?? null,
    reps_per_round: w.reps_per_round ?? null,
    movements: Array.isArray(w.movements) ? w.movements : null,
    description: w.description ?? null,
    scoring: w.scoring ?? null,
  }));

  // Submitted scores grouped by WOD then athlete — displayed on each match card, in the
  // per-athlete submission sheet, and (validated ones) drive "auto-decide winner from score".
  const scoresByWod: Record<string, Record<string, {
    value: string; tiebreak: string | null; video: string | null;
    notes: string | null; status: string; submittedAt: string | null;
  }>> = {};
  (scoreRows ?? []).forEach((s: any) => {
    (scoresByWod[s.tournament_wod_id] ??= {})[s.athlete_id] = {
      value: s.score_value, tiebreak: s.tiebreak_value ?? null, video: s.video_url ?? null,
      notes: s.notes ?? null, status: s.status, submittedAt: s.submitted_at ?? null,
    };
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">{t.name} — Bracket</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/15 text-white">
            {t.format === 'swiss' ? 'Swiss' : 'Bracket'}
          </span>
        </div>
      </div>

      <BracketManager
        tournamentId={id}
        format={t.format}
        requireVideoProof={!!t.require_video_proof}
        finalWodPool={t.final_wod_pool ?? []}
        initialMatches={matches ?? []}
        profilesById={profilesById}
        participantsCount={(participants ?? []).length}
        wods={wodList}
        scoresByWod={scoresByWod}
      />
    </div>
  );
}
