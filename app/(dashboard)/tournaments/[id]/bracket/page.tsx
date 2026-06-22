import { createClient, createServiceClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, GitBranch } from 'lucide-react';
import BracketManager from '@/components/tournaments/BracketManager';

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  const { data: t } = await supabase
    .from('tournaments').select('*').eq('id', id).eq('box_id', box.id).single();
  if (!t) redirect('/tournaments');
  if (t.format !== 'bracket' && t.format !== 'swiss') redirect(`/tournaments/${id}`);

  const svc = createServiceClient();
  const [{ data: matches }, { data: participants }, { data: wods }] = await Promise.all([
    svc.from('tournament_bracket_matches').select('*').eq('tournament_id', id)
       .order('round', { ascending: true }).order('side').order('match_number'),
    svc.from('tournament_participants')
       .select('athlete_id')
       .eq('tournament_id', id),
    svc.from('tournament_wods').select('id, title, order_index, bracket_stage').eq('tournament_id', id).order('order_index'),
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

  // Normalize WODs to the shape expected by BracketManager (name/position).
  const wodList = (wods ?? []).map((w: any) => ({
    id: w.id, name: w.title, position: w.order_index ?? null, bracket_stage: w.bracket_stage ?? null,
  }));

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">{t.name} — Bracket</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#C9A227]/15 text-[#C9A227]">
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
      />
    </div>
  );
}
