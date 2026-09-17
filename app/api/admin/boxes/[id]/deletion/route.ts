import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import {
  BLOCKING_TABLES, assessEmptiness, pluralLabel,
  type BlockingCount,
} from '@/lib/boxDeletion';

/**
 * Suppression définitive d'une box, et le décompte qui dit si c'est permis.
 *
 * `GET`    → ce qui partirait avec la box, poste par poste.
 * `DELETE` → supprime, après avoir REFAIT le décompte.
 *
 * Le décompte est refait côté serveur avant la suppression : l'écran a pu être
 * ouvert il y a dix minutes, et une box peut s'être remplie entre-temps. Une
 * garde d'affichage n'est pas une garde.
 *
 * Réservé `super_admin`. La suppression emporte trente-cinq tables en cascade,
 * dont l'historique ELO et les encaissements : c'est irréversible, au contraire
 * de l'archivage, vers lequel l'écran renvoie quand la box n'est pas vide.
 */

async function checkSuperAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') return null;
  return user;
}

type Service = ReturnType<typeof createServiceClient>;

/** Décompte de tout ce qui référence la box, table par table. */
async function countAll(supabase: Service, boxId: string) {
  const counts: BlockingCount[] = await Promise.all(
    BLOCKING_TABLES.map(async (t) => {
      const { count, error } = await supabase
        .from(t.table)
        .select('id', { count: 'exact', head: true })
        .eq(t.column, boxId);
      // Une table absente de cette base ne doit pas faire échouer le décompte :
      // on la compte à zéro plutôt que de refuser toute suppression.
      const n = error ? 0 : (count ?? 0);
      return { table: t.table, label: pluralLabel(t, n), count: n, restrict: t.restrict === true };
    }),
  );

  const { data: box } = await supabase
    .from('boxes').select('id, name, owner_id').eq('id', boxId).maybeSingle();

  const { count: otherMembers } = await supabase
    .from('box_members')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', boxId)
    .neq('member_id', (box as { owner_id?: string } | null)?.owner_id ?? '');

  // Un essai local n'a pas d'identifiant Stripe : il ne bloque pas, sinon
  // aucune box fantôme ne serait supprimable — c'est justement le cas visé.
  const { count: stripeSubs } = await supabase
    .from('box_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('box_id', boxId)
    .not('stripe_subscription_id', 'is', null);

  return {
    box: box as { id: string; name: string; owner_id: string | null } | null,
    assessment: assessEmptiness({
      counts,
      otherMembers: otherMembers ?? 0,
      stripeSubscriptions: stripeSubs ?? 0,
    }),
    counts: counts.filter((c) => c.count > 0),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSuperAdmin())) {
    return NextResponse.json({ error: 'Réservé aux super administrateurs.' }, { status: 403 });
  }
  const { id } = await params;
  const supabase = createServiceClient();
  const { box, assessment, counts } = await countAll(supabase, id);
  if (!box) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });
  return NextResponse.json({ name: box.name, ...assessment, counts });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkSuperAdmin())) {
    return NextResponse.json({ error: 'Réservé aux super administrateurs.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as { name?: unknown } | null;
  const supabase = createServiceClient();

  const { box, assessment, counts } = await countAll(supabase, id);
  if (!box) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });

  // Le nom retapé vise cette box-ci, pas « une box ».
  if (typeof body?.name !== 'string' || body.name.trim() !== box.name) {
    return NextResponse.json({
      error: `Pour supprimer, retape le nom exact de la box : « ${box.name} ».`,
    }, { status: 400 });
  }

  if (!assessment.empty) {
    return NextResponse.json({
      error: `Cette box n'est pas vide : ${assessment.blockers.join(', ')}. Archive-la plutôt que de la supprimer.`,
      blockers: assessment.blockers,
      counts,
    }, { status: 409 });
  }

  const { error } = await supabase.from('boxes').delete().eq('id', id);
  if (error) {
    // `23503` = une FK sans action de suppression a retenu la box. Le décompte
    // ci-dessus les couvre toutes, donc y arriver signale un désaccord entre
    // `BLOCKING_TABLES` et le schéma : on le dit plutôt que de rendre le code.
    const fk = error.code === '23503';
    return NextResponse.json({
      error: fk
        ? `La base a retenu la box malgré un décompte vide (${error.message}). Une table référence la box sans être listée dans BLOCKING_TABLES.`
        : error.message,
    }, { status: fk ? 409 : 500 });
  }

  return NextResponse.json({ deleted: true, name: box.name });
}
