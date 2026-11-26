import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth/requestUser';
import { createServiceClient } from '@/lib/supabase/server';
import { getConnectStripe, invalidBoxIdError, optionalBoxId } from '@/lib/membership/server';
import { readOverview } from '@/lib/membership/overview';

export const dynamic = 'force-dynamic';

/**
 * « Mon abonnement » de l'appelant (cookie du site ou Bearer de l'app) : box,
 * formule, prix, mode, échéance, moyen de paiement, changement programmé,
 * demande en attente, formules proposables, motif de blocage. Lecture seule,
 * toujours bornée à `user.id` ; aucun identifiant Stripe dans la réponse.
 * `?box_id=` (facultatif, l'app) borne la lecture à cette box ; sans lui,
 * l'adhésion que /compte affiche.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const boxId = optionalBoxId(req.nextUrl.searchParams.get('box_id'));
    if (boxId === null) return invalidBoxIdError();

    const overview = await readOverview(createServiceClient(), getConnectStripe(), user.id, boxId);
    if (!overview) return NextResponse.json({ error: "Tu n'as pas d'adhésion active." }, { status: 404 });
    return NextResponse.json(overview);
  } catch (err) {
    console.error('membership overview error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });
  }
}
