import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { boxSellsOnline, type CounterAccessMember } from '@/lib/comptoir/counter';

/**
 * Paiements au comptoir (P1), PR 5 — lecture des fins d'accès pour Abonnés.
 *
 * `get_box_billing` (ce que la page lit déjà) ne sert pas `cash_access_until`,
 * et la colonne est fermée au navigateur, comme la file des messages
 * (`box_member_access_notices`), `allow_counter_renewal` et la règle
 * `internal.box_vend_en_ligne`. Tout passe donc par cette route : gérant ou
 * co-gérant de la box (jamais le coach), clé serveur, lecture seule.
 */
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const boxId = req.nextUrl.searchParams.get('box_id');
  if (!boxId) return NextResponse.json({ error: 'box_id requis' }, { status: 400 });

  const service = createServiceClient();
  if (!(await isBoxOwnerAdmin(service, user.id, boxId))) {
    return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
  }

  const [boxRes, plansRes, membersRes, noticesRes, cashRes, invRes] = await Promise.all([
    service.from('boxes').select('allow_counter_renewal, stripe_account_id, stripe_onboarding_complete').eq('id', boxId).maybeSingle(),
    service.from('membership_plans').select('id, price_cents, is_active, stripe_price_id').eq('box_id', boxId),
    service.from('box_members')
      .select('id, member_id, status, joined_at, plan_id, subscription_status, payment_method_type, stripe_subscription_id, cash_access_until')
      .eq('box_id', boxId).eq('role', 'member'),
    service.from('box_member_access_notices')
      .select('box_member_id, kind, access_until, sent_at')
      .eq('box_id', boxId).not('sent_at', 'is', null)
      .order('sent_at', { ascending: false }),
    service.from('box_cash_payments').select('member_id').eq('box_id', boxId).in('source', ['renewal', 'invitation']),
    service.from('box_invitations').select('id, accepted_by, created_at')
      .eq('box_id', boxId).eq('payment_mode', 'box').eq('cash_collected', false).not('accepted_by', 'is', null),
  ]);

  const failed = [boxRes, plansRes, membersRes, noticesRes, cashRes, invRes].find((r) => r.error);
  if (failed?.error) {
    // Code seulement : ni identifiant ni donnée de membre dans les journaux.
    console.error('counter-access: lecture impossible', failed.error.code ?? 'error');
    return NextResponse.json({ error: 'Fins d’accès indisponibles.' }, { status: 500 });
  }

  type Plan = { id: string; price_cents: number | null; is_active: boolean | null; stripe_price_id: string | null };
  type Member = {
    id: string; member_id: string; status: string | null; joined_at: string | null; plan_id: string | null;
    subscription_status: string | null; payment_method_type: string | null;
    stripe_subscription_id: string | null; cash_access_until: string | null;
  };
  const plans = (plansRes.data ?? []) as Plan[];
  const priceById = new Map(plans.map((p) => [p.id, p.price_cents]));
  const paidAtCounter = new Set(((cashRes.data ?? []) as { member_id: string | null }[]).map((c) => c.member_id));
  const notices = (noticesRes.data ?? []) as { box_member_id: string; kind: string; access_until: string; sent_at: string }[];
  const invitations = (invRes.data ?? []) as { id: string; accepted_by: string; created_at: string }[];

  const members: CounterAccessMember[] = ((membersRes.data ?? []) as Member[]).map((m) => {
    // Dernier message parti pour la fin d'accès en cours (un nouvel encaissement change la fin).
    const notice = notices.find((n) => n.box_member_id === m.id && n.access_until === m.cash_access_until) ?? null;
    const inv = invitations.find((i) => i.accepted_by === m.member_id) ?? null;
    return {
      box_member_id: m.id,
      member_id: m.member_id,
      status: m.status,
      joined_at: m.joined_at,
      plan_id: m.plan_id,
      price_cents: m.plan_id ? priceById.get(m.plan_id) ?? null : null,
      subscription_status: m.subscription_status,
      payment_method_type: m.payment_method_type,
      has_stripe_subscription: !!m.stripe_subscription_id,
      cash_access_until: m.cash_access_until,
      has_counter_period: m.cash_access_until != null || paidAtCounter.has(m.member_id),
      last_notice: notice ? { kind: notice.kind, sent_at: notice.sent_at } : null,
      pending_invitation: inv ? { id: inv.id, created_at: inv.created_at } : null,
    };
  });

  const box = boxRes.data as { allow_counter_renewal: boolean | null; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null;
  return NextResponse.json({
    box: { allow_counter_renewal: !!box?.allow_counter_renewal, sells_online: boxSellsOnline(box, plans) },
    members,
  });
}
