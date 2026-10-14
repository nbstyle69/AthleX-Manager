import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getServerUser, getActiveBox } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { boxSellsOnline } from '@/lib/comptoir/counter';

/**
 * Paiements au comptoir (P1), PR 5 — réglage « Autoriser le renouvellement au
 * comptoir ». `boxes.allow_counter_renewal` est refusé aux clients en base
 * (BOX_REGLAGE_RESERVE) : lecture et écriture passent ici, au modèle de
 * /api/box/dunning — gérant ou co-gérant de la box active, clé serveur, la
 * seule ligne de cette box.
 */
async function authorize() {
  const user = await getServerUser();
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };

  const box = await getActiveBox(await createClient());
  if (!box) return { error: NextResponse.json({ error: 'Aucune box trouvée pour ce compte' }, { status: 404 }) };

  const service = createServiceClient();
  if (!(await isBoxOwnerAdmin(service, user.id, box.id))) {
    return { error: NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 }) };
  }
  return { service, boxId: box.id as string };
}

async function sellsOnline(service: ReturnType<typeof createServiceClient>, boxId: string) {
  const [{ data: box }, { data: plans }] = await Promise.all([
    service.from('boxes').select('stripe_account_id, stripe_onboarding_complete').eq('id', boxId).maybeSingle(),
    service.from('membership_plans').select('is_active, stripe_price_id').eq('box_id', boxId),
  ]);
  return boxSellsOnline(box, plans ?? []);
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { service, boxId } = auth;

  const { data, error } = await service.from('boxes').select('allow_counter_renewal').eq('id', boxId).single();
  if (error) {
    console.error('counter-renewal: lecture impossible', error.code ?? 'error');
    return NextResponse.json({ error: 'Réglage indisponible.' }, { status: 500 });
  }
  return NextResponse.json({ allow_counter_renewal: !!data.allow_counter_renewal, sells_online: await sellsOnline(service, boxId) });
}

export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { service, boxId } = auth;

  const body = await req.json().catch(() => null);
  if (typeof body?.allow_counter_renewal !== 'boolean') {
    return NextResponse.json({ error: 'Valeur attendue : activé ou désactivé.' }, { status: 400 });
  }

  const { data, error } = await service
    .from('boxes').update({ allow_counter_renewal: body.allow_counter_renewal }).eq('id', boxId)
    .select('allow_counter_renewal').single();
  if (error) {
    console.error('counter-renewal: écriture impossible', error.code ?? 'error');
    return NextResponse.json({ error: 'Le réglage n’a pas pu être enregistré.' }, { status: 500 });
  }
  return NextResponse.json({ allow_counter_renewal: !!data.allow_counter_renewal });
}
