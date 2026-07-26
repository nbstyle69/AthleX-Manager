import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });
}

/**
 * Gèle (pause) ou réactive l'abonnement de salle d'un membre.
 * Action réservée au staff de la box (owner/coach). Le prélèvement Stripe est
 * suspendu via `pause_collection` puis repris (`pause_collection: ''`).
 * Body: { box_member_id: string, action: 'pause' | 'resume', resumes_at?: string }
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { box_member_id, action, resumes_at } = await req.json();
    if (!box_member_id || (action !== 'pause' && action !== 'resume')) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: memberRaw } = await supabase
      .from('box_members')
      .select('id, box_id, stripe_subscription_id, subscription_status')
      .eq('id', box_member_id)
      .maybeSingle();

    const member = memberRaw as {
      id: string; box_id: string;
      stripe_subscription_id: string | null; subscription_status: string | null;
    } | null;

    if (!member) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }

    if (!(await isBoxStaff(supabase, user.id, member.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    if (!member.stripe_subscription_id) {
      return NextResponse.json({ error: 'Ce membre n\'a pas d\'abonnement Stripe.' }, { status: 409 });
    }

    const { data: box } = await supabase
      .from('boxes')
      .select('stripe_account_id')
      .eq('id', member.box_id)
      .single();
    const stripeAccount = (box as { stripe_account_id: string | null } | null)?.stripe_account_id;
    if (!stripeAccount) {
      return NextResponse.json({ error: 'Compte de paiement de la box introuvable.' }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (action === 'pause') {
      const resumesUnix = resumes_at ? Math.floor(new Date(resumes_at).getTime() / 1000) : undefined;
      await stripe.subscriptions.update(
        member.stripe_subscription_id,
        {
          pause_collection: {
            behavior: 'void',
            ...(resumesUnix ? { resumes_at: resumesUnix } : {}),
          },
        },
        { stripeAccount },
      );
      await supabase.from('box_members').update({
        subscription_paused: true,
        pause_started_at: now,
        pause_resumes_at: resumes_at ?? null,
      }).eq('id', member.id);
    } else {
      await stripe.subscriptions.update(
        member.stripe_subscription_id,
        { pause_collection: '' as unknown as null },
        { stripeAccount },
      );
      await supabase.from('box_members').update({
        subscription_paused: false,
        pause_started_at: null,
        pause_resumes_at: null,
      }).eq('id', member.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('pause-membership error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
