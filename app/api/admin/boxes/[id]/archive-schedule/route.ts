import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { archiveCheck, archiveSchedule, archiveUnschedule, loadArchiveTargets } from '@/lib/boxArchiveSchedule';

/**
 * Archivage d'une box en deux temps (PR 2 sur 3, paiement) — `super_admin`
 * seul, comme l'archivage direct.
 *
 * Body: { action: 'check' | 'schedule' | 'unschedule' }
 * - `check` : lecture seule, en base et chez Stripe — ce qui paie encore et
 *   ce qui sera arrêté, date de fin la plus lointaine ;
 * - `schedule` : arrête chaque abonnement (fin de période, impayé tout de
 *   suite), puis programme l'archivage si TOUS les arrêts ont réussi, et
 *   prévient le gérant et les membres au comptoir. Un échec : 502, rien de
 *   programmé. Plus rien ne paie : archivage immédiat ;
 * - `unschedule` : `unschedule_box_archive` (PR 1). Aucun abonnement relancé.
 *
 * Le cœur est dans `lib/boxArchiveSchedule.ts`.
 */

async function checkSuperAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') return null;
  return user;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await checkSuperAdmin();
    if (!user) return NextResponse.json({ error: 'Réservé aux super administrateurs.' }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => null) as { action?: unknown } | null;
    const action = body?.action;
    if (action !== 'check' && action !== 'schedule' && action !== 'unschedule') {
      return NextResponse.json({ error: 'action : check, schedule ou unschedule' }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (action === 'unschedule') {
      const r = await archiveUnschedule(supabase, id);
      return NextResponse.json(r.body, { status: r.status });
    }

    const targets = await loadArchiveTargets(supabase, id);
    if (!targets) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });

    if (action === 'check') return NextResponse.json(await archiveCheck(supabase, targets));

    const r = await archiveSchedule(supabase, targets, user.id);
    return NextResponse.json(r.body, { status: r.status });
  } catch (err: any) {
    console.error('archive-schedule error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
