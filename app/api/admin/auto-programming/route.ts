import { NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

/**
 * Journal de `generate-box-week` pour l'administration (lot J2) — lecture seule.
 *
 * Lu en service role : la policy de `box_auto_programming_runs` s'appuie sur
 * `is_box_owner_admin(box_id)`, qui répond « suis-je le gérant de cette box »
 * et pas « suis-je administrateur de la plateforme ». Un admin qui n'est
 * gérant d'aucune box ne verrait donc rien avec son propre JWT.
 */

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 8 * 7 * 86400000).toISOString();

  const { data, error } = await supabase
    .from('box_auto_programming_runs')
    .select('id, box_id, track, iso_year, iso_week, status, regen_counter, error, wod_ids, generated_at, box:boxes(name, slug)')
    .gte('generated_at', since)
    .order('generated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // `wod_ids` est un tableau : le « nombre de lignes » du journal en est le
  // cardinal. La table ne porte pas de compteur séparé.
  const rows = (data ?? []).map((r) => {
    const box = Array.isArray(r.box) ? r.box[0] : r.box;
    return {
      id: r.id,
      box_id: r.box_id,
      box_name: (box as { name?: string } | null)?.name ?? 'Box supprimée',
      track: r.track,
      iso_year: r.iso_year,
      iso_week: r.iso_week,
      status: r.status,
      regen_counter: r.regen_counter,
      rows: (r.wod_ids ?? []).length,
      error: r.error,
      generated_at: r.generated_at,
    };
  });

  return NextResponse.json(rows);
}
