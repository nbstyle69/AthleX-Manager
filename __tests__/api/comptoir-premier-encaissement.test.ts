// #463 — de bout en bout côté serveur : une formule posée depuis Membres
// (/api/members/assign-plan) laisse subscription_status à null ; la lecture
// /api/members/counter-access sert alors un membre que le bloc « À encaisser » retient.
import { fakeSupabase } from '../__fixtures__/fakeSupabase';
import { counterBlocks, needsFirstCashPayment, type CounterAccessMember } from '@/lib/comptoir/counter';

let fake: ReturnType<typeof fakeSupabase>;
const user = { id: 'gerant' };

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => fake.client,
  createClient: async () => fake.client,
  getServerUser: async () => user,
  getActiveBox: async () => ({ id: 'box-1' }),
}));

import { GET as readAccess } from '../../app/api/members/counter-access/route';

const getReq = (boxId: string): any => ({ nextUrl: new URL(`https://x.test/api/members/counter-access?box_id=${boxId}`) });

beforeEach(() => {
  fake = fakeSupabase({
    boxes: [{ id: 'box-1', owner_id: 'gerant', allow_counter_renewal: false, stripe_account_id: null, stripe_onboarding_complete: false }],
    membership_plans: [
      { id: 'p49', box_id: 'box-1', price_cents: 4900, is_active: true, stripe_price_id: null },
      { id: 'p0', box_id: 'box-1', price_cents: 0, is_active: true, stripe_price_id: null },
    ],
    box_members: [
      { id: 'bm-sam', box_id: 'box-1', member_id: 'sam', role: 'member', status: 'active', joined_at: '2026-09-01T10:00:00Z',
        plan_id: 'p49', subscription_status: null, payment_method_type: null, stripe_subscription_id: null, cash_access_until: null },
      { id: 'bm-free', box_id: 'box-1', member_id: 'free', role: 'member', status: 'active', joined_at: '2026-09-02T10:00:00Z',
        plan_id: 'p0', subscription_status: null, payment_method_type: null, stripe_subscription_id: null, cash_access_until: null },
      { id: 'bm-none', box_id: 'box-1', member_id: 'none', role: 'member', status: 'active', joined_at: '2026-09-03T10:00:00Z',
        plan_id: null, subscription_status: null, payment_method_type: null, stripe_subscription_id: null, cash_access_until: null },
      { id: 'bm-web', box_id: 'box-1', member_id: 'web', role: 'member', status: 'active', joined_at: '2026-09-04T10:00:00Z',
        plan_id: 'p49', subscription_status: null, payment_method_type: null, stripe_subscription_id: 'sub_1', cash_access_until: null },
    ],
    box_member_access_notices: [],
    box_cash_payments: [],
    box_invitations: [],
  });
});

it('counter-access sert le prix de la formule et l’absence de Stripe ; seul le membre à formule payante est retenu', async () => {
  const res = (await readAccess(getReq('box-1'))) as any;
  expect(res._status).toBe(200);
  const members = res._data.members as CounterAccessMember[];
  const sam = members.find((m) => m.box_member_id === 'bm-sam')!;
  expect(sam).toMatchObject({ plan_id: 'p49', price_cents: 4900, subscription_status: null, has_stripe_subscription: false });
  expect(members.filter(needsFirstCashPayment).map((m) => m.box_member_id)).toEqual(['bm-sam']);
  expect(counterBlocks(members).toCollect.map((m) => m.box_member_id)).toEqual(['bm-sam']);
});
