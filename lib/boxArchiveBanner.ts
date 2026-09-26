import { fullDate } from '@/lib/confirmDialog';

/**
 * Bandeau « archivage programmé » du dashboard (archivage, PR 3) : pour le
 * gérant et le staff de la box concernée, sans aucune action (l'annulation
 * reste au super-admin).
 *
 * La date « au plus tard » vient de la base seule (pas d'appel Stripe à chaque
 * page) : la fin de période la plus lointaine des abonnements qui paient
 * encore, mêmes sources que `box_archive_overdue` (PR 1) — membres par Stripe,
 * abonnement de la box à AthleX, offres vendues ou achetées.
 */

type Reader = { from: (table: string) => any };

const PAYING = ['active', 'trialing', 'past_due'];
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export async function archiveBannerDate(service: Reader, boxId: string): Promise<string | null> {
  let last: string | null = null;

  const { data: members } = await service
    .from('box_members').select('stripe_subscription_id, subscription_status, subscription_current_period_end')
    .eq('box_id', boxId);
  for (const m of (members ?? []) as { stripe_subscription_id: string | null; subscription_status: string | null; subscription_current_period_end: string | null }[]) {
    if (m.stripe_subscription_id && PAYING.includes(m.subscription_status ?? '')) last = later(last, m.subscription_current_period_end);
  }

  const { data: subs } = await service
    .from('box_subscriptions').select('billing_source, status, current_period_end').eq('box_id', boxId);
  for (const s of (subs ?? []) as { billing_source: string | null; status: string | null; current_period_end: string | null }[]) {
    if (s.billing_source === 'stripe' && PAYING.includes(s.status ?? '')) last = later(last, s.current_period_end);
  }

  const { data: sold } = await service.from('box_programming').select('id').eq('publisher_box_id', boxId);
  const soldIds = ((sold ?? []) as { id: string }[]).map(o => o.id);
  const offerRows: { stripe_subscription_id: string | null; status: string | null; current_period_end: string | null }[] = [];
  const { data: bought } = await service
    .from('box_programming_subscriptions').select('stripe_subscription_id, status, current_period_end').eq('subscriber_box_id', boxId);
  offerRows.push(...((bought ?? []) as typeof offerRows));
  if (soldIds.length) {
    const { data: soldSubs } = await service
      .from('box_programming_subscriptions').select('stripe_subscription_id, status, current_period_end').in('programming_id', soldIds);
    offerRows.push(...((soldSubs ?? []) as typeof offerRows));
  }
  for (const o of offerRows) {
    if (o.stripe_subscription_id && (o.status === 'active' || o.status === 'past_due')) last = later(last, o.current_period_end);
  }
  return last;
}

/** Texte du relevé : « Archivage programmé : {box} sera archivée au plus tard le {date}… ». */
export function archiveBannerText(boxName: string, date: string | null): { lead: string; rest: string } {
  const quand = date ? `au plus tard le ${fullDate(date)}, à la fin du dernier abonnement` : 'à la fin du dernier abonnement';
  return {
    lead: 'Archivage programmé :',
    rest: `${boxName} sera archivée ${quand}. Les nouvelles adhésions, invitations et ventes sont fermées.`,
  };
}

/** Le bandeau à afficher pour la box, ou `null` si elle n'est pas en archivage programmé. */
export async function loadArchiveBanner(service: Reader, box: { id: string; name: string }) {
  const { data } = await service.from('boxes').select('archived_at, archive_scheduled_at').eq('id', box.id).maybeSingle();
  const row = data as { archived_at: string | null; archive_scheduled_at: string | null } | null;
  if (!row?.archive_scheduled_at || row.archived_at) return null;
  return archiveBannerText(box.name, await archiveBannerDate(service, box.id));
}
