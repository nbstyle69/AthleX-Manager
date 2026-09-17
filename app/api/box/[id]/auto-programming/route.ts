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

/** 8 semaines : la même fenêtre que le journal admin. */
const WINDOW_MS = 8 * 7 * 86400000;

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

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data: runs } = await service
    .from('box_auto_programming_runs')
    .select('id, box_id, track, iso_year, iso_week, status, regen_counter, error, wod_ids, generated_at')
    .eq('box_id', id)
    .gte('generated_at', since)
    .order('generated_at', { ascending: false });

  return NextResponse.json({
    enabled,
    tracks,
    reveal: revealFromRow(row),
    runs: (runs ?? []) as AutoRun[],
  });
}
