import { selectMembership, type MembershipBillingRow } from '@/lib/compte/membership';

function row(p: Partial<MembershipBillingRow>): MembershipBillingRow {
  return {
    id: p.id ?? 'm1',
    box_id: p.box_id ?? 'b1',
    status: p.status ?? 'active',
    joined_at: p.joined_at ?? '2026-01-01T00:00:00Z',
    plan_id: p.plan_id ?? 'p1',
    subscription_status: p.subscription_status ?? null,
    subscription_current_period_end: p.subscription_current_period_end ?? null,
    amount_cents: p.amount_cents ?? 5000,
    commitment_end_date: p.commitment_end_date ?? null,
    subscription_paused: p.subscription_paused ?? null,
    pause_resumes_at: p.pause_resumes_at ?? null,
  };
}

describe('adhésion affichée sur /compte', () => {
  it('une adhésion active sans abonnement Stripe est affichée', () => {
    // 34 des 40 adhésions de la prod sont dans ce cas (formule attribuée ou
    // payée au comptoir) : l'ancien filtre leur montrait « Trouve ta box ».
    const { membership, stripeBacked, canManage } = selectMembership([
      row({ subscription_status: null }),
    ]);
    expect(membership?.id).toBe('m1');
    expect(stripeBacked).toBe(false);
    expect(canManage).toBe(false);
  });

  it('un abonnement Stripe vivant passe devant une adhésion locale plus récente', () => {
    const { membership, stripeBacked, canManage } = selectMembership([
      row({ id: 'local', joined_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'stripe', joined_at: '2026-01-01T00:00:00Z', subscription_status: 'active' }),
    ]);
    expect(membership?.id).toBe('stripe');
    expect(stripeBacked).toBe(true);
    expect(canManage).toBe(true);
  });

  it('un abonnement résilié reste visible mais ne se gère plus en ligne', () => {
    const { membership, stripeBacked, canManage } = selectMembership([
      row({ status: 'inactive', subscription_status: 'canceled' }),
    ]);
    expect(membership?.subscription_status).toBe('canceled');
    expect(stripeBacked).toBe(true);
    expect(canManage).toBe(false);
  });

  it('un paiement en retard reste gérable (c’est là qu’on veut agir)', () => {
    expect(selectMembership([row({ subscription_status: 'past_due' })]).canManage).toBe(true);
  });

  it('une adhésion ni active ni portée par Stripe n’est pas affichée', () => {
    const { membership } = selectMembership([
      row({ status: 'inactive', subscription_status: null }),
    ]);
    expect(membership).toBeNull();
  });

  it('sur deux box, la plus récemment rejointe l’emporte à statut égal', () => {
    const { membership } = selectMembership([
      row({ id: 'ancienne', box_id: 'b1', joined_at: '2025-02-01T00:00:00Z' }),
      row({ id: 'recente', box_id: 'b2', joined_at: '2026-04-01T00:00:00Z' }),
    ]);
    expect(membership?.id).toBe('recente');
  });
});
