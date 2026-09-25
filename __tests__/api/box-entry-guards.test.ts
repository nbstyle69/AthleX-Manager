// Archivage PR 2 : gardes d'entrée des routes du Manager (clé serveur, que la
// règle de la PR 1 laisse passer). Box archivée ou en archivage programmé :
// refus 409 avec le code de la PR 1 et son message, et AUCUN appel Stripe.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.RESEND_API_KEY = 're_dummy';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';

/** Tout appel Stripe, quel qu'il soit, est noté ici. */
const mockStripeCalls: string[] = [];
const mockDeep = (path: string): any => new Proxy(function stripeFn() { /* appelable */ }, {
  get: (_t, k) => (k === 'then' ? undefined : mockDeep(`${path}.${String(k)}`)),
  apply: () => { mockStripeCalls.push(path); return Promise.resolve({ id: 'x', url: 'https://stripe.test/x', data: [] }); },
});
jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockDeep('stripe')) }));

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
  createClient: jest.fn(),
  getActiveBox: jest.fn(),
  getAccessToken: jest.fn(),
}));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/requireBoxOwner', () => ({ requireBoxOwner: jest.fn() }));
jest.mock('@/lib/trialRateLimit', () => ({ clientIp: () => '1.2.3.4', takeToken: () => ({ allowed: true }) }));
const mockAnonRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockAnonRpc, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }), auth: { signUp: jest.fn() } })),
}));

import { createHash } from 'crypto';
import { getServerUser, createServiceClient, createClient, getActiveBox, getAccessToken } from '@/lib/supabase/server';
import { requireBoxOwner } from '@/lib/requireBoxOwner';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';
import { entryRefusalMessage, refusalFor, rpcEntryRefusal } from '@/lib/boxEntryGuard';
import { POST as membershipCheckout } from '../../app/api/create-membership-checkout/route';
import { POST as changePlan } from '../../app/api/change-membership-plan/route';
import { POST as programCheckout } from '../../app/api/create-program-checkout/route';
import { POST as programmingCheckout } from '../../app/api/create-programming-checkout/route';
import { POST as inviteSend } from '../../app/api/invitations/send/route';
import { POST as inviteAccept } from '../../app/api/invitations/accept/route';
import { POST as inviteCode } from '../../app/api/box/invite-code/route';
import { POST as trialBook } from '../../app/api/trial/book/route';
import { POST as trialSlots } from '../../app/api/trial/slots/route';
import { POST as boxCheckout } from '../../app/api/create-checkout/route';
import { POST as portal } from '../../app/api/stripe-portal/route';
import { POST as pause } from '../../app/api/pause-membership/route';

const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body), headers: new Map(), url: 'http://x/api' });

type State = 'open' | 'scheduled' | 'archived';
let db: ReturnType<typeof fakeSupabase>;

function setup(state: State) {
  const col = state === 'archived' ? { archived_at: '2026-09-20T10:00:00Z', archive_scheduled_at: null }
    : state === 'scheduled' ? { archived_at: null, archive_scheduled_at: '2026-09-20T10:00:00Z' }
    : { archived_at: null, archive_scheduled_at: null };
  db = fakeSupabase({
    boxes: [
      { id: 'b1', name: 'Box Test', slug: 'box-test', owner_id: 'owner', stripe_account_id: 'acct_box', stripe_onboarding_complete: true, invite_code: 'OLD', ...col },
      { id: 'b2', name: 'Box Ouverte', owner_id: 'owner', stripe_account_id: 'acct_b2', stripe_onboarding_complete: true, archived_at: null, archive_scheduled_at: null },
    ],
    membership_plans: [
      { id: 'pl1', box_id: 'b1', name: 'Illimité', price_cents: 5000, currency: 'eur', is_active: true, plan_type: 'subscription', stripe_price_id: 'price_1' },
      { id: 'pl2', box_id: 'b1', name: 'Premium', price_cents: 7000, currency: 'eur', is_active: true, stripe_price_id: 'price_2' },
    ],
    box_members: [{ id: 'bm1', box_id: 'b1', member_id: 'user', plan_id: 'pl1', stripe_subscription_id: 'sub_1', subscription_status: 'active' }],
    programs: [{ id: 'pg1', box_id: 'b1', title: 'Force', price_cents: 3000, currency: 'eur', type: 'subscription', is_active: true, stripe_price_id: 'price_p' }],
    box_programming: [
      { id: 'off1', publisher_box_id: 'b2', title: 'Offre', price_cents: 2000, currency: 'eur', billing: 'monthly', is_published: true, stripe_price_id: 'price_o' },
      { id: 'off2', publisher_box_id: 'b1', title: 'Offre de b1', price_cents: 2000, currency: 'eur', billing: 'monthly', is_published: true, stripe_price_id: 'price_o2' },
    ],
    box_programming_subscriptions: [],
    box_invitations: [{ id: 'inv1', box_id: 'b1', email: 'invite@exemple.fr', status: 'pending', token_hash: createHash('sha256').update('jeton-1').digest('hex'), plan_id: null }],
    box_subscriptions: [{ id: 'bs1', box_id: 'b1', stripe_customer_id: 'cus_1', status: 'active', current_period_end: '2026-11-20T10:00:00.000Z' }],
    profiles: [{ id: 'owner', email: 'gerant@exemple.fr' }, { id: 'user', email: 'membre@exemple.fr' }],
  });
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } });
  (getActiveBox as jest.Mock).mockResolvedValue({ id: 'b1' });
  (getAccessToken as jest.Mock).mockResolvedValue('jeton-de-session');
  (requireBoxOwner as jest.Mock).mockResolvedValue({ ok: true, userId: 'owner', service: db.client });
  // Les RPC d'essai (PR 1) refusent elles-mêmes une box fermée.
  const reason = state === 'archived' ? 'box_archivee' : state === 'scheduled' ? 'box_archivage_programme' : null;
  mockAnonRpc.mockResolvedValue(reason
    ? { data: { ok: false, reason, message: "Cette box ne propose plus de séance d'essai." }, error: null }
    : { data: { ok: true, slots: [], slot: { scheduled_date: '2026-10-01', start_time: '09:00:00', title: 'WOD' }, plan: { name: 'Essai' } }, error: null });
}

let fetchSpy: jest.SpyInstance;
afterEach(() => fetchSpy.mockRestore());
beforeEach(() => {
  jest.clearAllMocks();
  mockStripeCalls.length = 0;
  // Aucun e-mail réel (Resend) depuis les tests.
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({}), text: async () => '' } as any);
  (getServerUser as jest.Mock).mockResolvedValue({ id: 'user', email: 'membre@exemple.fr' });
});

const ROUTES: [string, (r: any) => Promise<any>, any, string][] = [
  ['adhésion (checkout)', membershipCheckout, { plan_id: 'pl1' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
  ['changement de formule', changePlan, { new_plan_id: 'pl2' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
  ['achat de programme', programCheckout, { program_id: 'pg1' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
  ['achat d’offre (box acheteuse)', programmingCheckout, { programming_id: 'off1', subscriber_box_id: 'b1' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
  ['achat d’offre (box éditrice)', programmingCheckout, { programming_id: 'off2', subscriber_box_id: 'b2' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
  ['envoi d’invitation', inviteSend, { invitation_id: 'inv1', token: 'jeton-1' }, "Cette box n'accepte plus de nouveaux membres."],
  ['acceptation d’invitation (déjà connecté)', inviteAccept, { token: 'jeton-1', mode: 'existing' }, "Cette box n'accepte plus de nouveaux membres."],
  ['acceptation d’invitation (création de compte)', inviteAccept, { token: 'jeton-1', mode: 'signup', username: 'nouveau', password: 'secret123' }, "Cette box n'accepte plus de nouveaux membres."],
  ['code d’invitation', inviteCode, { invite_code: 'NEW' }, "Cette box n'accepte plus de nouveaux membres."],
  ['essai (réservation)', trialBook, { box_id: 'b1', schedule_id: 's1', first_name: 'Ana', email: 'ana@exemple.fr' }, "Cette box ne propose plus de séance d'essai."],
  ['essai (créneaux)', trialSlots, { box_id: 'b1' }, "Cette box ne propose plus de séance d'essai."],
  ['réabonnement de la box', boxCheckout, { box_id: 'b1' }, ''],
  ['portail Stripe', portal, { box_id: 'b1' }, ''],
  ['reprise d’une pause', pause, { box_member_id: 'bm1', action: 'resume' }, "Cette box n'accepte plus de nouvel abonnement ni d'achat."],
];

describe.each(['scheduled', 'archived'] as const)('box %s', (state) => {
  it.each(ROUTES)('%s : 409, code de la PR 1, aucun appel Stripe', async (_n, route, body, message) => {
    setup(state);
    const res = await route(req(body));
    expect(res._status).toBe(409);
    expect(res._data.code).toBe(state === 'archived' ? 'BOX_ARCHIVEE' : 'BOX_ARCHIVAGE_PROGRAMME');
    if (message) expect(res._data.error).toBe(message);
    expect(mockStripeCalls).toEqual([]);
    // Rien d'écrit en base par la route.
    expect(db.writes).toEqual([]);
  });
});

describe('box ouverte : la garde laisse passer', () => {
  it.each(ROUTES)('%s', async (_n, route, body) => {
    setup('open');
    const res = await route(req(body));
    expect(res._data?.code).toBeUndefined();
  });
});

describe('portail et réabonnement de la box : la date de fin est dite', () => {
  it('archivage programmé : « L’abonnement de cette box s’arrête le … »', async () => {
    setup('scheduled');
    const res: any = await portal(req({ box_id: 'b1' }));
    expect(res._data.error).toBe("L'abonnement de cette box s'arrête le vendredi 20 novembre 2026 : il ne peut plus être modifié.");
    const res2: any = await boxCheckout(req({ box_id: 'b1' }));
    expect(res2._data.error).toBe(res._data.error);
  });
  it('box archivée : refus sans date', async () => {
    setup('archived');
    const res: any = await portal(req({ box_id: 'b1' }));
    expect(res._data.error).toBe('Cette box est archivée : son abonnement ne peut plus être modifié.');
    expect(mockStripeCalls).toEqual([]);
  });
});

describe('pause : seule la reprise est refusée', () => {
  it('mettre en pause reste possible sur une box programmée', async () => {
    setup('scheduled');
    const res: any = await pause(req({ box_member_id: 'bm1', action: 'pause' }));
    expect(res._data?.code).toBeUndefined();
    expect(mockStripeCalls).toEqual(['stripe.subscriptions.update']);
  });
});

describe('messages et codes : identiques à la base (PR 1)', () => {
  it('un texte par contexte, au caractère près', () => {
    expect(entryRefusalMessage('BOX_ARCHIVAGE_PROGRAMME', 'adhesion')).toBe("Cette box n'accepte plus de nouveaux membres.");
    expect(entryRefusalMessage('BOX_ARCHIVAGE_PROGRAMME', 'essai')).toBe("Cette box ne propose plus de séance d'essai.");
    expect(entryRefusalMessage('BOX_ARCHIVAGE_PROGRAMME', 'achat')).toBe("Cette box n'accepte plus de nouvel abonnement ni d'achat.");
    expect(entryRefusalMessage('BOX_ARCHIVEE', 'comptoir')).toBe('Cette box est archivée : les ventes au comptoir sont fermées.');
    expect(entryRefusalMessage('BOX_ARCHIVAGE_PROGRAMME', 'comptoir')).toBe("Cette box est en cours d'archivage : les ventes au comptoir sont fermées.");
  });
  it('archivée l’emporte sur programmée ; ouverte ou introuvable : pas de refus', () => {
    expect(refusalFor({ archived_at: 'x', archive_scheduled_at: 'y' }, 'achat')?.code).toBe('BOX_ARCHIVEE');
    expect(refusalFor({ archived_at: null, archive_scheduled_at: 'y' }, 'achat')?.code).toBe('BOX_ARCHIVAGE_PROGRAMME');
    expect(refusalFor({ archived_at: null, archive_scheduled_at: null }, 'achat')).toBeNull();
    expect(refusalFor(null, 'achat')).toBeNull();
  });
  it('refus d’une RPC : seules les deux raisons d’archivage deviennent un 409', () => {
    expect(rpcEntryRefusal({ ok: false, reason: 'creneau_complet' })).toBeNull();
    expect(rpcEntryRefusal({ ok: true })).toBeNull();
    const r: any = rpcEntryRefusal({ ok: false, reason: 'box_archivee', message: 'm' });
    expect([r._status, r._data.code, r._data.error]).toEqual([409, 'BOX_ARCHIVEE', 'm']);
  });
});
