import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { validateVolumeCapPatch, type SkeletonRow, type VolumeCapRow } from '@/lib/adminCatalog';

/**
 * `wod_volume_caps` (table §5.4, éditable) et `wod_skeletons` (lecture seule)
 * pour `/admin/volume-caps`. Même garde que le catalogue : rôle admin revérifié,
 * écriture en service role. PATCH modifie un plafond (`label` dans le corps) ;
 * aucune écriture n'existe pour les squelettes.
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
  const [caps, skeletons] = await Promise.all([
    supabase.from('wod_volume_caps').select('*').order('label', { ascending: true }),
    supabase.from('wod_skeletons').select('*').order('discipline', { ascending: true }).order('id', { ascending: true }),
  ]);
  const error = caps.error ?? skeletons.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    caps: (caps.data ?? []) as VolumeCapRow[],
    skeletons: (skeletons.data ?? []) as SkeletonRow[],
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  const body = await req.json().catch(() => null) as { label?: unknown } | null;
  const label = body && typeof body.label === 'string' ? body.label : null;
  if (!label) return NextResponse.json({ error: 'label requis' }, { status: 400 });
  const { errors, patch } = validateVolumeCapPatch(body);
  if (errors.length) return NextResponse.json({ error: errors.join(' · ') }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('wod_volume_caps')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('label', label)
    .select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'plafond introuvable' }, { status: 404 });
  return NextResponse.json(data[0] as VolumeCapRow);
}
