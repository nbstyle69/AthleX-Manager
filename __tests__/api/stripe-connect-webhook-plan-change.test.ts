// Webhook Connect et changement de formule programmé : à la bascule, la
// formule ET le prix réel sont écrits, les colonnes scheduled_* vidées ; un
// échéancier relâché, annulé ou terminé vide les colonnes de sa ligne.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

const mockConstructEvent = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ webhooks: { constructEvent: mockConstructEvent } })),
}));
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }));

import { POST } from '../../app/api/stripe-connect-webhook/route';
import { createServiceClient } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const SCHEDULED = { scheduled_plan_id: 'illimite', scheduled_change_at: '2026-11-01T12:00:00Z', stripe_schedule_id: 'sub_sched_1' };
const VIDE = { scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null };

let db: ReturnType<typeof fakeSupabase>;

function monde(...lignes: Record<string, unknown>[]) {
  db = fakeSupabase({
    box_members: lignes.map((l, i) => ({
      id: `bm-${i + 1}`, box_id: 'box-1', member_id: `ath-${i + 1}`, plan_id: 'mensuel', amount_cents: 5000,
      subscription_status: 'active', stripe_subscription_id: `sub_${i + 1}`, past_due_since: null, ...l,
    })),
    membership_plans: [{ id: 'mensuel', price_cents: 5000, stripe_price_id: 'price_mensuel' }, { id: 'illimite', price_cents: 7000, stripe_price_id: 'price_illimite' }],
    program_members: [], box_programming_subscriptions: [],
  });
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
}

const req = (): any => ({ headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) }, text: jest.fn().mockResolvedValue('{}') });
function evenement(type: string, object: unknown) {
  mockConstructEvent.mockReturnValue({ id: `evt_${type}`, type, data: { object } });
  return POST(req()) as any;
}

const abonnement = (o: Record<string, unknown> = {}) => ({
  id: 'sub_1', status: 'active', cancel_at_period_end: false, cancel_at: null, current_period_end: 1795000000,
  metadata: { plan_id: 'illimite', box_id: 'box-1', member_id: 'ath-1' },
  items: { data: [{ quantity: 1, metadata: {}, price: { id: 'price_illimite', unit_amount: 7000 } }] },
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('customer.subscription.updated : bascule d’un changement programmé', () => {
  it('écrit la nouvelle formule et le prix réel de l’item, puis vide les trois colonnes', async () => {
    monde(SCHEDULED);
    const res = await evenement('customer.subscription.updated', abonnement());
    expect(res._status).toBe(200);
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'illimite', amount_cents: 7000, ...VIDE });
  });

  it('prix réel × quantité, formule lue sur l’item quand l’abonnement n’en porte pas', async () => {
    monde(SCHEDULED);
    await evenement('customer.subscription.updated', abonnement({
      metadata: {},
      items: { data: [{ quantity: 2, metadata: { plan_id: 'illimite' }, price: { id: 'price_x', unit_amount: 3500 } }] },
    }));
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'illimite', amount_cents: 7000, ...VIDE });
  });

  it('formule écrite différente de celle programmée : les colonnes restent', async () => {
    monde({ ...SCHEDULED, scheduled_plan_id: 'premium' });
    await evenement('customer.subscription.updated', abonnement());
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'illimite', scheduled_plan_id: 'premium', stripe_schedule_id: 'sub_sched_1' });
  });

  it('abonnement arrêté : ni formule, ni montant, ni nettoyage', async () => {
    monde(SCHEDULED);
    await evenement('customer.subscription.updated', abonnement({ status: 'canceled' }));
    expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'mensuel', amount_cents: 5000, ...SCHEDULED });
  });

  it('rejouée : même résultat (idempotente)', async () => {
    monde(SCHEDULED);
    await evenement('customer.subscription.updated', abonnement());
    const apres = { ...db.tables.box_members[0] };
    await evenement('customer.subscription.updated', abonnement());
    expect(db.tables.box_members[0]).toEqual(apres);
  });
});

describe('subscription_schedule.* : l’échéancier n’existe plus', () => {
  it.each(['subscription_schedule.released', 'subscription_schedule.canceled', 'subscription_schedule.completed'])(
    '%s : colonnes vidées sur la seule ligne qui porte l’échéancier, formule intacte', async (type) => {
      monde(SCHEDULED, { ...SCHEDULED, stripe_schedule_id: 'sub_sched_2' });
      const res = await evenement(type, { id: 'sub_sched_1', status: 'released' });
      expect(res._status).toBe(200);
      expect(db.tables.box_members[0]).toMatchObject({ plan_id: 'mensuel', amount_cents: 5000, ...VIDE });
      expect(db.tables.box_members[1]).toMatchObject({ stripe_schedule_id: 'sub_sched_2', scheduled_plan_id: 'illimite' });
      // Conditionnel sur l'échéancier.
      expect(db.writes).toEqual([expect.objectContaining({ table: 'box_members', op: 'update', values: VIDE, match: { stripe_schedule_id: 'sub_sched_1' } })]);
    });

  it('rejoué ou sans ligne correspondante : 200, sans effet', async () => {
    monde(SCHEDULED);
    await evenement('subscription_schedule.released', { id: 'sub_sched_1' });
    const apres = JSON.stringify(db.tables.box_members);
    expect((await evenement('subscription_schedule.released', { id: 'sub_sched_1' }))._status).toBe(200);
    expect((await evenement('subscription_schedule.canceled', { id: 'sub_sched_inconnu' }))._status).toBe(200);
    expect(JSON.stringify(db.tables.box_members)).toBe(apres);
  });

  it('événement d’échéancier non traité : 200, aucune écriture', async () => {
    monde(SCHEDULED);
    const res = await evenement('subscription_schedule.updated', { id: 'sub_sched_1' });
    expect(res._status).toBe(200);
    expect(db.writes).toEqual([]);
  });
});
