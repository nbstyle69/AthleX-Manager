import { readSubscriptionState, type StopMode } from '@/lib/stripe/stopSubscription';
import { fullDate } from '@/lib/members/stopMembership';

/**
 * Programmes et offres (S4) : la base ne dit ni l'impayé (le webhook garde un
 * programme impayé `active`) ni la fin programmée. L'état vient donc de Stripe,
 * en lecture serveur, un abonnement à la fois.
 */
export async function subscriptionsOverview(stripeAccount: string | null, subscriptionIds: string[]) {
  let toStop = 0;
  let pastDue = 0;
  let lastEnd: string | null = null;
  for (const id of subscriptionIds) {
    if (!stripeAccount) { toStop += 1; continue; }
    try {
      const s = await readSubscriptionState({ stripeAccount, subscriptionId: id });
      if (s.stopping) {
        if (s.periodEnd && (!lastEnd || s.periodEnd > lastEnd)) lastEnd = s.periodEnd;
        continue;
      }
      toStop += 1;
      if (s.status === 'past_due' || s.status === 'unpaid') pastDue += 1;
    } catch {
      // Lecture impossible : compté comme à arrêter, l'arrêt dira s'il échoue.
      toStop += 1;
    }
  }
  return { active_subscriptions: subscriptionIds.length, to_stop: toStop, past_due: pastDue, last_end: lastEnd };
}

const until = (periodEnd: string | null) => (periodEnd ? `jusqu'au ${fullDate(periodEnd)}` : "jusqu'à la fin de ta période payée");

/** E-mail à l'acheteur d'un programme retiré de la vente. */
export function programStopEmail(o: { mode: StopMode; firstName: string; boxName: string; title: string; periodEnd: string | null }) {
  const { mode, firstName, boxName, title, periodEnd } = o;
  const reply = `Pour toute question, réponds à cet e-mail : il arrive directement à ${boxName}.`;
  if (mode === 'now') {
    return {
      subject: `Ton abonnement au programme ${title} est arrêté`,
      bodyText: `Bonjour ${firstName}, ${boxName} a retiré le programme ${title} et arrêté aujourd'hui ton abonnement, qui était en impayé. Aucun prélèvement ne sera plus fait. ${reply}`,
    };
  }
  return {
    subject: `${boxName} a retiré le programme ${title}`,
    bodyText: `Bonjour ${firstName}, ${boxName} a retiré le programme ${title} : tu gardes l'accès ${until(periodEnd)}. Ton abonnement prendra fin à cette date, sans nouveau prélèvement. ${reply}`,
  };
}

/** E-mail au gérant d'une box abonnée à une offre retirée de la vente. */
export function offerStopEmail(o: {
  mode: StopMode; firstName: string; publisherName: string; title: string; subscriberBoxName: string; periodEnd: string | null;
}) {
  const { mode, firstName, publisherName, title, subscriberBoxName, periodEnd } = o;
  const reply = `Pour toute question, réponds à cet e-mail : il arrive directement à ${publisherName}.`;
  if (mode === 'now') {
    return {
      subject: `L’abonnement de ${subscriberBoxName} à l’offre ${title} est arrêté`,
      bodyText: `Bonjour ${firstName}, ${publisherName} a retiré l'offre de programmation ${title} et arrêté aujourd'hui l'abonnement de ${subscriberBoxName}, qui était en impayé. Aucun prélèvement ne sera plus fait, et les séances déjà posées restent. ${reply}`,
    };
  }
  const jusqua = periodEnd ? `jusqu'au ${fullDate(periodEnd)}` : "jusqu'à la fin de sa période payée";
  return {
    subject: `${publisherName} a retiré l’offre ${title}`,
    bodyText: `Bonjour ${firstName}, ${publisherName} a retiré l'offre de programmation ${title} : ${subscriberBoxName} reçoit ses semaines ${jusqua}, et les séances déjà posées restent. L'abonnement prendra fin à cette date, sans nouveau prélèvement. ${reply}`,
  };
}
