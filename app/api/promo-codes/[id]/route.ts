import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

interface PromoRow {
  id: string;
  box_id: string;
  is_active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
}

async function loadAuthorized(id: string) {
  const user = await getServerUser();
  if (!user?.id) return { error: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) } as const;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('membership_promo_codes')
    .select('id, box_id, is_active, stripe_coupon_id, stripe_promotion_code_id')
    .eq('id', id)
    .maybeSingle();
  const promo = data as PromoRow | null;
  if (!promo) return { error: NextResponse.json({ error: 'Code introuvable.' }, { status: 404 }) } as const;

  if (!(await isBoxOwnerAdmin(supabase, user.id, promo.box_id))) {
    return { error: NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 }) } as const;
  }

  const { data: box } = await supabase
    .from('boxes')
    .select('stripe_account_id')
    .eq('id', promo.box_id)
    .single();
  const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id ?? null;

  return { error: null as null, supabase, promo, stripeAccount };
}

/** Active / désactive un code promo (le promotion code Stripe suit). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stripe = getStripe();
  try {
    const { id } = await params;
    const ctx = await loadAuthorized(id);
    if (ctx.error) return ctx.error;
    const { supabase, promo, stripeAccount } = ctx;

    const { is_active } = await req.json();
    const active = Boolean(is_active);

    if (promo.stripe_promotion_code_id && stripeAccount) {
      await stripe.promotionCodes.update(
        promo.stripe_promotion_code_id,
        { active },
        { stripeAccount },
      );
    }

    await supabase
      .from('membership_promo_codes')
      .update({ is_active: active })
      .eq('id', promo.id);

    return NextResponse.json({ ok: true, is_active: active });
  } catch (err: any) {
    console.error('promo-codes PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Supprime un code promo : coupon Stripe supprimé (invalide le code) + ligne DB. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const stripe = getStripe();
  try {
    const { id } = await params;
    const ctx = await loadAuthorized(id);
    if (ctx.error) return ctx.error;
    const { supabase, promo, stripeAccount } = ctx;

    if (promo.stripe_coupon_id && stripeAccount) {
      // Supprimer le coupon invalide définitivement le promotion code associé.
      await stripe.coupons.del(promo.stripe_coupon_id, { stripeAccount }).catch(() => {});
    }

    await supabase.from('membership_promo_codes').delete().eq('id', promo.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('promo-codes DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
