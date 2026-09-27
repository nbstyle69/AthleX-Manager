import { NextRequest, NextResponse } from 'next/server';
import { loadMembershipContext, billingPlanFor } from '@/lib/membershipCheckout';
import { parisYmd, ymdString } from '@/lib/membershipBilling';

/** Jour (AAAA-MM-JJ, Paris) d'une ancre Stripe. */
const anchorDate = (anchor: number | null) => (anchor ? ymdString(parisYmd(new Date(anchor * 1000))) : null);

/**
 * Aperçu des montants d'un abonnement de salle AVANT validation (lot 3) :
 * mêmes contrôles et même calcul que `create-membership-checkout`, sans rien
 * créer chez Stripe. La page Stripe reste la référence au centime près.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loaded = await loadMembershipContext(body);
    if (!loaded.ok) return loaded.response;
    const { ctx } = loaded;

    if (ctx.planType !== 'subscription') {
      return NextResponse.json({ error: 'Aperçu réservé aux abonnements.' }, { status: 400 });
    }

    const billing = billingPlanFor(ctx, body.billing_day);
    if (!billing.ok) return billing.response;
    const bp = billing.plan;

    return NextResponse.json(
      bp.kind === 'now'
        ? {
            kind: 'now',
            billing_day: billing.billingDay,
            currency: ctx.plan.currency || 'eur',
            today_cents: bp.todayCents,
            prorata_until: anchorDate(bp.anchor),
            next_charge_date: bp.nextChargeDate,
            recurring_cents: bp.recurringCents,
            due_date_ignored: bp.dueDateIgnored,
          }
        : {
            kind: 'deferred',
            billing_day: billing.billingDay,
            currency: ctx.plan.currency || 'eur',
            today_cents: 0,
            first_charge_date: bp.firstChargeDate,
            first_charge_cents: bp.firstChargeCents,
            merged_prorata_cents: bp.mergedProrataCents,
            prorata_until: anchorDate(bp.anchor),
            recurring_cents: bp.recurringCents,
            due_date: bp.dueDate,
          },
    );
  } catch (err: any) {
    console.error('membership-checkout-preview error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
