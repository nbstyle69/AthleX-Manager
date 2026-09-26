// Tests de app/api/members/stop-subscription/route.ts (S2 : arrêt d'un
// abonnement de salle par le gérant, option A — aucun remboursement).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.RESEND_API_KEY = 're_dummy';

const mockSubUpdate = jest.fn();
const mockSubCancel = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    subscriptions: { update: mockSubUpdate, cancel: mockSubCancel },
  })),
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn() }));

import { POST } from '../../app/api/members/stop-subscription/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { withPushEnv, pushesOf, failPush } from '../__fixtures__/pushEnv';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateService = createServiceClient as jest.Mock;
const mockIsOwnerAdmin = isBoxOwnerAdmin as jest.Mock;

interface ChainCfg { maybeSingle?: any; single?: any; awaited?: any }

function makeChain(cfg: ChainCfg = {}) {
  const awaited = cfg.awaited ?? { data: null, error: null };
  const c: any = {};
  const ret = () => c;
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'order'].forEach(m => (c[m] = jest.fn(ret)));
  c.maybeSingle = jest.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null });
  c.single = jest.fn().mockResolvedValue(cfg.single ?? { data: null, error: null });
  c.then = (r: any) => Promise.resolve(awaited).then(r);
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((t: string) => (chains[t] ??= makeChain()));

function makeReq(body: any): any {
  return { json: jest.fn().mockResolvedValue(body) };
}

const MEMBER = {
  id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', plan_id: 'plan-1', status: 'active',
  stripe_subscription_id: 'sub_1', subscription_status: 'active',
  subscription_cancel_at_period_end: false,
  subscription_current_period_end: '2026-10-12T10:00:00Z',
};

function setup(member: any = MEMBER) {
  chains = {};
  chains.box_members = makeChain({ maybeSingle: { data: member }, awaited: { data: null, error: null } });
  chains.boxes = makeChain({ single: { data: { name: 'AthleX Fitness', stripe_account_id: 'acct_1', contact_email: 'salle@exemple.fr' } } });
  chains.membership_plans = makeChain({ maybeSingle: { data: { name: 'Illimité' } } });
  chains.profiles = makeChain({ maybeSingle: { data: { email: 'membre@exemple.fr', username: 'cam', full_name: 'Camille Dupont' } } });
  chains.box_member_subscription_actions = makeChain({ maybeSingle: { data: { id: 'act-1' } } });
  mockCreateService.mockReturnValue({ from: fromSpy });
  mockGetServerUser.mockResolvedValue({ id: 'owner-1' });
  mockIsOwnerAdmin.mockResolvedValue(true);
}

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  setup();
  mockSubUpdate.mockResolvedValue({ id: 'sub_1', status: 'active' });
  mockSubCancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' });
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, text: async () => '' } as any);
});

afterEach(() => fetchSpy.mockRestore());

const journalInsert = () => chains.box_member_subscription_actions.insert;

describe('POST /api/members/stop-subscription — accès', () => {
  it('401 sans session', async () => {
    mockGetServerUser.mockResolvedValue(null);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._status).toBe(401);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCancel).not.toHaveBeenCalled();
  });

  it('400 pour un mode inconnu', async () => {
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'refund' }));
    expect(res._status).toBe(400);
  });

  it('404 membre introuvable', async () => {
    chains.box_members = makeChain({ maybeSingle: { data: null } });
    const res: any = await POST(makeReq({ box_member_id: 'bm-x', mode: 'now' }));
    expect(res._status).toBe(404);
  });

  it('403 pour un coach, un membre ou l’owner d’une autre box (garde is_box_owner_admin)', async () => {
    mockIsOwnerAdmin.mockResolvedValue(false);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._status).toBe(403);
    // La garde est bien interrogée pour CET utilisateur et LA box du membre.
    expect(mockIsOwnerAdmin).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'box-1');
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(journalInsert()).not.toHaveBeenCalled();
  });
});

describe('membre prélevé par Stripe', () => {
  it('period_end : appel Stripe exact, clé d’idempotence, écritures de la route d’approbation, journal', async () => {
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(res._status ?? 200).toBe(200);
    expect(res._data).toMatchObject({ ok: true, mode: 'period_end' });
    expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    expect(mockSubUpdate).toHaveBeenCalledWith(
      'sub_1',
      { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-1:sub_1:period_end' },
    );
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(chains.box_members.update).toHaveBeenCalledWith({
      subscription_cancel_at_period_end: true, commitment_end_date: null,
    });
    expect(chains.box_members.eq).toHaveBeenCalledWith('id', 'bm-1');
    expect(journalInsert()).toHaveBeenCalledWith({
      box_id: 'box-1', box_member_id: 'bm-1', member_id: 'ath-1',
      action: 'stop', mode: 'period_end', stripe_subscription_id: 'sub_1',
      refund_cents: 0, actor_id: 'owner-1',
    });
  });

  it('now : annulation immédiate sans prorata, écritures du webhook deleted, adhésion inactive', async () => {
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._data).toMatchObject({ ok: true, mode: 'now' });
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
    expect(mockSubCancel).toHaveBeenCalledWith(
      'sub_1',
      { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-1:sub_1:now' },
    );
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(chains.box_members.update).toHaveBeenCalledWith({
      subscription_status: 'cancelled', plan_id: null,
      subscription_cancel_at_period_end: false,
      commitment_end_date: null, subscription_paused: false,
      pause_started_at: null, pause_resumes_at: null,
    });
    expect(chains.box_members.update).toHaveBeenCalledWith({ status: 'inactive' });
    expect(chains.box_members.eq).toHaveBeenCalledWith('status', 'active');
    expect(journalInsert()).toHaveBeenCalledWith(expect.objectContaining({ mode: 'now', refund_cents: 0 }));
  });

  it('impayé : period_end refusé (409), seul l’arrêt immédiat passe', async () => {
    setup({ ...MEMBER, subscription_status: 'past_due' });
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(res._status).toBe(409);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(journalInsert()).not.toHaveBeenCalled();

    const res2: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res2._data).toMatchObject({ ok: true, mode: 'now' });
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
  });

  it('état déjà atteint : 200 sans second appel Stripe ni nouvelle ligne de journal', async () => {
    setup({ ...MEMBER, subscription_cancel_at_period_end: true });
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(res._data).toMatchObject({ ok: true, already: true });
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(journalInsert()).not.toHaveBeenCalled();

    setup({ ...MEMBER, subscription_status: 'cancelled' });
    const res2: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res2._data).toMatchObject({ ok: true, already: true });
    expect(mockSubCancel).not.toHaveBeenCalled();
  });
});

describe('membre au comptoir (sans abonnement Stripe)', () => {
  const CASH = { ...MEMBER, stripe_subscription_id: null };

  it('now : aucun appel Stripe, mêmes écritures en base, journal sans identifiant Stripe', async () => {
    setup(CASH);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._data).toMatchObject({ ok: true, mode: 'now' });
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(chains.box_members.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'cancelled' }));
    expect(chains.box_members.update).toHaveBeenCalledWith({ status: 'inactive' });
    expect(journalInsert()).toHaveBeenCalledWith(expect.objectContaining({ stripe_subscription_id: null, refund_cents: 0 }));
    // Aucun encaissement comptoir touché.
    expect(chains.box_cash_payments).toBeUndefined();
  });

  it('period_end refusé : pas de période Stripe à attendre', async () => {
    setup(CASH);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(res._status).toBe(409);
    expect(journalInsert()).not.toHaveBeenCalled();
  });
});

describe('e-mail au membre (Resend)', () => {
  it('envoi réussi : notified_at renseigné sur la ligne de journal', async () => {
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(fetchSpy).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.to).toBe('membre@exemple.fr');
    expect(body.reply_to).toBe('salle@exemple.fr');
    expect(body.subject).toContain('prendra fin le');
    expect(body.html).toContain('Camille');
    expect(body.html).toContain('Illimité');
    expect(chains.box_member_subscription_actions.update).toHaveBeenCalledWith({ notified_at: expect.any(String) });
    expect(chains.box_member_subscription_actions.eq).toHaveBeenCalledWith('id', 'act-1');
  });

  it('arrêt immédiat : objet et corps de l’e-mail « immédiat »', async () => {
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.subject).toBe('Ton abonnement à AthleX Fitness est arrêté');
    expect(body.html).toContain('Tes réservations à venir ont été annulées');
  });

  it('échec de l’envoi : l’arrêt reste valide, notified_at vide, avertissement renvoyé', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, text: async () => '' } as any);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._data.ok).toBe(true);
    expect(res._data.warning).toContain('e-mail');
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
    expect(journalInsert()).toHaveBeenCalled();
    expect(chains.box_member_subscription_actions.update).not.toHaveBeenCalled();
  });

  it('membre sans e-mail : avertissement, arrêt conservé', async () => {
    chains.profiles = makeChain({ maybeSingle: { data: { email: null, username: 'cam', full_name: null } } });
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._data.ok).toBe(true);
    expect(res._data.warning).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('push au membre (membership_stopped)', () => {
  withPushEnv();

  it('fin de période : un push, chemin serveur, texte « fin programmée » FR / EN avec la date', async () => {
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(pushesOf(fetchSpy)).toEqual([{
      secret: 'cron_test', user_id: 'ath-1',
      title: "Fin d'abonnement programmée",
      body: 'AthleX Fitness a programmé la fin de ton abonnement le lundi 12 octobre 2026.',
      en: { title: 'Membership ending', body: 'AthleX Fitness has scheduled your membership to end on Monday, 12 October 2026.' },
      data: { type: 'membership_stopped', box_id: 'box-1' },
    }]);
  });

  it('immédiat : un push « arrêté aujourd’hui »', async () => {
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    const p = pushesOf(fetchSpy);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ title: 'Abonnement arrêté', en: { title: 'Membership stopped' } });
  });

  it('push parti après le journal et l’e-mail', async () => {
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    const urls = fetchSpy.mock.calls.map(c => String(c[0]));
    expect(urls.findIndex(u => u.includes('resend'))).toBeLessThan(urls.findIndex(u => u.endsWith('/send-push')));
    expect(journalInsert().mock.invocationCallOrder[0]).toBeLessThan(fetchSpy.mock.invocationCallOrder[urls.findIndex(u => u.endsWith('/send-push'))]);
  });

  it('push en échec : l’arrêt, le journal et l’e-mail tiennent', async () => {
    failPush(fetchSpy);
    const res: any = await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(res._data).toEqual({ ok: true, mode: 'now' });
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
    expect(journalInsert()).toHaveBeenCalled();
    expect(chains.box_member_subscription_actions.update).toHaveBeenCalledWith({ notified_at: expect.any(String) });
  });

  it('membre sans e-mail : le push part quand même', async () => {
    chains.profiles = makeChain({ maybeSingle: { data: { email: null, username: 'cam', full_name: null } } });
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'now' }));
    expect(pushesOf(fetchSpy)).toHaveLength(1);
  });

  it('état déjà atteint (relance du bouton) : aucun second push', async () => {
    setup({ ...MEMBER, subscription_cancel_at_period_end: true });
    await POST(makeReq({ box_member_id: 'bm-1', mode: 'period_end' }));
    expect(pushesOf(fetchSpy)).toEqual([]);
  });
});
