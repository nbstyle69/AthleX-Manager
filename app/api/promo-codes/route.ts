import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

interface PromoRow {
  id: string;
  box_id: string;
  code: string;
  discount_type: 'percent' | 'amount';
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  is_active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
  created_at: string;
}

/** Liste les codes promo d'une box (staff uniquement). */
export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const boxId = req.nextUrl.searchParams.get('box_id');
    if (!boxId) {
      return NextResponse.json({ error: 'box_id requis.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    if (!(await isBoxStaff(supabase, user.id, boxId))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const { data } = await supabase
      .from('membership_promo_codes')
      .select('*')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ codes: (data ?? []) as PromoRow[] });
  } catch (err: any) {
    console.error('promo-codes GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Crée un code promo : coupon + promotion code sur le compte Connect de la box. */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await req.json();
    const boxId: string | undefined = body.box_id;
    const rawCode: string | undefined = body.code;
    const discountType: 'percent' | 'amount' = body.discount_type;
    const duration: 'once' | 'repeating' | 'forever' = body.duration ?? 'once';

    if (!boxId || !rawCode || (discountType !== 'percent' && discountType !== 'amount')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const code = String(rawCode).trim().toUpperCase();
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      return NextResponse.json(
        { error: 'Le code doit faire 3 à 30 caractères (lettres/chiffres, sans espace).' },
        { status: 400 },
      );
    }

    const percentOff = discountType === 'percent' ? Number(body.percent_off) : null;
    const amountOffCents = discountType === 'amount' ? Math.round(Number(body.amount_off_cents)) : null;
    if (discountType === 'percent' && (!percentOff || percentOff <= 0 || percentOff > 100)) {
      return NextResponse.json({ error: 'Pourcentage invalide (1 à 100).' }, { status: 400 });
    }
    if (discountType === 'amount' && (!amountOffCents || amountOffCents <= 0)) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }

    const durationInMonths = duration === 'repeating' ? Math.round(Number(body.duration_in_months)) : null;
    if (duration === 'repeating' && (!durationInMonths || durationInMonths <= 0)) {
      return NextResponse.json({ error: 'Nombre de mois invalide.' }, { status: 400 });
    }

    const maxRedemptions =
      body.max_redemptions === '' || body.max_redemptions == null
        ? null
        : Math.round(Number(body.max_redemptions));
    if (maxRedemptions != null && maxRedemptions <= 0) {
      return NextResponse.json({ error: 'Nombre max d\'utilisations invalide.' }, { status: 400 });
    }

    const expiresAt: string | null = body.expires_at || null;
    const expiresUnix = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;
    if (expiresUnix != null && expiresUnix <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: 'La date d\'expiration doit être dans le futur.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    if (!(await isBoxStaff(supabase, user.id, boxId))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const { data: box } = await supabase
      .from('boxes')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('id', boxId)
      .single();
    const b = box as { stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null;
    if (!b?.stripe_account_id || !b.stripe_onboarding_complete) {
      return NextResponse.json(
        { error: 'Active d\'abord les paiements (Stripe) pour créer des codes promo.' },
        { status: 409 },
      );
    }
    const stripeAccount = b.stripe_account_id;

    // Refus précoce si le code existe déjà pour cette box (l'index unique le
    // garantit aussi, mais on renvoie un message clair).
    const { data: existing } = await supabase
      .from('membership_promo_codes')
      .select('id')
      .eq('box_id', boxId)
      .ilike('code', code)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Ce code existe déjà pour ta box.' }, { status: 409 });
    }

    const currency = (body.currency as string) || 'eur';

    const coupon = await stripe.coupons.create(
      {
        name: code,
        duration,
        ...(duration === 'repeating' ? { duration_in_months: durationInMonths! } : {}),
        ...(discountType === 'percent'
          ? { percent_off: percentOff! }
          : { amount_off: amountOffCents!, currency }),
        ...(maxRedemptions != null ? { max_redemptions: maxRedemptions } : {}),
        ...(expiresUnix != null ? { redeem_by: expiresUnix } : {}),
      },
      { stripeAccount },
    );

    // NB: on épingle l'API Stripe 2023-10-16 (voir getStripe), où `coupon` est
    // au premier niveau. On construit donc les params sans le typage plus récent.
    const promoParams = {
      coupon: coupon.id,
      code,
      active: true,
      ...(maxRedemptions != null ? { max_redemptions: maxRedemptions } : {}),
      ...(expiresUnix != null ? { expires_at: expiresUnix } : {}),
    } as unknown as Stripe.PromotionCodeCreateParams;

    const promo = await stripe.promotionCodes.create(promoParams, { stripeAccount });

    const { data: inserted, error: insErr } = await supabase
      .from('membership_promo_codes')
      .insert({
        box_id: boxId,
        code,
        discount_type: discountType,
        percent_off: percentOff,
        amount_off_cents: amountOffCents,
        currency,
        duration,
        duration_in_months: durationInMonths,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt,
        is_active: true,
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promo.id,
      })
      .select('*')
      .single();

    if (insErr) {
      // Rollback Stripe pour ne pas laisser un coupon orphelin.
      await stripe.coupons.del(coupon.id, { stripeAccount }).catch(() => {});
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ code: inserted as PromoRow });
  } catch (err: any) {
    console.error('promo-codes POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
