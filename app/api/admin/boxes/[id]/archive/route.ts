import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';

/**
 * Archiver / réactiver une box (lot archivage).
 *
 * Réservé `super_admin` : l'archivage retire l'accès à tous les membres d'une
 * box, ce n'est pas une opération d'administration courante. `admin` ne suffit
 * pas, contrairement aux autres routes de ce dossier.
 *
 * L'écriture passe en service role, qui contourne la RLS — nécessaire, car la
 * policy `boxes_hide_archived` (migration `20261224`) masque justement la box
 * une fois archivée : sans le service role, on ne pourrait plus la rouvrir.
 *
 * Archivage PR 2 : archiver passe désormais par
 * `/api/admin/boxes/[id]/archive-schedule` (arrêt des abonnements Stripe, puis
 * archivage programmé ou immédiat). Ici, seulement « Réactiver ».
 */

async function checkSuperAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') return null;
  return user;
}

/** La base ne connaît pas encore la colonne (migration non appliquée). */
function isMissingColumn(error: { code?: string | null } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkSuperAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Réservé aux super administrateurs.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as { archived?: unknown } | null;
  if (typeof body?.archived !== 'boolean') {
    return NextResponse.json({ error: 'archived : booléen attendu' }, { status: 400 });
  }
  // Archiver ici laisserait les abonnements Stripe prélever une box archivée.
  if (body.archived) {
    return NextResponse.json({
      error: 'Pour archiver une box, passe par la programmation de l’archivage : elle arrête d’abord les abonnements Stripe.',
    }, { status: 409 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('boxes')
    .update({ archived_at: null, archived_by: null })
    .eq('id', id)
    .select('id, name, archived_at, archived_by')
    .single();

  if (isMissingColumn(error)) {
    return NextResponse.json({
      error: "L'archivage n'existe pas encore sur cette base : la migration `20261224` n'est pas appliquée.",
    }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });

  return NextResponse.json(data);
}
