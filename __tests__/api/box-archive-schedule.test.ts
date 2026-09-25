// Archivage d'une box, PR 2 sur 3 (paiement) : /api/admin/boxes/[id]/archive-schedule.
// Stripe et Resend simulés ; base en mémoire (lignes réelles, écritures journalisées).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.RESEND_API_KEY = 're_dummy';

const mockSubUpdate = jest.fn();
const mockSubCancel = jest.fn();
const mockSubRetrieve = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    subscriptions: { update: mockSubUpdate, cancel: mockSubCancel, retrieve: mockSubRetrieve },
  })),
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
}));

import { POST } from '../../app/api/admin/boxes/[id]/archive-schedule/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const mockUser = getServerUser as jest.Mock;
const mockService = createServiceClient as jest.Mock;

const params = { params: Promise.resolve({ id: 'b1' }) };
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });
const call = (action: string) => POST(req({ action }), params) as Promise<any>;

const EPOCH_NOV20 = Date.UTC(2026, 10, 20, 10) / 1000;

/** État Stripe simulé par abonnement ; un arrêt le fait évoluer, comme chez Stripe. */
let stripeState: Record<string, { status: string; cancel_at_period_end: boolean; current_period_end: number }>;
const sub = (status = 'active') => ({ status, cancel_at_period_end: false, current_period_end: EPOCH_NOV20 });

let db: ReturnType<typeof fakeSupabase>;

function world(over: Partial<Record<string, any[]>> = {}) {
  return {
    profiles: [
      { id: 'sa', role: 'super_admin' },
      { id: 'adm', role: 'admin' },
      { id: 'owner-1', email: 'gerant@exemple.fr', username: 'gerant', full_name: 'Camille Gérant' },
      { id: 'owner-3', email: 'voisin@exemple.fr', username: 'voisin', full_name: 'Léa Voisine' },
      { id: 'm1', email: 'm1@exemple.fr', username: 'membre1', full_name: 'Inès Un' },
      { id: 'm2', email: 'm2@exemple.fr', username: 'membre2', full_name: 'Hugo Deux' },
      { id: 'm3', email: 'm3@exemple.fr', username: 'membre3', full_name: 'Zoé Trois' },
      { id: 'm4', email: 'm4@exemple.fr', username: 'membre4', full_name: 'Nour Quatre' },
      { id: 'buyer', email: 'acheteur@exemple.fr', username: 'acheteur', full_name: 'Lucas Acheteur' },
      { id: 'owner-9', email: 'editeur@exemple.fr', username: 'editeur', full_name: 'Sam Éditeur' },
    ],
    boxes: [
      { id: 'b1', name: 'Box Test', stripe_account_id: 'acct_box', contact_email: 'salle@exemple.fr', owner_id: 'owner-1', archived_at: null, archive_scheduled_at: null },
      { id: 'pub-2', name: 'Éditeur Voisin', stripe_account_id: 'acct_pub', owner_id: 'owner-9', archived_at: null, archive_scheduled_at: null },
      { id: 'sub-3', name: 'Box Abonnée', stripe_account_id: 'acct_sub', owner_id: 'owner-3', archived_at: null, archive_scheduled_at: null },
    ],
    box_members: [
      { id: 'bm1', box_id: 'b1', member_id: 'm1', plan_id: 'pl1', status: 'active', stripe_subscription_id: 'sub_m1', subscription_status: 'active', subscription_cancel_at_period_end: false, subscription_current_period_end: '2026-11-10T10:00:00.000Z', commitment_end_date: '2099-01-01' },
      { id: 'bm2', box_id: 'b1', member_id: 'm2', plan_id: 'pl1', status: 'active', stripe_subscription_id: 'sub_m2', subscription_status: 'past_due', subscription_cancel_at_period_end: false, subscription_current_period_end: '2026-10-01T10:00:00.000Z', commitment_end_date: null },
      { id: 'bm3', box_id: 'b1', member_id: 'm3', plan_id: 'pl1', status: 'active', stripe_subscription_id: 'sub_m3', subscription_status: 'active', subscription_cancel_at_period_end: true, subscription_current_period_end: '2026-12-01T10:00:00.000Z', commitment_end_date: null },
      { id: 'bm4', box_id: 'b1', member_id: 'm4', plan_id: 'pl2', status: 'active', stripe_subscription_id: null, subscription_status: 'active', subscription_cancel_at_period_end: false, subscription_current_period_end: null, commitment_end_date: null },
      { id: 'bm5', box_id: 'b1', member_id: 'm5', plan_id: null, status: 'inactive', stripe_subscription_id: 'sub_m5', subscription_status: 'cancelled', subscription_cancel_at_period_end: false, subscription_current_period_end: null, commitment_end_date: null },
      { id: 'bm9', box_id: 'autre', member_id: 'm9', plan_id: null, status: 'active', stripe_subscription_id: 'sub_m9', subscription_status: 'active', subscription_cancel_at_period_end: false, subscription_current_period_end: null, commitment_end_date: null },
    ],
    membership_plans: [{ id: 'pl1', name: 'Illimité' }, { id: 'pl2', name: 'Comptoir' }],
    programs: [{ id: 'pg1', box_id: 'b1', title: 'Force 12 semaines' }, { id: 'pgx', box_id: 'autre', title: 'Ailleurs' }],
    program_members: [
      { id: 'pm1', user_id: 'buyer', program_id: 'pg1', stripe_subscription_id: 'sub_p1', status: 'active' },
      // Achat en une fois : rien à arrêter, l'accès reste (PR 1).
      { id: 'pm2', user_id: 'm1', program_id: 'pg1', stripe_subscription_id: null, status: 'active' },
      { id: 'pm9', user_id: 'buyer', program_id: 'pgx', stripe_subscription_id: 'sub_p9', status: 'active' },
    ],
    box_programming: [
      { id: 'off1', publisher_box_id: 'b1', title: 'Semaine type' },
      { id: 'off2', publisher_box_id: 'pub-2', title: 'Programmation voisine' },
    ],
    box_programming_subscriptions: [
      { id: 's1', programming_id: 'off1', subscriber_box_id: 'sub-3', stripe_subscription_id: 'sub_o1', status: 'active' },
      { id: 's2', programming_id: 'off2', subscriber_box_id: 'b1', stripe_subscription_id: 'sub_o2', status: 'active' },
    ],
    pending_entitlements: [
      { id: 'pe1', email: 'futur@exemple.fr', kind: 'membership', claimed_at: null, payload: { box_id: 'b1', plan_id: 'pl1', stripe_subscription_id: 'sub_pe1' } },
      { id: 'pe2', email: 'futur2@exemple.fr', kind: 'program', claimed_at: null, payload: { program_id: 'pg1', stripe_subscription_id: 'sub_pe2' } },
      { id: 'pe3', email: 'x@exemple.fr', kind: 'membership', claimed_at: null, payload: { box_id: 'autre', stripe_subscription_id: 'sub_pe3' } },
      { id: 'pe4', email: 'y@exemple.fr', kind: 'membership', claimed_at: '2026-09-01', payload: { box_id: 'b1', stripe_subscription_id: 'sub_pe4' } },
      { id: 'pe5', email: 'z@exemple.fr', kind: 'credit', claimed_at: null, payload: { box_id: 'b1' } },
    ],
    box_subscriptions: [{ id: 'bs1', box_id: 'b1', billing_source: 'stripe', status: 'active', stripe_subscription_id: 'sub_box', current_period_end: '2026-11-20T10:00:00.000Z' }],
    // Plan Multi du gérant : jamais lu, jamais arrêté.
    owner_subscriptions: [{ id: 'os1', owner_id: 'owner-1', stripe_subscription_id: 'sub_multi', status: 'active' }],
    box_member_subscription_actions: [],
    ...over,
  } as Record<string, any[]>;
}

let fetchSpy: jest.SpyInstance;
const emails = () => fetchSpy.mock.calls
  .filter(c => String(c[0]).includes('resend'))
  .map(c => JSON.parse(c[1].body));
const stripeIds = () => [
  ...mockSubUpdate.mock.calls.map(c => c[0]), ...mockSubCancel.mock.calls.map(c => c[0]), ...mockSubRetrieve.mock.calls.map(c => c[0]),
];

function setup(over: Partial<Record<string, any[]>> = {}, user = 'sa') {
  db = fakeSupabase(world(over), {
    unschedule_box_archive: ({ p_box_id }: any) => {
      const b = db.tables.boxes.find(x => x.id === p_box_id);
      if (b?.archived_at) return { data: null, error: { message: "BOX_DEJA_ARCHIVEE: cette box est déjà archivée, l'archivage ne s'annule plus." } };
      if (!b?.archive_scheduled_at) return { data: null, error: { message: "ARCHIVAGE_NON_PROGRAMME: aucun archivage n'est programmé pour cette box." } };
      b.archive_scheduled_at = null; b.archive_scheduled_by = null;
      return { data: null, error: null };
    },
  });
  mockService.mockReturnValue(db.client);
  mockUser.mockResolvedValue({ id: user });
}

beforeEach(() => {
  jest.clearAllMocks();
  stripeState = {
    sub_p1: sub(), sub_o1: sub(), sub_o2: sub(), sub_pe1: sub(), sub_pe2: sub(), sub_box: sub(),
    sub_m1: sub(), sub_m2: sub('past_due'), sub_multi: sub(),
  };
  mockSubRetrieve.mockImplementation(async (id: string) => ({ id, ...stripeState[id] }));
  mockSubUpdate.mockImplementation(async (id: string) => { stripeState[id].cancel_at_period_end = true; return { id }; });
  mockSubCancel.mockImplementation(async (id: string) => { stripeState[id].status = 'canceled'; return { id }; });
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, text: async () => '' } as any);
  setup();
});
afterEach(() => fetchSpy.mockRestore());

describe('garde : super-admin seul', () => {
  it.each([['adm'], ['visiteur']])('refuse %s, sans lecture Stripe ni écriture', async (who) => {
    if (who === 'visiteur') mockUser.mockResolvedValue(null); else setup({}, who);
    for (const action of ['check', 'schedule', 'unschedule']) {
      const res = await call(action);
      expect(res._status).toBe(403);
    }
    expect(stripeIds()).toEqual([]);
    expect(db.writes).toEqual([]);
    expect(db.client.rpc).not.toHaveBeenCalled();
  });

  it('refuse une action inconnue', async () => {
    expect((await call('archive'))._status).toBe(400);
  });
});

describe('check : lecture seule, compte exact', () => {
  it('compte chaque type, impayés, engagés, comptoir, abonnement AthleX et date la plus lointaine', async () => {
    const res = await call('check');
    expect(res._status).toBe(200);
    expect(res._data).toEqual({
      ok: true,
      box: { name: 'Box Test', archived_at: null, archive_scheduled_at: null },
      members: { active: 3, to_stop: 2, past_due: 1, already_stopping: 1, committed: 1 },
      counter_members: 1,
      programs: { active: 1, to_stop: 1, past_due: 0, already_stopping: 0 },
      offers_sold: { active: 1, to_stop: 1, past_due: 0, already_stopping: 0 },
      offers_bought: { active: 1, to_stop: 1, past_due: 0, already_stopping: 0 },
      pending: { active: 2, to_stop: 2, past_due: 0, already_stopping: 0 },
      box_subscription: { source: 'stripe', status: 'active', stopping: false, period_end: '2026-11-20T10:00:00.000Z', to_stop: true },
      to_stop: 8,
      past_due: 1,
      // bm3, déjà en fin programmée au 1er décembre, paie jusque-là.
      last_end: '2026-12-01T10:00:00.000Z',
      still_paying: true,
      only_athlex: false,
    });
    // Rien n'est écrit, rien n'est arrêté.
    expect(db.writes).toEqual([]);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCancel).not.toHaveBeenCalled();
  });

  it('lit l’état chez Stripe sur le bon compte : la box, l’éditeur, la plateforme pour AthleX', async () => {
    await call('check');
    const byId = Object.fromEntries(mockSubRetrieve.mock.calls.map(c => [c[0], c[2]]));
    expect(byId).toEqual({
      sub_p1: { stripeAccount: 'acct_box' }, sub_o1: { stripeAccount: 'acct_box' }, sub_o2: { stripeAccount: 'acct_pub' },
      sub_pe1: { stripeAccount: 'acct_box' }, sub_pe2: { stripeAccount: 'acct_box' }, sub_box: {},
    });
  });

  it('un impayé lu chez Stripe est compté comme tel (programme, offre, box)', async () => {
    stripeState.sub_p1.status = 'past_due';
    stripeState.sub_box.status = 'unpaid';
    const d = (await call('check'))._data;
    expect(d.programs.past_due).toBe(1);
    expect(d.box_subscription.to_stop).toBe(true);
    expect(d.past_due).toBe(3);
  });
});

describe('schedule : chaque arrêt, selon l’impayé', () => {
  it('membres : fin de période (clé S2), impayé tout de suite, fin déjà programmée non rappelée', async () => {
    const res = await call('schedule');
    expect(res._status).toBe(200);
    expect(mockSubUpdate).toHaveBeenCalledWith('sub_m1', { cancel_at_period_end: true }, { stripeAccount: 'acct_box', idempotencyKey: 'stop:bm1:sub_m1:period_end' });
    expect(mockSubCancel).toHaveBeenCalledWith('sub_m2', { prorate: false, invoice_now: false }, { stripeAccount: 'acct_box', idempotencyKey: 'stop:bm2:sub_m2:now' });
    expect(stripeIds()).not.toContain('sub_m3');
    // Engagement levé par l'arrêt (S2), fin réelle pour l'impayé.
    expect(db.tables.box_members.find(m => m.id === 'bm1')).toMatchObject({ subscription_cancel_at_period_end: true, commitment_end_date: null });
    expect(db.tables.box_members.find(m => m.id === 'bm2')).toMatchObject({ subscription_status: 'cancelled', status: 'inactive' });
    // Journal S2 pour les deux.
    expect(db.tables.box_member_subscription_actions.map(a => [a.box_member_id, a.mode, a.actor_id])).toEqual(
      expect.arrayContaining([['bm1', 'period_end', 'sa'], ['bm2', 'now', 'sa']]));
  });

  it('programmes, offres vendues et achetées, droits en attente : fin de période, sur le bon compte', async () => {
    await call('schedule');
    const updates = Object.fromEntries(mockSubUpdate.mock.calls.map(c => [c[0], c[2]]));
    expect(updates.sub_p1).toEqual({ stripeAccount: 'acct_box', idempotencyKey: 'stop:archive:program:pm1:sub_p1:period_end' });
    expect(updates.sub_o1).toEqual({ stripeAccount: 'acct_box', idempotencyKey: 'stop:archive:offer_sold:s1:sub_o1:period_end' });
    expect(updates.sub_o2).toEqual({ stripeAccount: 'acct_pub', idempotencyKey: 'stop:archive:offer_bought:s2:sub_o2:period_end' });
    expect(updates.sub_pe1).toEqual({ stripeAccount: 'acct_box', idempotencyKey: 'stop:archive:pending:pe1:sub_pe1:period_end' });
    expect(updates.sub_pe2).toEqual({ stripeAccount: 'acct_box', idempotencyKey: 'stop:archive:pending:pe2:sub_pe2:period_end' });
  });

  it('abonnement de la box à AthleX : compte de la plateforme (aucun compte connecté)', async () => {
    await call('schedule');
    const box = mockSubUpdate.mock.calls.find(c => c[0] === 'sub_box');
    expect(box?.[1]).toEqual({ cancel_at_period_end: true });
    // Strict : pas même un `stripeAccount: undefined` dans les options.
    expect(box?.[2]).toStrictEqual({ idempotencyKey: 'stop:archive:box:bs1:sub_box:period_end' });
    expect(mockSubRetrieve.mock.calls.find(c => c[0] === 'sub_box')?.[2]).toStrictEqual({});
  });

  it.each([
    ['sub_p1', 'acct_box', 'stop:archive:program:pm1:sub_p1:now'],
    ['sub_o1', 'acct_box', 'stop:archive:offer_sold:s1:sub_o1:now'],
    ['sub_o2', 'acct_pub', 'stop:archive:offer_bought:s2:sub_o2:now'],
    ['sub_pe1', 'acct_box', 'stop:archive:pending:pe1:sub_pe1:now'],
    ['sub_box', undefined, 'stop:archive:box:bs1:sub_box:now'],
  ])('%s en impayé : arrêt immédiat', async (id, account, key) => {
    stripeState[id].status = 'past_due';
    await call('schedule');
    expect(mockSubCancel).toHaveBeenCalledWith(id, { prorate: false, invoice_now: false }, account ? { stripeAccount: account, idempotencyKey: key } : { idempotencyKey: key });
    expect(mockSubUpdate.mock.calls.map(c => c[0])).not.toContain(id);
  });

  it('programme l’archivage (colonnes de la PR 1), pas d’archivage immédiat', async () => {
    const res = await call('schedule');
    expect(res._data).toMatchObject({ ok: true, scheduled: true, stopped: 8, last_end: '2026-12-01T10:00:00.000Z' });
    const b1 = db.tables.boxes.find(b => b.id === 'b1')!;
    expect(b1.archive_scheduled_by).toBe('sa');
    expect(typeof b1.archive_scheduled_at).toBe('string');
    expect(b1.archived_at).toBeNull();
    expect(db.writes.filter(w => w.table === 'boxes')).toHaveLength(1);
  });

  it('achat en une fois, plan Multi, abonnements d’autres boxs : jamais touchés', async () => {
    await call('schedule');
    for (const id of ['sub_multi', 'sub_p9', 'sub_m9', 'sub_pe3', 'sub_pe4', 'sub_m5']) expect(stripeIds()).not.toContain(id);
    expect(db.client.from).not.toHaveBeenCalledWith('owner_subscriptions');
  });

  it('abonnement AthleX `manual` : ni lu ni arrêté, même avec un identifiant Stripe', async () => {
    setup({ box_subscriptions: [{ id: 'bs1', box_id: 'b1', billing_source: 'manual', status: 'active', stripe_subscription_id: 'sub_manual', current_period_end: null }] });
    await call('schedule');
    expect(stripeIds()).not.toContain('sub_manual');
    const d = (await call('check'))._data;
    expect(d.box_subscription).toEqual({ source: 'manual', status: 'active', stopping: false, period_end: null, to_stop: false });
  });

  it('refuse une box déjà archivée, sans rien arrêter', async () => {
    setup({ boxes: [{ ...world().boxes[0], archived_at: '2026-09-25T10:00:00Z' }] });
    expect((await call('schedule'))._status).toBe(409);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCancel).not.toHaveBeenCalled();
  });
});

describe('ordre : programmer d’abord, arrêter ensuite (suivi de #390)', () => {
  it('les entrées sont fermées avant le premier appel d’arrêt Stripe', async () => {
    const scheduledAtStop: (string | null)[] = [];
    const seen = () => scheduledAtStop.push(db.tables.boxes.find(b => b.id === 'b1')!.archive_scheduled_at ?? null);
    mockSubUpdate.mockImplementation(async (id: string) => { seen(); stripeState[id].cancel_at_period_end = true; return { id }; });
    mockSubCancel.mockImplementation(async (id: string) => { seen(); stripeState[id].status = 'canceled'; return { id }; });
    await call('schedule');
    expect(scheduledAtStop.length).toBe(8);
    expect(scheduledAtStop.every(v => typeof v === 'string')).toBe(true);
  });

  it('deux programmations en même temps : la seconde ne relance pas les arrêts', async () => {
    // La box est lue ouverte, mais un autre appel l'a programmée entre-temps.
    const b1 = db.tables.boxes.find(b => b.id === 'b1')!;
    const realFrom = db.client.from.getMockImplementation();
    let first = true;
    db.client.from.mockImplementation((t: string) => {
      const q = realFrom(t);
      if (t === 'boxes' && first) { first = false; const ms = q.maybeSingle; q.maybeSingle = async () => { const r = await ms(); const copy = { ...r, data: { ...r.data } }; b1.archive_scheduled_at = '2026-09-26T08:00:00Z'; return copy; }; }
      return q;
    });
    const res = await call('schedule');
    expect(res._status).toBe(409);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCancel).not.toHaveBeenCalled();
  });
});

describe('échec partiel, puis relance', () => {
  const failOnce = (id: string) => mockSubUpdate.mockImplementation(async (sid: string) => {
    if (sid === id) throw new Error('Stripe down');
    stripeState[sid].cancel_at_period_end = true; return { id: sid };
  });

  it('un arrêt refusé : 502 qui le nomme, archivage CONSERVÉ, entrées fermées, arrêts réussis journalisés', async () => {
    failOnce('sub_o2');
    const res = await call('schedule');
    expect(res._status).toBe(502);
    expect(res._data.failed).toEqual(['l’offre Programmation voisine de Éditeur Voisin']);
    expect(res._data.scheduled).toBe(true);
    expect(res._data.error).toBe('Stripe a refusé l’arrêt de 1 abonnement : l’offre Programmation voisine de Éditeur Voisin. L’archivage est programmé et les entrées sont fermées ; les autres abonnements sont bien arrêtés. Relance les arrêts pour terminer : les abonnements déjà arrêtés ne seront pas rappelés. L’e-mail au gérant et aux membres au comptoir partira quand tout sera arrêté.');
    const b1 = db.tables.boxes.find(b => b.id === 'b1')!;
    expect(typeof b1.archive_scheduled_at).toBe('string');
    expect(b1.archive_scheduled_by).toBe('sa');
    expect(b1.archived_at).toBeNull();
    expect(db.tables.box_member_subscription_actions.map(a => a.box_member_id)).toEqual(expect.arrayContaining(['bm1', 'bm2']));
    // L'e-mail d'archivage attend que tout soit arrêté.
    expect(emails().map(e => e.to)).not.toContain('gerant@exemple.fr');
    expect(emails().map(e => e.to)).not.toContain('m4@exemple.fr');
  });

  it('la relance complète sans double appel, envoie l’e-mail d’archivage une fois ; une troisième ne fait rien', async () => {
    failOnce('sub_m1');
    expect((await call('schedule'))._status).toBe(502);
    const firstStops = mockSubUpdate.mock.calls.length + mockSubCancel.mock.calls.length;
    const journalBefore = db.tables.box_member_subscription_actions.length;
    const mailsBefore = emails().length;
    mockSubUpdate.mockClear(); mockSubCancel.mockClear();
    mockSubUpdate.mockImplementation(async (id: string) => { stripeState[id].cancel_at_period_end = true; return { id }; });

    const res = await call('schedule');
    expect(res._status).toBe(200);
    expect(res._data).toMatchObject({ scheduled: true, stopped: 1 });
    // Seul l'arrêt refusé la première fois est refait.
    expect(mockSubUpdate.mock.calls.map(c => c[0])).toEqual(['sub_m1']);
    expect(mockSubCancel).not.toHaveBeenCalled();
    expect(firstStops).toBe(8);
    expect(db.tables.box_member_subscription_actions.length).toBe(journalBefore + 1);
    // E-mails de la relance : m1 (son arrêt), puis gérant et comptoir, une fois chacun.
    expect(emails().slice(mailsBefore).map(e => e.to)).toEqual(['m1@exemple.fr', 'gerant@exemple.fr', 'm4@exemple.fr']);
    // La programmation reste celle du premier appel (une seule écriture sur boxes).
    expect(db.writes.filter(w => w.table === 'boxes')).toHaveLength(1);

    const mailsAfter = emails().length;
    mockSubUpdate.mockClear();
    const third = await call('schedule');
    expect(third._status).toBe(409);
    expect(third._data.error).toBe('L’archivage de cette box est déjà programmé et tous ses abonnements sont arrêtés.');
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(emails().length).toBe(mailsAfter);
  });
});

describe('plus rien ne paie : archivage immédiat', () => {
  it('seuls des impayés (arrêtés tout de suite) et un abonnement `manual` : archivée tout de suite, comptoir prévenu', async () => {
    setup({
      box_members: [world().box_members[1], world().box_members[3]],
      program_members: [], box_programming_subscriptions: [], pending_entitlements: [],
      box_subscriptions: [{ id: 'bs1', box_id: 'b1', billing_source: 'manual', status: 'active', stripe_subscription_id: null, current_period_end: null }],
    });
    const res = await call('schedule');
    expect(res._data).toEqual({ ok: true, archived: true, stopped: 1 });
    const b1 = db.tables.boxes.find(b => b.id === 'b1')!;
    expect(b1.archived_by).toBe('sa');
    expect(typeof b1.archived_at).toBe('string');
    // Programmation effacée : « Réactiver » rouvre bien les entrées.
    expect(b1.archive_scheduled_at).toBeNull();
    expect(b1.archive_scheduled_by).toBeNull();
    // S2 à l'impayé, fermeture immédiate au comptoir ; rien au gérant, comme avant.
    const byTo = Object.fromEntries(emails().map(e => [e.to, e]));
    expect(Object.keys(byTo).sort()).toEqual(['m2@exemple.fr', 'm4@exemple.fr']);
    expect(byTo['m4@exemple.fr'].subject).toBe("Box Test ferme aujourd'hui");
    expect(byTo['m4@exemple.fr'].html).toContain("Bonjour Nour, Box Test est archivée aujourd'hui : ton accès à la box et à ses cours s'arrête dès maintenant.");
    expect(byTo['m4@exemple.fr'].reply_to).toBe('salle@exemple.fr');
  });

  it('box sans aucun abonnement : archivée tout de suite, aucun appel Stripe', async () => {
    setup({ box_members: [], program_members: [], box_programming_subscriptions: [], pending_entitlements: [], box_subscriptions: [] });
    const res = await call('schedule');
    expect(res._data).toEqual({ ok: true, archived: true, stopped: 0 });
    expect(stripeIds()).toEqual([]);
  });
});

describe('seul l’abonnement AthleX paie encore', () => {
  it('check le dit (only_athlex), et schedule programme jusqu’à sa fin', async () => {
    setup({ box_members: [world().box_members[3]], program_members: [], box_programming_subscriptions: [], pending_entitlements: [] });
    const d = (await call('check'))._data;
    expect(d).toMatchObject({ still_paying: true, only_athlex: true, last_end: '2026-11-20T10:00:00.000Z' });
    const res = await call('schedule');
    expect(res._data).toMatchObject({ scheduled: true, stopped: 1, last_end: '2026-11-20T10:00:00.000Z' });
  });
  it('pas dès qu’un membre, un programme ou une offre paie', async () => {
    expect((await call('check'))._data.only_athlex).toBe(false);
    // Aucun membre par Stripe, mais un programme paie encore : pas la variante.
    setup({ box_members: [world().box_members[3]], box_programming_subscriptions: [], pending_entitlements: [] });
    expect((await call('check'))._data).toMatchObject({ still_paying: true, only_athlex: false });
  });
});

describe('e-mails', () => {
  it('S2 aux membres, fermeture aux acheteurs et à l’éditeur, S4 aux boxs abonnées, gérant et comptoir ; réponses vers la bonne adresse', async () => {
    await call('schedule');
    const byTo = Object.fromEntries(emails().map(e => [e.to, e]));
    expect(Object.keys(byTo).sort()).toEqual([
      'acheteur@exemple.fr', 'editeur@exemple.fr', 'futur2@exemple.fr', 'futur@exemple.fr', 'gerant@exemple.fr', 'm1@exemple.fr', 'm2@exemple.fr', 'm4@exemple.fr', 'voisin@exemple.fr',
    ]);
    expect(byTo['m1@exemple.fr'].subject).toBe('Ton abonnement à Box Test prendra fin le mardi 10 novembre 2026');
    expect(byTo['m2@exemple.fr'].subject).toBe('Ton abonnement à Box Test est arrêté');
    // Programme : texte de fermeture, plus « a retiré le programme ».
    expect(byTo['acheteur@exemple.fr'].subject).toBe('Box Test ferme : ton abonnement au programme Force 12 semaines prendra fin le vendredi 20 novembre 2026');
    expect(byTo['acheteur@exemple.fr'].html).toContain('Bonjour Lucas, Box Test ferme : ton abonnement au programme Force 12 semaines prendra fin le vendredi 20 novembre 2026, sans nouveau prélèvement.');
    // Offre achetée : l'éditeur est prévenu.
    expect(byTo['editeur@exemple.fr'].subject).toBe('Box Test arrête son abonnement à Programmation voisine');
    expect(byTo['editeur@exemple.fr'].html).toContain('Bonjour Sam, Box Test ferme : son abonnement à ton offre de programmation Programmation voisine prendra fin le vendredi 20 novembre 2026, sans nouveau prélèvement.');
    expect(byTo['voisin@exemple.fr'].subject).toBe('Box Test a retiré l’offre Semaine type');
    // Droits en attente : pas de profil, « Bonjour, ».
    expect(byTo['futur@exemple.fr'].subject).toBe('Ton abonnement à Box Test prendra fin le vendredi 20 novembre 2026');
    expect(byTo['futur@exemple.fr'].html).toContain('Bonjour, Box Test a mis fin à ton abonnement Illimité.');
    expect(byTo['futur2@exemple.fr'].html).toContain('Bonjour, Box Test ferme : ton abonnement au programme Force 12 semaines prendra fin');
    for (const e of Object.values(byTo) as any[]) expect(e.html).not.toContain('Bonjour toi');
    // Gérant : réponse vers AthleX ; tous les autres : vers la box.
    expect(byTo['gerant@exemple.fr'].reply_to).toBe('contact@athlexapp.eu');
    expect(byTo['gerant@exemple.fr'].subject).toBe('Box Test sera archivée le mardi 1 décembre 2026');
    expect(byTo['gerant@exemple.fr'].html).toContain("Bonjour Camille, l'archivage de Box Test est programmé");
    expect(byTo['gerant@exemple.fr'].html).toContain("et l'abonnement de Box Test à AthleX, et ses abonnements aux offres de programmation d'autres boxs aussi");
    expect(byTo['gerant@exemple.fr'].html).toContain('Message envoyé par AthleX.');
    expect(byTo['m4@exemple.fr'].subject).toBe('Box Test ferme le mardi 1 décembre 2026');
    expect(byTo['m4@exemple.fr'].html).toContain("ton accès à la box et à ses cours s'arrêtera");
    for (const to of Object.keys(byTo).filter(t => t !== 'gerant@exemple.fr')) expect(byTo[to].reply_to).toBe('salle@exemple.fr');
  });

  it('impayés : programme et offre achetée arrêtés aujourd’hui, textes « arrêté »', async () => {
    stripeState.sub_p1.status = 'past_due';
    stripeState.sub_o2.status = 'past_due';
    await call('schedule');
    const byTo = Object.fromEntries(emails().map(e => [e.to, e]));
    expect(byTo['acheteur@exemple.fr'].subject).toBe('Ton abonnement au programme Force 12 semaines est arrêté');
    expect(byTo['acheteur@exemple.fr'].html).toContain("Box Test ferme : ton abonnement au programme Force 12 semaines, qui était en impayé, est arrêté aujourd'hui.");
    expect(byTo['editeur@exemple.fr'].html).toContain("son abonnement à ton offre de programmation Programmation voisine, qui était en impayé, est arrêté aujourd'hui.");
  });

  it('un e-mail refusé : programmé quand même, avec un avertissement', async () => {
    fetchSpy.mockImplementation(async (_u: any, init: any) => ({ ok: !String(init?.body).includes('m4@exemple.fr'), status: 422, text: async () => '' }) as any);
    const res = await call('schedule');
    expect(res._data.scheduled).toBe(true);
    expect(res._data.warning).toBe('1 e-mail n’est pas parti : préviens la personne directement.');
  });
});

describe('unschedule', () => {
  it('appelle unschedule_box_archive et ne relance aucun abonnement', async () => {
    setup({ boxes: [{ ...world().boxes[0], archive_scheduled_at: '2026-09-25T10:00:00Z' }] });
    const res = await call('unschedule');
    expect(res._data).toEqual({ ok: true, unscheduled: true });
    expect(db.client.rpc).toHaveBeenCalledWith('unschedule_box_archive', { p_box_id: 'b1' });
    expect(db.tables.boxes[0].archive_scheduled_at).toBeNull();
    expect(stripeIds()).toEqual([]);
    expect(emails()).toEqual([]);
  });

  it.each([
    [{ archived_at: '2026-09-25T10:00:00Z' }, "Cette box est déjà archivée, l'archivage ne s'annule plus."],
    [{}, "Aucun archivage n'est programmé pour cette box."],
  ])('refus de la base rendu en clair (409)', async (patch, msg) => {
    setup({ boxes: [{ ...world().boxes[0], ...patch }] });
    const res = await call('unschedule');
    expect(res._status).toBe(409);
    expect(res._data.error).toBe(msg);
  });
});
