import { fullDate } from '@/lib/confirmDialog';
import { parisDate } from '@/lib/datetime';
import type { StopMode } from '@/lib/stripe/stopSubscription';

/**
 * Notification push au membre à chaque arrêt de son abonnement de salle
 * (S2, bannissement, suppression d'une formule, archivage, demande de
 * résiliation acceptée). Envoyée par `send-push` (athlex-app), chemin serveur
 * seulement (`x-cron-secret`), type `membership_stopped` ; chaque téléphone
 * reçoit sa langue, l'app ouvre le profil.
 *
 * L'envoi ne bloque jamais l'arrêt : aucun échec ne lève, et rien de personnel
 * n'est journalisé (ni membre, ni box, ni texte).
 */

const EN_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

/** Titres et textes validés (FR, EN) ; la date en heure de Paris (#395). */
export function membershipStopPush(o: { mode: StopMode; boxName: string; periodEnd: string | null }) {
  const { mode, boxName, periodEnd } = o;
  if (mode === 'now') {
    return {
      title: 'Abonnement arrêté',
      body: `${boxName} a arrêté ton abonnement aujourd'hui.`,
      en: { title: 'Membership stopped', body: `${boxName} stopped your membership today.` },
    };
  }
  return {
    title: "Fin d'abonnement programmée",
    body: periodEnd
      ? `${boxName} a programmé la fin de ton abonnement le ${fullDate(periodEnd)}.`
      : `${boxName} a programmé la fin de ton abonnement à la fin de la période payée.`,
    en: {
      title: 'Membership ending',
      body: periodEnd
        ? `${boxName} has scheduled your membership to end on ${parisDate(periodEnd, EN_DATE, 'en-GB')}.`
        : `${boxName} has scheduled your membership to end at the end of the paid period.`,
    },
  };
}

/** Envoie le push ; `true` s'il est parti vers au moins un téléphone. Ne lève jamais. */
export async function sendMembershipStoppedPush(o: {
  userId: string; boxId: string; mode: StopMode; boxName: string; periodEnd: string | null;
}): Promise<boolean> {
  return sendMemberPush('membership_stopped', {
    user_id: o.userId,
    ...membershipStopPush(o),
    data: { type: 'membership_stopped', box_id: o.boxId },
  });
}

/**
 * Décision du gérant sur une demande de changement de formule au comptoir.
 * Rangée sous « annonces de la box » (le réglage du membre s'applique) ;
 * `data.type` inconnu de l'app : le toucher ouvre simplement l'app.
 */
export function planChangeDecisionPush(o: { accepted: boolean; planName: string | null }) {
  const plan = o.planName ?? 'ta nouvelle formule';
  const planEn = o.planName ?? 'your new plan';
  return o.accepted
    ? {
        title: 'Changement de formule accepté',
        body: `Ta box a accepté ton passage à ${plan}.`,
        en: { title: 'Plan change accepted', body: `Your box accepted your switch to ${planEn}.` },
      }
    : {
        title: 'Changement de formule refusé',
        body: 'Ta box a refusé ta demande de changement de formule.',
        en: { title: 'Plan change declined', body: 'Your box declined your plan change request.' },
      };
}

export async function sendPlanChangeDecisionPush(o: {
  userId: string; boxId: string; accepted: boolean; planName: string | null;
}): Promise<boolean> {
  return sendMemberPush('box_announcements', {
    user_id: o.userId,
    ...planChangeDecisionPush(o),
    data: { type: 'membership_plan_change', box_id: o.boxId },
  });
}

/** Un push au membre par send-push, chemin serveur (`x-cron-secret`). Ne lève jamais. */
async function sendMemberPush(category: string, recipient: Record<string, unknown>): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url) {
    console.error('membership push skipped: CRON_SECRET or Supabase URL missing');
    return false;
  }
  try {
    const res = await fetch(`${url}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': secret,
        ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}),
      },
      body: JSON.stringify({ category, recipients: [recipient] }),
      // Une fonction lente ne retient pas l'arrêt.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('membership push failed: status', res.status);
      return false;
    }
    const out = await res.json().catch(() => null) as { sent?: number } | null;
    const sent = out?.sent ?? 0;
    // `sent: 0` : pas de téléphone, ou notifications coupées par le membre.
    console.log('membership push done: sent', sent);
    return sent > 0;
  } catch (err) {
    console.error('membership push failed:', err instanceof Error ? err.name : 'error');
    return false;
  }
}
