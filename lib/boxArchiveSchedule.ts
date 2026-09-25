import type { SupabaseClient } from '@supabase/supabase-js';
import { readSubscriptionState, stopSubscription, type StopMode } from '@/lib/stripe/stopSubscription';
import {
  fullDate, memberFirstName, sendMemberEmail, stopBoxMember, stopEmailContent,
  type StopProfile,
} from '@/lib/members/stopMembership';
import { offerStopEmail, programStopEmail } from '@/lib/stopProductSubscriptions';
import { countOf } from '@/lib/deleteWithSubscriptions';
import { ATHLEX_CONTACT_EMAIL } from '@/lib/site-url';

/**
 * Archivage d'une box en deux temps (PR 2 sur 3, paiement).
 *
 * La base (PR 1, athlex-app `20270127`) sait fermer les entrées
 * (`archive_scheduled_at`) et archiver seule, toutes les heures, une box
 * programmée où plus rien ne paie. Ici : arrêter chez Stripe tout ce qui paie
 * encore, avant de programmer.
 *
 * Règles validées par Nabil (25/09/2026) :
 * - chaque abonnement s'arrête en fin de période, ou tout de suite s'il est en
 *   impayé (membre, programme, offre, box) ; clé d'idempotence par abonnement ;
 * - membres par Stripe : arrêt S2 (journal, e-mail, engagement levé) ;
 * - programmes et offres vendus : arrêt S4 (e-mails S4) ;
 * - offres achetées par la box à d'autres éditeurs : arrêtées aussi ;
 * - droits en attente qui portent un abonnement : arrêtés comme les autres ;
 * - abonnement de la box à AthleX : sur le compte de la plateforme ;
 *   `manual` n'est pas touché ; le plan Multi du gérant non plus ;
 * - un seul échec : rien n'est programmé (les arrêts réussis restent) ; une
 *   relance ne rappelle pas Stripe pour un abonnement déjà en voie d'arrêt ;
 * - plus rien ne paie : archivage immédiat, comme avant.
 *
 * Aucune donnée personnelle dans les journaux serveur.
 */

const PAYING = ['active', 'trialing', 'past_due'];
const isPastDue = (status: string | null | undefined) => status === 'past_due' || status === 'unpaid';

interface BoxRow {
  id: string; name: string; stripe_account_id: string | null; contact_email: string | null;
  owner_id: string | null; archived_at: string | null; archive_scheduled_at: string | null;
}
interface MemberRow {
  id: string; box_id: string; member_id: string; plan_id: string | null; status: string | null;
  stripe_subscription_id: string | null; subscription_status: string | null;
  subscription_cancel_at_period_end: boolean | null; subscription_current_period_end: string | null;
  commitment_end_date: string | null;
}
/** Un abonnement dont l'état se lit chez Stripe (programmes, offres, droits, box). */
interface StripeSub {
  kind: 'program' | 'offer_sold' | 'offer_bought' | 'pending' | 'box';
  /** Ligne en base (clé d'idempotence). */
  rowId: string;
  subscriptionId: string;
  /**
   * Compte connecté ; `undefined` = plateforme (abonnement de la box à
   * AthleX) ; `null` = compte introuvable (l'arrêt échoue sans appel Stripe).
   */
  account: string | undefined | null;
  /** Nom affiché si l'arrêt échoue. */
  label: string;
  // Pour les e-mails.
  userId?: string;
  email?: string | null;
  title?: string;
  planId?: string | null;
  subscriberBoxId?: string;
}

export interface ArchiveTargets {
  box: BoxRow;
  stripeMembers: MemberRow[];
  counterMembers: MemberRow[];
  subs: StripeSub[];
  /** Abonnement de la box à AthleX (la ligne, même `manual`). */
  boxSubscription: { id: string; billing_source: string | null; status: string | null; stripe_subscription_id: string | null; current_period_end: string | null } | null;
}

type Db = SupabaseClient;

export async function loadArchiveTargets(supabase: Db, boxId: string): Promise<ArchiveTargets | null> {
  const { data: boxRaw } = await supabase
    .from('boxes')
    .select('id, name, stripe_account_id, contact_email, owner_id, archived_at, archive_scheduled_at')
    .eq('id', boxId).maybeSingle();
  const box = boxRaw as BoxRow | null;
  if (!box) return null;
  // Sans compte connecté, les abonnements de la box ne peuvent pas être arrêtés.
  const account = box.stripe_account_id ?? null;

  const { data: membersRaw } = await supabase
    .from('box_members')
    .select('id, box_id, member_id, plan_id, status, stripe_subscription_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_end, commitment_end_date')
    .eq('box_id', boxId);
  const members = (membersRaw ?? []) as MemberRow[];
  const stripeMembers = members.filter(m => !!m.stripe_subscription_id && PAYING.includes(m.subscription_status ?? ''));
  // Comptoir : adhésion en cours sans abonnement Stripe (règle de la page Abonnés).
  const counterMembers = members.filter(m => !m.stripe_subscription_id && m.subscription_status === 'active' && m.status === 'active');

  const subs: StripeSub[] = [];

  // Programmes vendus par la box : abonnements actifs.
  const { data: programsRaw } = await supabase.from('programs').select('id, title').eq('box_id', boxId);
  const programs = (programsRaw ?? []) as { id: string; title: string }[];
  const programTitle = new Map(programs.map(p => [p.id, p.title]));
  if (programs.length) {
    const { data: pmRaw } = await supabase
      .from('program_members').select('id, user_id, program_id, stripe_subscription_id, status')
      .in('program_id', programs.map(p => p.id)).eq('status', 'active');
    for (const pm of (pmRaw ?? []) as { id: string; user_id: string; program_id: string; stripe_subscription_id: string | null }[]) {
      if (!pm.stripe_subscription_id) continue;
      subs.push({ kind: 'program', rowId: pm.id, subscriptionId: pm.stripe_subscription_id, account, label: 'un acheteur de programme', userId: pm.user_id, title: programTitle.get(pm.program_id) ?? 'ce programme' });
    }
  }

  // Offres vendues par la box (elle est l'éditrice).
  const { data: soldRaw } = await supabase.from('box_programming').select('id, title').eq('publisher_box_id', boxId);
  const sold = (soldRaw ?? []) as { id: string; title: string }[];
  const soldTitle = new Map(sold.map(o => [o.id, o.title]));
  if (sold.length) {
    const { data: ssRaw } = await supabase
      .from('box_programming_subscriptions').select('id, subscriber_box_id, programming_id, stripe_subscription_id, status')
      .in('programming_id', sold.map(o => o.id)).in('status', ['active', 'past_due']);
    for (const s of (ssRaw ?? []) as { id: string; subscriber_box_id: string; programming_id: string; stripe_subscription_id: string | null }[]) {
      if (!s.stripe_subscription_id) continue;
      subs.push({ kind: 'offer_sold', rowId: s.id, subscriptionId: s.stripe_subscription_id, account, label: 'une box abonnée', subscriberBoxId: s.subscriber_box_id, title: soldTitle.get(s.programming_id) ?? 'cette offre' });
    }
  }

  // Offres achetées par la box à d'autres éditeurs : sur le compte de l'éditeur.
  const { data: boughtRaw } = await supabase
    .from('box_programming_subscriptions').select('id, programming_id, stripe_subscription_id, status')
    .eq('subscriber_box_id', boxId).in('status', ['active', 'past_due']);
  const bought = ((boughtRaw ?? []) as { id: string; programming_id: string; stripe_subscription_id: string | null }[]).filter(b => !!b.stripe_subscription_id);
  if (bought.length) {
    const { data: offersRaw } = await supabase
      .from('box_programming').select('id, title, publisher_box_id').in('id', bought.map(b => b.programming_id));
    const offers = new Map(((offersRaw ?? []) as { id: string; title: string; publisher_box_id: string }[]).map(o => [o.id, o]));
    const pubIds = Array.from(new Set(Array.from(offers.values()).map(o => o.publisher_box_id)));
    const { data: pubsRaw } = pubIds.length
      ? await supabase.from('boxes').select('id, name, stripe_account_id').in('id', pubIds)
      : { data: [] };
    const pubs = new Map(((pubsRaw ?? []) as { id: string; name: string; stripe_account_id: string | null }[]).map(p => [p.id, p]));
    for (const b of bought) {
      const offer = offers.get(b.programming_id);
      const pub = offer ? pubs.get(offer.publisher_box_id) : undefined;
      subs.push({
        kind: 'offer_bought', rowId: b.id, subscriptionId: b.stripe_subscription_id!,
        account: pub?.stripe_account_id ?? null,
        label: `l’offre ${offer?.title ?? 'achetée'}${pub ? ` de ${pub.name}` : ''}`,
        title: offer?.title,
      });
    }
  }

  // Droits en attente (achat payé avant la création du compte) qui portent un
  // abonnement : invisibles de `box_encore_payante`, arrêtés quand même.
  const { data: pendingRaw } = await supabase
    .from('pending_entitlements').select('id, email, kind, payload')
    .is('claimed_at', null).in('kind', ['membership', 'program']);
  for (const p of (pendingRaw ?? []) as { id: string; email: string; kind: string; payload: any }[]) {
    const subId = p.payload?.stripe_subscription_id;
    if (!subId) continue;
    const ours = p.kind === 'membership' ? p.payload?.box_id === boxId : programTitle.has(p.payload?.program_id);
    if (!ours) continue;
    subs.push({
      kind: 'pending', rowId: p.id, subscriptionId: subId, account, label: 'un achat en attente de compte',
      email: p.email, planId: p.kind === 'membership' ? p.payload?.plan_id ?? null : null,
      title: p.kind === 'program' ? programTitle.get(p.payload?.program_id) : undefined,
    });
  }

  // Abonnement de la box à AthleX : compte de la plateforme ; `manual` intouché.
  const { data: bsRaw } = await supabase
    .from('box_subscriptions').select('id, billing_source, status, stripe_subscription_id, current_period_end')
    .eq('box_id', boxId).maybeSingle();
  const boxSubscription = bsRaw as ArchiveTargets['boxSubscription'];
  if (boxSubscription && boxSubscription.billing_source === 'stripe' && boxSubscription.stripe_subscription_id
      && PAYING.includes(boxSubscription.status ?? '')) {
    subs.push({ kind: 'box', rowId: boxSubscription.id, subscriptionId: boxSubscription.stripe_subscription_id, account: undefined, label: 'l’abonnement de la box à AthleX' });
  }

  return { box, stripeMembers, counterMembers, subs, boxSubscription };
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

interface SubPlan { stopping: boolean; mode: StopMode; periodEnd: string | null; status: string | null; unreadable?: boolean }

/** État Stripe d'un abonnement ; illisible = compté à arrêter (l'arrêt dira s'il échoue). */
async function planFor(s: StripeSub): Promise<SubPlan> {
  if (s.account === null) return { stopping: false, mode: 'period_end', periodEnd: null, status: null, unreadable: true };
  try {
    const st = await readSubscriptionState({ stripeAccount: s.account ?? undefined, subscriptionId: s.subscriptionId });
    return { stopping: st.stopping, mode: isPastDue(st.status) ? 'now' : 'period_end', periodEnd: st.status === 'canceled' ? null : st.periodEnd, status: st.status };
  } catch {
    return { stopping: false, mode: 'period_end', periodEnd: null, status: null, unreadable: true };
  }
}

interface Tally { active: number; to_stop: number; past_due: number; already_stopping: number }
const tally = (): Tally => ({ active: 0, to_stop: 0, past_due: 0, already_stopping: 0 });

/** `check` : lecture seule, en base et chez Stripe. */
export async function archiveCheck(supabase: Db, t: ArchiveTargets) {
  const now = new Date().toISOString();
  let lastEnd: string | null = null;
  let stillPaying = false;

  const members = { ...tally(), committed: 0 };
  for (const m of t.stripeMembers) {
    members.active += 1;
    const pastDue = m.subscription_status === 'past_due';
    if (pastDue) members.past_due += 1;
    if (m.commitment_end_date && m.commitment_end_date > now) members.committed += 1;
    if (!pastDue && m.subscription_cancel_at_period_end) members.already_stopping += 1;
    else members.to_stop += 1;
    if (!pastDue) { stillPaying = true; lastEnd = later(lastEnd, m.subscription_current_period_end); }
  }

  const byKind: Record<StripeSub['kind'], Tally> = {
    program: tally(), offer_sold: tally(), offer_bought: tally(), pending: tally(), box: tally(),
  };
  let boxState: SubPlan | null = null;
  for (const s of t.subs) {
    const k = byKind[s.kind];
    k.active += 1;
    const p = await planFor(s);
    if (s.kind === 'box') boxState = p;
    if (p.stopping) {
      k.already_stopping += 1;
      if (p.periodEnd) { stillPaying = true; lastEnd = later(lastEnd, p.periodEnd); }
      continue;
    }
    k.to_stop += 1;
    if (p.mode === 'now') { k.past_due += 1; continue; }
    stillPaying = true;
    lastEnd = later(lastEnd, p.periodEnd);
  }

  const bs = t.boxSubscription;
  const all = [members, ...Object.values(byKind)];
  return {
    ok: true as const,
    box: { name: t.box.name, archived_at: t.box.archived_at, archive_scheduled_at: t.box.archive_scheduled_at },
    members,
    counter_members: t.counterMembers.length,
    programs: byKind.program,
    offers_sold: byKind.offer_sold,
    offers_bought: byKind.offer_bought,
    pending: byKind.pending,
    box_subscription: bs ? {
      source: bs.billing_source === 'manual' ? 'manual' : 'stripe',
      status: (boxState as SubPlan | null)?.status ?? bs.status,
      stopping: (boxState as SubPlan | null)?.stopping ?? false,
      period_end: (boxState as SubPlan | null)?.periodEnd ?? bs.current_period_end,
      // `manual`, ou déjà terminé : rien à arrêter.
      to_stop: byKind.box.to_stop > 0,
    } : null,
    to_stop: all.reduce((n, x) => n + x.to_stop, 0),
    past_due: all.reduce((n, x) => n + x.past_due, 0),
    last_end: lastEnd,
    still_paying: stillPaying,
  };
}

export type ArchiveCheck = Awaited<ReturnType<typeof archiveCheck>>;

/** Clé d'idempotence d'un arrêt d'archivage, par abonnement et par mode. */
export const archiveStopKey = (s: Pick<StripeSub, 'kind' | 'rowId' | 'subscriptionId'>, mode: StopMode) =>
  `stop:archive:${s.kind}:${s.rowId}:${s.subscriptionId}:${mode}`;

/** E-mail au gérant (texte du relevé ; clauses selon ce que la box paie). */
export function ownerArchiveEmail(o: {
  firstName: string; boxName: string; date: string | null; boxPaysAthlex: boolean; boughtOffers: boolean;
}) {
  const { firstName, boxName, date, boxPaysAthlex, boughtOffers } = o;
  const le = date ? `Le ${fullDate(date)}` : 'À la fin du dernier abonnement';
  const aussi = [
    boxPaysAthlex ? `l'abonnement de ${boxName} à AthleX` : null,
    boughtOffers ? `ses abonnements aux offres de programmation d'autres boxs` : null,
  ].filter(Boolean).join(', et ');
  return {
    subject: date ? `${boxName} sera archivée le ${fullDate(date)}` : `${boxName} sera archivée à la fin du dernier abonnement`,
    bodyText: `Bonjour ${firstName}, l'archivage de ${boxName} est programmé. Les abonnements de tes membres s'arrêtent à la fin de leur période payée${aussi ? `, et ${aussi} aussi` : ''} : aucun nouveau prélèvement, aucun remboursement. D'ici là, toi et tes membres gardez l'accès ; les nouvelles adhésions, invitations et ventes sont fermées. ${le}, ${boxName} sera archivée : rien n'est supprimé. Pour toute question, réponds à cet e-mail.`,
  };
}

/** E-mail aux membres au comptoir (nouveau texte, à valider par Nabil). */
export function counterMemberArchiveEmail(o: { firstName: string; boxName: string; date: string | null }) {
  const { firstName, boxName, date } = o;
  const quand = date ? `le ${fullDate(date)}` : 'à la fin du dernier abonnement en cours';
  return {
    subject: date ? `${boxName} ferme le ${fullDate(date)}` : `${boxName} va fermer`,
    bodyText: `Bonjour ${firstName}, ${boxName} va être archivée ${quand} : ton accès à la box et à ses cours s'arrêtera à cette date. D'ici là, rien ne change pour toi. Les ventes au comptoir sont fermées. Pour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`,
  };
}

export type ScheduleResult =
  | { status: 200; body: { ok: true; archived: true; stopped: number; warning?: string } }
  | { status: 200; body: { ok: true; scheduled: true; stopped: number; last_end: string | null; warning?: string } }
  | { status: 409 | 502; body: { error: string; failed?: string[]; stopped?: number } };

/** `schedule` : les arrêts, puis la programmation (ou l'archivage immédiat). */
export async function archiveSchedule(supabase: Db, t: ArchiveTargets, actorId: string): Promise<ScheduleResult> {
  if (t.box.archived_at) return { status: 409, body: { error: 'Cette box est déjà archivée.' } };
  if (t.box.archive_scheduled_at) return { status: 409, body: { error: 'L’archivage de cette box est déjà programmé.' } };

  const box = t.box;
  const failed: string[] = [];
  let stopped = 0;
  let notEmailed = 0;
  let lastEnd: string | null = null;
  let stillPaying = false;

  // Profils (e-mails) et formules des membres et acheteurs.
  const userIds = Array.from(new Set([
    ...t.stripeMembers.map(m => m.member_id), ...t.counterMembers.map(m => m.member_id),
    ...t.subs.filter(s => s.userId).map(s => s.userId!), ...(box.owner_id ? [box.owner_id] : []),
  ]));
  const { data: profilesRaw } = userIds.length
    ? await supabase.from('profiles').select('id, email, username, full_name').in('id', userIds)
    : { data: [] };
  const profileById = new Map(((profilesRaw ?? []) as (StopProfile & { id: string })[]).map(p => [p.id, p]));
  const planIds = Array.from(new Set([
    ...t.stripeMembers.map(m => m.plan_id), ...t.subs.map(s => s.planId),
  ].filter((x): x is string => !!x)));
  const { data: plansRaw } = planIds.length
    ? await supabase.from('membership_plans').select('id, name').in('id', planIds)
    : { data: [] };
  const planName = new Map(((plansRaw ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]));
  const boxMemberByUser = new Map(t.stripeMembers.concat(t.counterMembers).map(m => [m.member_id, m.id]));
  const boxInfo = { name: box.name, stripe_account_id: box.stripe_account_id, contact_email: box.contact_email };

  // 1. Membres par Stripe : arrêt S2 (journal, e-mail, engagement levé).
  for (const m of t.stripeMembers) {
    const pastDue = m.subscription_status === 'past_due';
    // Déjà en fin programmée : la base le dit, Stripe n'est pas rappelé.
    if (!pastDue && m.subscription_cancel_at_period_end) {
      stillPaying = true; lastEnd = later(lastEnd, m.subscription_current_period_end); continue;
    }
    const mode: StopMode = pastDue ? 'now' : 'period_end';
    const profile = profileById.get(m.member_id) ?? null;
    try {
      const { emailed } = await stopBoxMember(supabase, {
        member: m, box: boxInfo, profile, planName: m.plan_id ? planName.get(m.plan_id) ?? null : null, mode, actorId,
      });
      stopped += 1;
      if (!emailed) notEmailed += 1;
    } catch {
      failed.push(profile?.username ?? 'un membre');
      continue;
    }
    if (mode === 'period_end') { stillPaying = true; lastEnd = later(lastEnd, m.subscription_current_period_end); }
  }

  // 2. Abonnements lus chez Stripe : programmes, offres, droits en attente, box.
  const subscriberBoxIds = Array.from(new Set(t.subs.filter(s => s.subscriberBoxId).map(s => s.subscriberBoxId!)));
  const { data: subBoxesRaw } = subscriberBoxIds.length
    ? await supabase.from('boxes').select('id, name, owner_id').in('id', subscriberBoxIds)
    : { data: [] };
  const subBoxById = new Map(((subBoxesRaw ?? []) as { id: string; name: string; owner_id: string | null }[]).map(b => [b.id, b]));
  const subOwnerIds = Array.from(subBoxById.values()).map(b => b.owner_id).filter((x): x is string => !!x);
  const { data: subOwnersRaw } = subOwnerIds.length
    ? await supabase.from('profiles').select('id, email, username, full_name').in('id', subOwnerIds)
    : { data: [] };
  const subOwnerById = new Map(((subOwnersRaw ?? []) as (StopProfile & { id: string })[]).map(p => [p.id, p]));

  for (const s of t.subs) {
    let mode: StopMode = 'period_end';
    let periodEnd: string | null = null;
    try {
      if (s.account === null) throw new Error('Compte de paiement introuvable.');
      const st = await readSubscriptionState({ stripeAccount: s.account ?? undefined, subscriptionId: s.subscriptionId });
      if (st.stopping) {
        // Relance : déjà en voie d'arrêt, rien n'est refait ni re-prévenu.
        if (st.status !== 'canceled' && st.periodEnd) { stillPaying = true; lastEnd = later(lastEnd, st.periodEnd); }
        continue;
      }
      periodEnd = st.periodEnd;
      if (isPastDue(st.status)) mode = 'now';
      await stopSubscription({ stripeAccount: s.account ?? undefined, subscriptionId: s.subscriptionId, mode, idempotencyKey: archiveStopKey(s, mode) });
      stopped += 1;
    } catch {
      failed.push(s.label);
      continue;
    }
    if (mode === 'period_end') { stillPaying = true; lastEnd = later(lastEnd, periodEnd); }

    // E-mails S2 / S4 ; l'offre achetée et la box sont dites au gérant (e-mail d'archivage).
    let sent: boolean | null = null;
    if (s.kind === 'program') {
      const profile = profileById.get(s.userId!) ?? null;
      // Journal : seulement si l'acheteur est membre de la box (box_member_id requis).
      const bmId = boxMemberByUser.get(s.userId!) ?? null;
      let journalId: string | null = null;
      if (bmId) {
        const { data: j, error: je } = await supabase.from('box_member_subscription_actions').insert({
          box_id: box.id, box_member_id: bmId, member_id: s.userId, action: 'stop', mode,
          stripe_subscription_id: s.subscriptionId, refund_cents: 0, actor_id: actorId,
        }).select('id').maybeSingle();
        if (je) console.error('archive program journal insert failed:', je.message);
        journalId = (j as { id: string } | null)?.id ?? null;
      }
      sent = profile?.email ? await sendMemberEmail({
        to: profile.email,
        ...programStopEmail({ mode, firstName: memberFirstName(profile), boxName: box.name, title: s.title ?? 'ce programme', periodEnd }),
        boxName: box.name, replyTo: box.contact_email, tag: 'archive-program-stop',
      }) : false;
      if (sent && journalId) {
        await supabase.from('box_member_subscription_actions').update({ notified_at: new Date().toISOString() }).eq('id', journalId);
      }
    } else if (s.kind === 'offer_sold') {
      const subBox = subBoxById.get(s.subscriberBoxId!) ?? null;
      const owner = subBox?.owner_id ? subOwnerById.get(subBox.owner_id) ?? null : null;
      sent = owner?.email ? await sendMemberEmail({
        to: owner.email,
        ...offerStopEmail({ mode, firstName: memberFirstName(owner), publisherName: box.name, title: s.title ?? 'cette offre', subscriberBoxName: subBox?.name ?? 'ta box', periodEnd }),
        boxName: box.name, replyTo: box.contact_email, tag: 'archive-offer-stop',
      }) : false;
    } else if (s.kind === 'pending') {
      const content = s.title
        ? programStopEmail({ mode, firstName: memberFirstName(null), boxName: box.name, title: s.title, periodEnd })
        : stopEmailContent({ mode, firstName: memberFirstName(null), boxName: box.name, planName: (s.planId && planName.get(s.planId)) || 'de salle', periodEnd });
      sent = s.email ? await sendMemberEmail({ to: s.email, ...content, boxName: box.name, replyTo: box.contact_email, tag: 'archive-pending-stop' }) : false;
    }
    if (sent === false) notEmailed += 1;
  }

  if (failed.length > 0) {
    return {
      status: 502,
      body: {
        error: `Stripe a refusé l’arrêt de ${countOf(failed.length, 'abonnement', 'abonnements')} : ${failed.join(', ')}. L’archivage n’a pas été programmé ; les autres abonnements sont bien arrêtés. Tu peux relancer : les abonnements déjà arrêtés ne seront pas rappelés.`,
        failed,
        stopped,
      },
    };
  }

  const warn = (n: number) => (n > 0 ? { warning: n === 1 ? '1 e-mail n’est pas parti : préviens la personne directement.' : `${n} e-mails ne sont pas partis : préviens ces personnes directement.` } : {});

  // Plus rien ne paie : archivage immédiat, comme avant.
  if (!stillPaying) {
    const { error } = await supabase.from('boxes')
      .update({ archived_at: new Date().toISOString(), archived_by: actorId })
      .eq('id', box.id).is('archived_at', null);
    if (error) return { status: 502, body: { error: error.message, stopped } };
    return { status: 200, body: { ok: true, archived: true, stopped, ...warn(notEmailed) } };
  }

  const { error } = await supabase.from('boxes')
    .update({ archive_scheduled_at: new Date().toISOString(), archive_scheduled_by: actorId })
    .eq('id', box.id).is('archived_at', null).is('archive_scheduled_at', null);
  if (error) return { status: 502, body: { error: error.message, stopped } };

  // E-mail au gérant (réponse vers AthleX) et aux membres au comptoir (vers la box).
  const owner = box.owner_id ? profileById.get(box.owner_id) ?? null : null;
  if (owner?.email) {
    const { subject, bodyText } = ownerArchiveEmail({
      firstName: memberFirstName(owner), boxName: box.name, date: lastEnd,
      boxPaysAthlex: t.subs.some(s => s.kind === 'box'), boughtOffers: t.subs.some(s => s.kind === 'offer_bought'),
    });
    const ok = await sendMemberEmail({ to: owner.email, subject, bodyText, boxName: box.name, replyTo: ATHLEX_CONTACT_EMAIL, tag: 'archive-owner', footer: 'Message envoyé par AthleX.' });
    if (!ok) notEmailed += 1;
  } else {
    notEmailed += 1;
  }
  for (const m of t.counterMembers) {
    const p = profileById.get(m.member_id) ?? null;
    const ok = p?.email ? await sendMemberEmail({
      to: p.email, ...counterMemberArchiveEmail({ firstName: memberFirstName(p), boxName: box.name, date: lastEnd }),
      boxName: box.name, replyTo: box.contact_email, tag: 'archive-counter',
    }) : false;
    if (!ok) notEmailed += 1;
  }

  return { status: 200, body: { ok: true, scheduled: true, stopped, last_end: lastEnd, ...warn(notEmailed) } };
}

/** `unschedule` : la fonction de la PR 1 ; aucun abonnement n'est relancé. */
export async function archiveUnschedule(supabase: Db, boxId: string): Promise<{ status: 200 | 409 | 500; body: Record<string, unknown> }> {
  const { error } = await supabase.rpc('unschedule_box_archive', { p_box_id: boxId });
  if (!error) return { status: 200, body: { ok: true, unscheduled: true } };
  const msg = error.message ?? '';
  const m = msg.match(/^(BOX_DEJA_ARCHIVEE|ARCHIVAGE_NON_PROGRAMME|BOX_INCONNUE):?\s*(.*)$/);
  if (m) {
    const text = m[2] || (m[1] === 'BOX_INCONNUE' ? 'Box introuvable.' : msg);
    return { status: 409, body: { error: text.charAt(0).toUpperCase() + text.slice(1), code: m[1] } };
  }
  return { status: 500, body: { error: msg || 'Annulation impossible.' } };
}
