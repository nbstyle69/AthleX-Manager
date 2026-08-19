import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Primary-owner check: is `userId` `boxes.owner_id` of `boxId`?
 *
 * Deliberately stricter than `isBoxOwnerAdmin`: a co-owner works in the box and
 * reads its subscription, but only the primary owner signs the contract —
 * checkout, cancellation, Stripe billing portal and Connect banking.
 */
export async function isBoxPrimaryOwner(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  boxId: string,
): Promise<boolean> {
  const { data: box } = await supabase
    .from('boxes')
    .select('id')
    .eq('id', boxId)
    .eq('owner_id', userId)
    .maybeSingle();

  return !!box;
}

export async function isPlatformAdmin(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  return role === 'admin' || role === 'super_admin';
}

type Guarded =
  | { ok: true; userId: string; service: ReturnType<typeof createServiceClient> }
  | { ok: false; response: NextResponse };

/**
 * Guard for the contract routes (Stripe Connect onboarding, billing portal,
 * subscription checkout/refresh). `/api/*` is excluded from the middleware, so
 * every one of these routes must authenticate on its own.
 *
 * 401 when there is no session, 403 when the session isn't the primary owner of
 * `boxId` — a co-owner reads the subscription but never changes it.
 * Never trusts a `box_id` coming from the client without that check.
 */
export async function requireBoxOwner(boxId: unknown): Promise<Guarded> {
  if (typeof boxId !== 'string' || boxId.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'box_id required' }, { status: 400 }),
    };
  }

  const authed = await createClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    };
  }

  const service = createServiceClient();
  const allowed =
    (await isBoxPrimaryOwner(service, user.id, boxId)) ||
    (await isPlatformAdmin(service, user.id));

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, service };
}
