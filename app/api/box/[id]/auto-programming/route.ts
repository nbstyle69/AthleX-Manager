import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/authz/boxStaff';
import { isTrack, revealFromRow, type AutoRun, type Track } from '@/lib/autoProgramming';

/**
 * Réglage et journal de la programmation automatique d'une box, pour le
 * Whiteboard (bandeau, état des boutons).
 *
 * Lu côté serveur en service role, et pas depuis le client, pour deux raisons :
 * la policy de `box_auto_programming_runs` s'appuie sur `is_box_owner_admin()`,
 * qui **exclut le coach** — un coach ne verrait aucune run ; et les colonnes
 * `auto_programming*` de `boxes` n'ont pas de grant colonne pour
 * `authenticated`. La garde d'accès est ici, explicite.
 */

/**
 * Le bandeau juge « cette semaine est-elle déjà générée » sur la semaine
 * *affichée*, qui peut être loin devant ou derrière. Une fenêtre sur
 * `generated_at` (celle du journal admin) répondrait « non » pour une semaine
 * ancienne dont la run est sortie de la fenêtre, et le bouton mentirait. On
 * prend donc les runs les plus récentes par semaine ciblée, sans fenêtre de
 * temps : deux pistes par semaine, 200 lignes couvrent environ deux ans.
 */
const RUNS_LIMIT = 200;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const service = createServiceClient();
  if (!(await isBoxStaff(service, user.id, id))) {
    return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
  }

  const { data: box, error } = await service
    .from('boxes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!box) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });

  const row = box as Record<string, unknown>;
  const enabled = row.auto_programming === true;
  const tracks = ((row.auto_programming_tracks as string[] | null) ?? []).filter(isTrack) as Track[];

  // Une box éteinte n'a pas de journal à montrer : on s'arrête avant la lecture.
  if (!enabled) {
    return NextResponse.json({ enabled, tracks, reveal: revealFromRow(row), runs: [] });
  }

  const { data: runs } = await service
    .from('box_auto_programming_runs')
    .select('id, box_id, track, iso_year, iso_week, status, regen_counter, error, wod_ids, generated_at')
    .eq('box_id', id)
    .order('iso_year', { ascending: false })
    .order('iso_week', { ascending: false })
    .limit(RUNS_LIMIT);

  return NextResponse.json({
    enabled,
    tracks,
    reveal: revealFromRow(row),
    runs: (runs ?? []) as AutoRun[],
  });
}
