// B3 : le webhook Connect relit l'abonnement chez Stripe avant d'écrire, sur le
// compte connecté de l'événement. Ces aides gardent les tests existants tels
// quels : un événement d'abonnement sans `account` en reçoit un (un vrai
// événement Connect le porte toujours), et la relecture rend l'abonnement de
// l'événement, comme si rien n'avait changé entre l'envoi et la lecture.

type Mock = { (...a: any[]): any; mock: { results: { value: any }[] } };

const isSubscriptionEvent = (e: any) => typeof e?.type === 'string' && e.type.startsWith('customer.subscription.');

export function withAccount(constructEvent: Mock) {
  return (...args: any[]) => {
    const e = constructEvent(...args);
    return isSubscriptionEvent(e) && !e.account ? { ...e, account: 'acct_test' } : e;
  };
}

export function rereadFromEvent(constructEvent: Mock, fallback?: (id: string) => any) {
  return async (id: string) => {
    const e = constructEvent.mock.results.at(-1)?.value;
    if (isSubscriptionEvent(e) && e.data?.object?.id === id) return e.data.object;
    return fallback ? fallback(id) : { id, status: 'active', items: { data: [] } };
  };
}
