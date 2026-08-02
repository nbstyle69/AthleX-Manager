import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

interface InvoiceRow {
  id: string;
  number: string | null;
  month: string;          // 'YYYY-MM' de la période facturée
  created: string;        // ISO
  amount_paid_cents: number;
  amount_due_cents: number;
  status: string | null;
  url: string | null;
}

/** Mois de la période facturée (à défaut, mois d'émission). */
function invoiceMonth(inv: any): string {
  const epoch = inv.lines?.data?.[0]?.period?.start ?? inv.period_start ?? inv.created;
  const d = new Date(epoch * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Historique de facturation des abonnements d'une box, lu sur le compte
 * connecté Stripe : c'est le montant *réellement* facturé (donc proraté le
 * premier mois), là où `box_members.amount_cents` ne porte que le plein tarif.
 * Staff de la box uniquement.
 *
 * GET /api/subscriber-invoices?box_id=<uuid>
 * → { invoices: { [box_member_id]: InvoiceRow[] } }  (12 derniers mois)
 */
export async function GET(req: NextRequest) {
  const stripe = getStripe();
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

    const { data: box } = await supabase
      .from('boxes')
      .select('stripe_account_id')
      .eq('id', boxId)
      .single();
    const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;
    if (!stripeAccount) {
      return NextResponse.json({ invoices: {} });
    }

    const { data: members } = await supabase
      .from('box_members')
      .select('id, stripe_subscription_id')
      .eq('box_id', boxId)
      .not('stripe_subscription_id', 'is', null);

    const rows = (members ?? []) as { id: string; stripe_subscription_id: string }[];

    const invoices: Record<string, InvoiceRow[]> = {};
    await Promise.all(rows.map(async (m) => {
      try {
        const list = await stripe.invoices.list(
          { subscription: m.stripe_subscription_id, limit: 12 },
          { stripeAccount },
        );
        invoices[m.id] = list.data.map((inv: any) => ({
          id: inv.id,
          number: inv.number ?? null,
          month: invoiceMonth(inv),
          created: new Date(inv.created * 1000).toISOString(),
          amount_paid_cents: inv.amount_paid ?? 0,
          amount_due_cents: inv.amount_due ?? 0,
          status: inv.status ?? null,
          url: inv.hosted_invoice_url ?? null,
        }));
      } catch (e: any) {
        console.warn(`invoice list failed for ${m.stripe_subscription_id}: ${e.message}`);
      }
    }));

    return NextResponse.json({ invoices });
  } catch (err: any) {
    console.error('subscriber-invoices error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
