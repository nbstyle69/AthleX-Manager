import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient, getServerUser, getActiveBox } from '@/lib/supabase/server';

/**
 * `boxes.dunning_grace_days` est une colonne de facturation : la Phase 3 la
 * révoque à `authenticated`, donc le back-office ne peut plus la lire ni
 * l'écrire directement. Elle passe par cette route, owner-strict, en
 * service_role — jamais depuis le navigateur.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const box = await getActiveBox(await createClient(), user.id);
  if (!box) return NextResponse.json({ error: 'Aucune box trouvée pour ce compte' }, { status: 404 });

  const { data, error } = await createServiceClient()
    .from('boxes').select('dunning_grace_days').eq('id', box.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dunning_grace_days: data.dunning_grace_days });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const box = await getActiveBox(await createClient(), user.id);
  if (!box) return NextResponse.json({ error: 'Aucune box trouvée pour ce compte' }, { status: 404 });

  const body = await req.json();
  const days = Number(body?.dunning_grace_days);
  if (!Number.isInteger(days) || days < 0 || days > 90) {
    return NextResponse.json({ error: 'Le délai doit être un entier entre 0 et 90 jours.' }, { status: 400 });
  }

  const { data, error } = await createServiceClient()
    .from('boxes').update({ dunning_grace_days: days }).eq('id', box.id)
    .select('dunning_grace_days').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dunning_grace_days: data.dunning_grace_days });
}
