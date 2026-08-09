import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Strict owner check: is `userId` the primary owner (boxes.owner_id) or an
 * active co-owner (box_members.role = 'owner') of `boxId`? Coaches are
 * deliberately excluded — banking and billing routes must not be reachable by
 * staff who don't own the box.
 */
export async function isBoxOwner(
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
  if (box) return true;

  const { data: coOwner } = await supabase
    .from('box_members')
    .select('id')
    .eq('box_id', boxId)
    .eq('member_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();

  return !!coOwner;
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
 * Guard for the money routes (Stripe Connect onboarding, billing portal,
 * subscription checkout/refresh). `/api/*` is excluded from the middleware, so
 * every one of these routes must authenticate on its own.
 *
 * 401 when there is no session, 403 when the session doesn't own `boxId`.
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
    (await isBoxOwner(service, user.id, boxId)) ||
    (await isPlatformAdmin(service, user.id));

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, service };
}
