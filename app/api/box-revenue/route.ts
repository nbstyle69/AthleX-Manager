import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

interface MonthRow {
  month: string;              // 'YYYY-MM'
  membership_cents: number;   // abonnements de salle réellement encaissés
  program_cents: number;      // achats de programmes
  cash_cents: number;         // encaissements comptoir journalisés
}

function monthKey(epochSeconds: number) {
  const d = new Date(epochSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Historique de chiffre d'affaires d'une box, par mois.
 *
 * Pourquoi une route serveur plutôt qu'une requête SQL : la base ne porte que
 * l'état COURANT des abonnements Stripe (`box_members`), sans aucune écriture
 * mensuelle. Leur seul relevé réel vit sur le compte Stripe connecté de la box.
 *
 * Les programmes, eux, sont horodatés en base (`program_members.purchased_at`)
 * et n'ont pas besoin de Stripe.
 *
 * Le comptoir a longtemps été l'angle mort de cet historique : un encaissement
 * en espèces ne laissait ni montant ni date. Depuis le journal `20261026`, il en
 * laisse — mais seulement à partir de sa pose : rien ne sera jamais reconstruit
 * en amont.
 *
 * GET /api/box-revenue?box_id=<uuid>&months=6
 * → { months: MonthRow[], has_stripe_account: boolean }
 */
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
    const months = Math.min(Math.max(Number(req.nextUrl.searchParams.get('months') ?? 6), 1), 12);

    const supabase = createServiceClient();
    if (!(await isBoxOwnerAdmin(supabase, user.id, boxId))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    // Fenêtre : début du mois calendaire, `months` mois en arrière.
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCMonth(start.getUTCMonth() - (months - 1));
    const startEpoch = Math.floor(start.getTime() / 1000);

    const buckets = new Map<string, MonthRow>();
    for (let i = 0; i < months; i++) {
      const d = new Date(start);
      d.setUTCMonth(d.getUTCMonth() + i);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: key, membership_cents: 0, program_cents: 0, cash_cents: 0 });
    }
    const add = (key: string, field: 'membership_cents' | 'program_cents' | 'cash_cents', cents: number) => {
      const row = buckets.get(key);
      if (row) row[field] += cents;
    };

    // ── Abonnements de salle : factures du compte connecté ────────────────
    const { data: box } = await supabase
      .from('boxes')
      .select('stripe_account_id')
      .eq('id', boxId)
      .single();
    const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;

    if (stripeAccount) {
      const stripe = getStripe();
      for await (const inv of stripe.invoices.list(
        { created: { gte: startEpoch }, limit: 100 },
        { stripeAccount },
      )) {
        const paid = inv.amount_paid ?? 0;
        if (paid <= 0) continue;
        // Mois de la période facturée, pas de l'émission : une facture émise le
        // 31 pour la période suivante appartient au mois qu'elle couvre.
        const epoch = inv.lines?.data?.[0]?.period?.start ?? inv.period_start ?? inv.created;
        add(monthKey(epoch), 'membership_cents', paid);
      }
    }

    // ── Programmes : horodatés en base ────────────────────────────────────
    const { data: programs } = await supabase
      .from('programs')
      .select('id')
      .eq('box_id', boxId);
    const programIds = ((programs ?? []) as { id: string }[]).map(p => p.id);

    if (programIds.length > 0) {
      // Seule la provenance `stripe` est de l'argent encaissé. Une assignation
      // par le staff, un programme gratuit rejoint par code, ou une ligne
      // héritée d'avant la fermeture de l'inscription libre (legacy_unverified)
      // n'ont jamais rien payé : les compter gonflerait le CA du gérant.
      const { data: purchases } = await supabase
        .from('program_members')
        .select('amount_cents, purchased_at, status')
        .in('program_id', programIds)
        .eq('provenance', 'stripe')
        .gte('purchased_at', start.toISOString());

      for (const p of (purchases ?? []) as { amount_cents: number | null; purchased_at: string | null; status: string | null }[]) {
        if (!p.purchased_at || p.status === 'refunded') continue;
        add(p.purchased_at.slice(0, 7), 'program_cents', p.amount_cents ?? 0);
      }
    }

    // ── Comptoir : journalisé en base depuis 20261026 ────────────────────
    const { data: cash } = await supabase
      .from('box_cash_payments')
      .select('amount_cents, collected_at')
      .eq('box_id', boxId)
      .gte('collected_at', start.toISOString());

    for (const c of (cash ?? []) as { amount_cents: number; collected_at: string }[]) {
      add(c.collected_at.slice(0, 7), 'cash_cents', c.amount_cents);
    }

    return NextResponse.json({
      months: [...buckets.values()],
      has_stripe_account: Boolean(stripeAccount),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('box-revenue error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
