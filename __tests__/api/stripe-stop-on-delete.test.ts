// S4 — suppressions qui laissaient Stripe prélever : formule (B5), programme
// (B10), offre (B11), code promo (B6), bannissement, réponse à une demande de
// résiliation. Stripe et Resend simulés.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.RESEND_API_KEY = 're_dummy';

const mockSubUpdate = jest.fn();
const mockSubCancel = jest.fn();
const mockSubRetrieve = jest.fn();
const mockCouponDel = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    subscriptions: { update: mockSubUpdate, cancel: mockSubCancel, retrieve: mockSubRetrieve },
    coupons: { del: mockCouponDel },
  })),
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn() }));

import { POST as plansDelete } from '../../app/api/membership-plans/delete/route';
import { POST as programsDelete } from '../../app/api/programs/delete/route';
import { POST as offersDelete } from '../../app/api/marketplace/offers/delete/route';
import { POST as ban } from '../../app/api/members/ban/route';
import { POST as review } from '../../app/api/cancellation-request/review/route';
import { DELETE as promoDelete } from '../../app/api/promo-codes/[id]/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

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
  c.then = (r: any, j: any) => Promise.resolve(awaited).then(r, j);
  return c;
}

let chains: Record<string, any>;
const fromSpy = jest.fn((t: string) => (chains[t] ??= makeChain()));
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

const BOX = { name: 'AthleX Fitness', stripe_account_id: 'acct_1', contact_email: 'salle@exemple.fr' };

let fetchSpy: jest.SpyInstance;
const emails = () => fetchSpy.mock.calls
  .filter(c => String(c[0]).includes('resend'))
  .map(c => JSON.parse(c[1].body));

beforeEach(() => {
  jest.clearAllMocks();
  chains = {};
  chains.boxes = makeChain({ single: { data: BOX } });
  chains.box_member_subscription_actions = makeChain({ maybeSingle: { data: { id: 'act-1' } } });
  mockCreateService.mockReturnValue({ from: fromSpy });
  mockGetServerUser.mockResolvedValue({ id: 'owner-1' });
  mockIsOwnerAdmin.mockResolvedValue(true);
  mockSubUpdate.mockImplementation(async (id: string) => ({ id, cancel_at_period_end: true }));
  mockSubCancel.mockImplementation(async (id: string) => ({ id, status: 'canceled' }));
  mockSubRetrieve.mockImplementation(async (id: string) => ({ id, status: 'active', cancel_at_period_end: false, current_period_end: 1791849600 }));
  mockCouponDel.mockResolvedValue({ deleted: true });
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, text: async () => '' } as any);
});
afterEach(() => fetchSpy.mockRestore());

/* ───────────────────────────── B5 : formule ───────────────────────────── */

const bm = (i: number, extra: any = {}) => ({
  id: `bm-${i}`, box_id: 'box-1', member_id: `ath-${i}`, stripe_subscription_id: `sub_${i}`,
  subscription_status: 'active', subscription_cancel_at_period_end: false,
  subscription_current_period_end: '2026-10-12T10:00:00Z', ...extra,
});

function setupPlan(subs: any[]) {
  chains.membership_plans = makeChain({ maybeSingle: { data: { id: 'plan-1', box_id: 'box-1', name: 'Illimité' } } });
  chains.box_members = makeChain({ awaited: { data: subs, error: null } });
  chains.profiles = makeChain({
    awaited: { data: subs.map((s, i) => ({ id: s.member_id, email: `m${i}@exemple.fr`, username: `membre${i + 1}`, full_name: `Prénom${i + 1} Nom` })), error: null },
  });
}

describe('B5 — suppression d’une formule', () => {
  it('403 sans être gérant de la box de la formule', async () => {
    setupPlan([bm(1)]);
    mockIsOwnerAdmin.mockResolvedValue(false);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._status).toBe(403);
    expect(mockIsOwnerAdmin).toHaveBeenCalledWith(expect.anything(), 'owner-1', 'box-1');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('check : nombre exact des abonnements Stripe actifs ou en impayé (le comptoir ne compte pas), impayés et engagés', async () => {
    setupPlan([
      bm(1, { commitment_end_date: '2099-01-01' }), bm(2, { subscription_status: 'past_due' }),
      bm(3, { stripe_subscription_id: null }), bm(4, { commitment_end_date: '2020-01-01' }),
    ]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'check' }));
    expect(res._data).toEqual({ ok: true, active_subscriptions: 3, past_due: 1, engaged: 1 });
    expect(chains.box_members.in).toHaveBeenCalledWith('subscription_status', ['active', 'trialing', 'past_due']);
    expect(chains.membership_plans.delete).not.toHaveBeenCalled();
  });

  it('delete refusée avec abonnements actifs : 409 et le nombre, rien supprimé, aucun appel Stripe', async () => {
    setupPlan([bm(1), bm(2)]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'delete' }));
    expect(res._status).toBe(409);
    expect(res._data.active_subscriptions).toBe(2);
    expect(chains.membership_plans.delete).not.toHaveBeenCalled();
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('delete sans abonnement : suppression comme aujourd’hui', async () => {
    setupPlan([]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'delete' }));
    expect(res._data).toEqual({ ok: true, deleted: true });
    expect(chains.membership_plans.delete).toHaveBeenCalledTimes(1);
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('arrêter puis supprimer, un abonnement : period_end idempotent, journal (acteur = gérant), e-mail, suppression', async () => {
    setupPlan([bm(1)]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._data).toMatchObject({ ok: true, deleted: true, stopped: 1 });
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-1:sub_1:period_end' });
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({
      box_member_id: 'bm-1', mode: 'period_end', actor_id: 'owner-1', refund_cents: 0,
    }));
    const mails = emails();
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe('Ton abonnement à AthleX Fitness prendra fin le lundi 12 octobre 2026');
    expect(mails[0].reply_to).toBe('salle@exemple.fr');
    expect(chains.membership_plans.delete).toHaveBeenCalledTimes(1);
  });

  it('arrêter puis supprimer, plusieurs abonnements : un arrêt, une ligne et un e-mail par membre', async () => {
    setupPlan([bm(1), bm(2), bm(3)]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._data).toMatchObject({ ok: true, deleted: true, stopped: 3 });
    expect(mockSubUpdate).toHaveBeenCalledTimes(3);
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledTimes(3);
    expect(emails()).toHaveLength(3);
    expect(chains.membership_plans.delete).toHaveBeenCalledTimes(1);
  });

  it('échec partiel : rien supprimé, arrêts réussis journalisés, la réponse nomme ceux qui ont échoué', async () => {
    setupPlan([bm(1), bm(2), bm(3)]);
    mockSubUpdate.mockImplementation(async (id: string) => {
      if (id === 'sub_2') throw new Error('Stripe down');
      return { id };
    });
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._status).toBe(502);
    expect(res._data.failed).toEqual(['membre2']);
    expect(res._data.stopped).toBe(2);
    expect(res._data.error).toContain('membre2');
    expect(chains.membership_plans.delete).not.toHaveBeenCalled();
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledTimes(2);
  });

  it('relance après échec partiel : un abonnement déjà programmé n’est ni rappelé ni re-prévenu', async () => {
    setupPlan([bm(1, { subscription_cancel_at_period_end: true }), bm(2)]);
    await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_2', expect.anything(), expect.anything());
    expect(emails()).toHaveLength(1);
  });
});

describe('B5 — impayé dans « Arrêter puis supprimer »', () => {
  it('un impayé est arrêté en now (clé :now, e-mail « arrêté »), les autres en period_end', async () => {
    setupPlan([bm(1), bm(2, { subscription_status: 'past_due' })]);
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._data).toMatchObject({ ok: true, deleted: true });
    expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true }, expect.objectContaining({ idempotencyKey: 'stop:bm-1:sub_1:period_end' }));
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
    expect(mockSubCancel).toHaveBeenCalledWith('sub_2', { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-2:sub_2:now' });
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({ box_member_id: 'bm-2', mode: 'now', refund_cents: 0 }));
    expect(emails().map(m => m.subject)).toEqual([
      'Ton abonnement à AthleX Fitness prendra fin le lundi 12 octobre 2026',
      'Ton abonnement à AthleX Fitness est arrêté',
    ]);
  });

  it('un impayé déjà marqué « fin de période » est quand même arrêté tout de suite', async () => {
    setupPlan([bm(1, { subscription_status: 'past_due', subscription_cancel_at_period_end: true })]);
    await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(mockSubCancel).toHaveBeenCalledTimes(1);
  });

  it('message d’échec au singulier', async () => {
    setupPlan([bm(1), bm(2)]);
    mockSubUpdate.mockImplementation(async (id: string) => { if (id === 'sub_2') throw new Error('x'); return { id }; });
    const res: any = await plansDelete(req({ plan_id: 'plan-1', action: 'stop_then_delete' }));
    expect(res._data.error).toMatch(/^Stripe a refusé l’arrêt de 1 abonnement : membre2\./);
  });
});

/* ──────────────────────────── B10 : programme ─────────────────────────── */

function setupProgram(buyers: any[], members: any[] = []) {
  chains.programs = makeChain({ maybeSingle: { data: { id: 'prog-1', box_id: 'box-1', title: 'Force 12 semaines' } } });
  chains.program_members = makeChain({ awaited: { data: buyers, error: null } });
  chains.profiles = makeChain({ awaited: { data: buyers.map((b, i) => ({ id: b.user_id, email: `a${i}@exemple.fr`, username: `acheteur${i + 1}`, full_name: null })), error: null } });
  chains.box_members = makeChain({ awaited: { data: members, error: null } });
}
const buyer = (i: number) => ({ id: `pm-${i}`, user_id: `u-${i}`, stripe_subscription_id: `sub_p${i}`, status: 'active' });
const stripeState = (map: Record<string, any>) => mockSubRetrieve.mockImplementation(async (id: string) => ({
  id, status: 'active', cancel_at_period_end: false, current_period_end: 1791849600, ...(map[id] ?? {}),
}));

describe('B10 — programme payant : refus, puis « Arrêter et désactiver »', () => {
  it('check : nombre total, à arrêter, impayés (lus chez Stripe), fin la plus tardive', async () => {
    setupProgram([buyer(1), buyer(2), buyer(3), { ...buyer(4), stripe_subscription_id: null }]);
    stripeState({ sub_p2: { status: 'past_due' }, sub_p3: { cancel_at_period_end: true } });
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'check' }));
    expect(res._data).toEqual({ ok: true, active_subscriptions: 3, to_stop: 2, past_due: 1, last_end: '2026-10-13T00:00:00.000Z' });
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(chains.programs.update).not.toHaveBeenCalled();
  });

  it('delete refusée avec abonnements actifs : 409 et le nombre exact', async () => {
    setupProgram([buyer(1), buyer(2), { ...buyer(3), stripe_subscription_id: null }]);
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'delete' }));
    expect(res._status).toBe(409);
    expect(res._data.active_subscriptions).toBe(2);
    expect(res._data.error).toMatch(/^2 abonnements Stripe sont encore actifs/);
    expect(chains.programs.delete).not.toHaveBeenCalled();
  });

  it('delete possible quand le dernier abonnement est terminé', async () => {
    setupProgram([]);
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'delete' }));
    expect(res._data).toEqual({ ok: true, deleted: true });
    expect(chains.programs.delete).toHaveBeenCalledTimes(1);
  });

  it('l’ancienne action stop_then_delete est refusée', async () => {
    setupProgram([buyer(1)]);
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'stop_then_delete' }));
    expect(res._status).toBe(400);
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('arrêter et désactiver : period_end idempotent, journal pour l’acheteur membre, e-mail « accès jusqu’au », programme désactivé et PAS supprimé', async () => {
    setupProgram([buyer(1), buyer(2)], [{ id: 'bm-u1', member_id: 'u-1' }]);
    stripeState({});
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'stop_then_deactivate' }));
    expect(res._data).toMatchObject({ ok: true, deactivated: true, stopped: 2 });
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_p1', { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:program:pm-1:sub_p1:period_end' });
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledTimes(1);
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({ box_member_id: 'bm-u1', mode: 'period_end', actor_id: 'owner-1' }));
    const mails = emails();
    expect(mails).toHaveLength(2);
    expect(mails[0].subject).toBe('AthleX Fitness a retiré le programme Force 12 semaines');
    expect(mails[0].html).toContain("tu gardes l'accès jusqu'au mardi 13 octobre 2026");
    expect(mails[0].html).not.toContain('s\'arrête aujourd\'hui');
    expect(chains.programs.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    expect(chains.programs.delete).not.toHaveBeenCalled();
  });

  it('impayé (lu chez Stripe) : arrêt now, clé :now, e-mail « arrêté », journal now', async () => {
    setupProgram([buyer(1)], [{ id: 'bm-u1', member_id: 'u-1' }]);
    stripeState({ sub_p1: { status: 'past_due' } });
    await programsDelete(req({ program_id: 'prog-1', action: 'stop_then_deactivate' }));
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCancel).toHaveBeenCalledWith('sub_p1', { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:program:pm-1:sub_p1:now' });
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({ mode: 'now' }));
    expect(emails()[0].subject).toBe('Ton abonnement au programme Force 12 semaines est arrêté');
  });

  it('échec partiel : rien désactivé, le message nomme l’échec', async () => {
    setupProgram([buyer(1), buyer(2)]);
    stripeState({});
    mockSubUpdate.mockImplementation(async (id: string) => { if (id === 'sub_p1') throw new Error('x'); return { id }; });
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'stop_then_deactivate' }));
    expect(res._status).toBe(502);
    expect(res._data.failed).toEqual(['acheteur1']);
    expect(res._data.stopped).toBe(1);
    expect(res._data.error).toContain('Le programme n’a pas été désactivé');
    expect(chains.programs.update).not.toHaveBeenCalled();
    expect(chains.programs.delete).not.toHaveBeenCalled();
  });

  it('relance : un abonnement déjà en voie d’arrêt chez Stripe n’est ni rappelé ni re-prévenu', async () => {
    setupProgram([buyer(1)]);
    stripeState({ sub_p1: { cancel_at_period_end: true } });
    const res: any = await programsDelete(req({ program_id: 'prog-1', action: 'stop_then_deactivate' }));
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
    expect(res._data).toMatchObject({ ok: true, deactivated: true, stopped: 0 });
  });
});

/* ────────────────────────── B11 : offre Marketplace ───────────────────── */

function setupOffer(subs: any[]) {
  chains.box_programming = makeChain({ maybeSingle: { data: { id: 'off-1', publisher_box_id: 'box-1', title: 'Engine' } } });
  chains.box_programming_subscriptions = makeChain({ awaited: { data: subs, error: null } });
  chains.boxes = makeChain({
    single: { data: BOX },
    awaited: { data: subs.map((s, i) => ({ id: s.subscriber_box_id, name: `Box ${i + 1}`, owner_id: `own-${i}` })), error: null },
  });
  chains.profiles = makeChain({ awaited: { data: subs.map((_s, i) => ({ id: `own-${i}`, email: `g${i}@exemple.fr`, username: `g${i}`, full_name: null })), error: null } });
}
const osub = (i: number, extra: any = {}) => ({ id: `bps-${i}`, subscriber_box_id: `sb-${i}`, stripe_subscription_id: `sub_o${i}`, status: 'active', ...extra });

describe('B11 — offre Marketplace : refus, puis « Arrêter et désactiver »', () => {
  it('check puis delete refusée : nombre exact, impayé compté, rien supprimé', async () => {
    setupOffer([osub(1), osub(2, { status: 'past_due' })]);
    stripeState({ sub_o2: { status: 'past_due' } });
    const chk: any = await offersDelete(req({ programming_id: 'off-1', action: 'check' }));
    expect(chk._data).toMatchObject({ active_subscriptions: 2, to_stop: 2, past_due: 1 });
    expect(chains.box_programming_subscriptions.in).toHaveBeenCalledWith('status', ['active', 'past_due']);
    const res: any = await offersDelete(req({ programming_id: 'off-1', action: 'delete' }));
    expect(res._status).toBe(409);
    expect(chains.box_programming.delete).not.toHaveBeenCalled();
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('arrêter et désactiver : period_end idempotent, e-mail « reçoit ses semaines jusqu’au », offre dépubliée et PAS supprimée', async () => {
    setupOffer([osub(1)]);
    stripeState({});
    const res: any = await offersDelete(req({ programming_id: 'off-1', action: 'stop_then_deactivate' }));
    expect(res._data).toMatchObject({ ok: true, deactivated: true });
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_o1', { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:programming:bps-1:sub_o1:period_end' });
    const [mail] = emails();
    expect(mail.to).toBe('g0@exemple.fr');
    expect(mail.html).toContain("Box 1 reçoit ses semaines jusqu'au mardi 13 octobre 2026");
    expect(chains.box_programming.update).toHaveBeenCalledWith(expect.objectContaining({ is_published: false }));
    expect(chains.box_programming.delete).not.toHaveBeenCalled();
  });

  it('impayé : arrêt now, clé :now', async () => {
    setupOffer([osub(1, { status: 'past_due' })]);
    stripeState({ sub_o1: { status: 'past_due' } });
    await offersDelete(req({ programming_id: 'off-1', action: 'stop_then_deactivate' }));
    expect(mockSubCancel).toHaveBeenCalledWith('sub_o1', { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:programming:bps-1:sub_o1:now' });
    expect(emails()[0].subject).toBe('L’abonnement de Box 1 à l’offre Engine est arrêté');
  });

  it('échec partiel : offre ni dépubliée ni supprimée', async () => {
    setupOffer([osub(1), osub(2)]);
    stripeState({});
    mockSubUpdate.mockImplementation(async (id: string) => { if (id === 'sub_o2') throw new Error('x'); return { id }; });
    const res: any = await offersDelete(req({ programming_id: 'off-1', action: 'stop_then_deactivate' }));
    expect(res._status).toBe(502);
    expect(res._data.failed).toEqual(['Box 2']);
    expect(chains.box_programming.update).not.toHaveBeenCalled();
    expect(chains.box_programming.delete).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────── B6 : code promo ────────────────────────── */

describe('B6 — suppression d’un code promo', () => {
  const setupPromo = () => {
    chains.membership_promo_codes = makeChain({
      maybeSingle: { data: { id: 'pc-1', box_id: 'box-1', is_active: true, stripe_coupon_id: 'co_1', stripe_promotion_code_id: 'promo_1' } },
    });
  };
  const call = () => promoDelete({} as any, { params: Promise.resolve({ id: 'pc-1' }) });

  it('échec Stripe : 502 avec le message, rien supprimé en base', async () => {
    setupPromo();
    mockCouponDel.mockRejectedValue(Object.assign(new Error('Stripe indisponible.'), { code: 'api_error' }));
    const res: any = await call();
    expect(res._status).toBe(502);
    expect(res._data.error).toBe('Stripe n’a pas pu désactiver le code : Stripe indisponible. Rien n’a été supprimé.');
    expect(chains.membership_promo_codes.delete).not.toHaveBeenCalled();
  });

  it('succès : coupon supprimé chez Stripe puis ligne supprimée', async () => {
    setupPromo();
    const res: any = await call();
    expect(res._data).toEqual({ ok: true });
    expect(mockCouponDel).toHaveBeenCalledWith('co_1', { stripeAccount: 'acct_1' });
    expect(chains.membership_promo_codes.delete).toHaveBeenCalledTimes(1);
  });

  it('coupon déjà absent chez Stripe (resource_missing) : vaut succès', async () => {
    setupPromo();
    mockCouponDel.mockRejectedValue(Object.assign(new Error('No such coupon'), { code: 'resource_missing' }));
    const res: any = await call();
    expect(res._data).toEqual({ ok: true });
    expect(chains.membership_promo_codes.delete).toHaveBeenCalledTimes(1);
  });
});

/* ────────────────────────────── Bannissement ──────────────────────────── */

describe('bannissement', () => {
  const setupBan = (member: any) => {
    chains.box_members = makeChain({ maybeSingle: { data: member } });
    chains.membership_plans = makeChain({ maybeSingle: { data: { name: 'Illimité' } } });
    chains.profiles = makeChain({ maybeSingle: { data: { email: 'membre@exemple.fr', username: 'cam', full_name: 'Camille Dupont' } } });
  };
  const MEMBER = {
    id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', plan_id: 'plan-1', status: 'active',
    stripe_subscription_id: 'sub_1', subscription_status: 'active', subscription_current_period_end: '2026-10-12T10:00:00Z',
  };

  it('403 hors gérant : ni arrêt ni bannissement', async () => {
    setupBan(MEMBER);
    mockIsOwnerAdmin.mockResolvedValue(false);
    const res: any = await ban(req({ box_id: 'box-1', member_id: 'ath-1' }));
    expect(res._status).toBe(403);
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(chains.box_members.update).not.toHaveBeenCalled();
  });

  it('Stripe : arrêt immédiat sans remboursement, journal now, e-mail « arrêté », puis banni', async () => {
    setupBan(MEMBER);
    const res: any = await ban(req({ box_id: 'box-1', member_id: 'ath-1' }));
    expect(res._data).toMatchObject({ ok: true, stopped: true });
    expect(mockSubCancel).toHaveBeenCalledWith('sub_1', { prorate: false, invoice_now: false },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-1:sub_1:now' });
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({ mode: 'now', refund_cents: 0, actor_id: 'owner-1' }));
    expect(emails()[0].subject).toBe('Ton abonnement à AthleX Fitness est arrêté');
    expect(chains.box_members.update).toHaveBeenLastCalledWith({ status: 'banned' });
  });

  it('Stripe refuse : rien n’est écrit, pas de bannissement', async () => {
    setupBan(MEMBER);
    mockSubCancel.mockRejectedValue(new Error('refus'));
    const res: any = await ban(req({ box_id: 'box-1', member_id: 'ath-1' }));
    expect(res._status).toBe(500);
    expect(chains.box_members.update).not.toHaveBeenCalled();
    expect(chains.box_member_subscription_actions.insert).not.toHaveBeenCalled();
  });

  it('comptoir : mêmes écritures que l’arrêt immédiat, aucun appel Stripe', async () => {
    setupBan({ ...MEMBER, stripe_subscription_id: null });
    const res: any = await ban(req({ box_id: 'box-1', member_id: 'ath-1' }));
    expect(res._data).toMatchObject({ ok: true, stopped: true });
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(chains.box_members.update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'cancelled', plan_id: null }));
    expect(chains.box_member_subscription_actions.insert).toHaveBeenCalledWith(expect.objectContaining({ mode: 'now', stripe_subscription_id: null }));
    expect(chains.box_members.update).toHaveBeenLastCalledWith({ status: 'banned' });
  });

  it('sans abonnement en cours : bannissement seul', async () => {
    setupBan({ ...MEMBER, stripe_subscription_id: null, subscription_status: null });
    const res: any = await ban(req({ box_id: 'box-1', member_id: 'ath-1' }));
    expect(res._data).toMatchObject({ ok: true, stopped: false });
    expect(chains.box_member_subscription_actions.insert).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
  });
});

/* ─────────────────── Réponse à une demande de résiliation ─────────────── */

describe('réponse à une demande de résiliation', () => {
  const setupReview = () => {
    chains.membership_cancellation_requests = makeChain({ maybeSingle: { data: { id: 'req-1', box_id: 'box-1', member_id: 'ath-1', status: 'pending' } } });
    chains.box_members = makeChain({
      maybeSingle: { data: { id: 'bm-1', plan_id: 'plan-1', stripe_subscription_id: 'sub_1', subscription_status: 'active', subscription_current_period_end: '2026-10-12T10:00:00Z' } },
    });
    chains.profiles = makeChain({ maybeSingle: { data: { email: 'membre@exemple.fr', username: 'cam', full_name: 'Camille Dupont' } } });
    chains.membership_plans = makeChain({ maybeSingle: { data: { name: 'Illimité' } } });
  };

  it('approbation : arrêt en fin de période idempotent, e-mail d’acceptation vers la box', async () => {
    setupReview();
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._data).toEqual({ ok: true });
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true },
      { stripeAccount: 'acct_1', idempotencyKey: 'stop:bm-1:sub_1:period_end' });
    const [mail] = emails();
    expect(mail.to).toBe('membre@exemple.fr');
    expect(mail.reply_to).toBe('salle@exemple.fr');
    expect(mail.subject).toBe('Ta demande de résiliation est acceptée : ton abonnement à AthleX Fitness prendra fin le lundi 12 octobre 2026');
    expect(mail.html).toContain('Bonjour Camille, AthleX Fitness a accepté ta demande de résiliation.');
  });

  it('refus : aucun appel Stripe, e-mail avec le motif saisi', async () => {
    setupReview();
    const res: any = await review(req({ request_id: 'req-1', action: 'reject', note: 'Engagement de 12 mois signé' }));
    expect(res._data).toEqual({ ok: true });
    expect(mockSubUpdate).not.toHaveBeenCalled();
    const [mail] = emails();
    expect(mail.subject).toBe("AthleX Fitness n'a pas pu accepter ta demande de résiliation");
    expect(mail.html).toContain('Motif : « Engagement de 12 mois signé »');
    expect(mail.reply_to).toBe('salle@exemple.fr');
  });

  it('e-mail refusé par Resend : la réponse est enregistrée, avertissement renvoyé', async () => {
    setupReview();
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as any);
    const res: any = await review(req({ request_id: 'req-1', action: 'reject' }));
    expect(res._data.ok).toBe(true);
    expect(res._data.warning).toContain('préviens-le directement');
    expect(chains.membership_cancellation_requests.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
  });

  it('403 hors gérant : ni Stripe ni e-mail', async () => {
    setupReview();
    mockIsOwnerAdmin.mockResolvedValue(false);
    const res: any = await review(req({ request_id: 'req-1', action: 'approve' }));
    expect(res._status).toBe(403);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails()).toHaveLength(0);
  });
});
