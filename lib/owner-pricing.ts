import Stripe from 'stripe';

export interface OwnerPricing {
  basePrice: number; // € / month (Solo base plan)
  extraPerBox: number; // € / month per extra box
}

// Fallback used only when a Stripe price can't be resolved (misconfig / API error).
const FALLBACK: OwnerPricing = { basePrice: 79, extraPerBox: 29 };

async function priceToEuros(stripe: Stripe, priceId: string | undefined): Promise<number | null> {
  if (!priceId) return null;
  const price = await stripe.prices.retrieve(priceId);
  if (price.unit_amount == null) return null;
  return Math.round(price.unit_amount / 100);
}

// Resolve the Multi-box plan amounts from the same Stripe prices the checkout
// charges, so the upgrade overlay always shows what the owner is actually billed.
export async function getOwnerPricing(): Promise<OwnerPricing> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
    const [base, extra] = await Promise.all([
      priceToEuros(stripe, process.env.STRIPE_PRICE_MONTHLY_ID),
      priceToEuros(stripe, process.env.STRIPE_PRICE_EXTRA_BOX_ID),
    ]);
    return {
      basePrice: base ?? FALLBACK.basePrice,
      extraPerBox: extra ?? FALLBACK.extraPerBox,
    };
  } catch {
    return FALLBACK;
  }
}
