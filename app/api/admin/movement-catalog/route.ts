import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { validateMovementPatch, type MovementCatalogAdminRow } from '@/lib/adminCatalog';

/**
 * Édition de `movement_catalog` depuis l'admin. Les grants de la table
 * (lecture `authenticated`, écriture `service_role`) imposent le passage par
 * le serveur : rôle admin / super_admin revérifié, écriture en service role.
 * GET renvoie toutes les lignes (inactives comprises), POST crée, PATCH
 * modifie une ligne (`id` dans le corps). Les JSON (cadence, rep_ranges,
 * substitutions, equipment) restent en lecture seule ici.
 */

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

const COLUMNS = '*';

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('movement_catalog')
    .select(COLUMNS)
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []) as MovementCatalogAdminRow[]);
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  const { errors, patch } = validateMovementPatch(await req.json().catch(() => null), true);
  if (errors.length) return NextResponse.json({ error: errors.join(' · ') }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('movement_catalog')
    .insert({
      ...patch,
      grip: 'none',
      shoulder_load: 'none',
      equipment: [],
      loads: patch.loads ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data as MovementCatalogAdminRow);
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  const body = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = body && typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const { errors, patch } = validateMovementPatch(body, false);
  if (errors.length) return NextResponse.json({ error: errors.join(' · ') }, { status: 400 });
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'rien à modifier' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('movement_catalog')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS);
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'mouvement introuvable' }, { status: 404 });
  return NextResponse.json(data[0] as MovementCatalogAdminRow);
}
