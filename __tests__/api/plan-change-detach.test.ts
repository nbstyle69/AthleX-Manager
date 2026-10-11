// Résilier, arrêter ou mettre en pause annule le changement de formule
// programmé : detachPlanChange (lib/membership/server.ts) relâche NOTRE
// échéancier puis vide les colonnes ; un échéancier étranger n'est pas touché.
// Points d'appel : lib/stripe/stopSubscription.ts (arrêt par le gérant,
// suppression de formule, archivage, demande de résiliation acceptée),
// /api/cancel-membership, /api/pause-membership.

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockOrdre: string[] = [];
const mockStripe = {
  subscriptions: { retrieve: jest.fn(), update: jest.fn(), cancel: jest.fn() },
  subscriptionSchedules: { retrieve: jest.fn(), release: jest.fn() },
};
jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => mockStripe) }));
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn(), getServerUser: jest.fn() }));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn().mockResolvedValue(true) }));

import { detachPlanChange } from '@/lib/membership/server';
import { stopSubscription } from '@/lib/stripe/stopSubscription';
import { POST as resilier } from '../../app/api/cancel-membership/route';
import { POST as pause } from '../../app/api/pause-membership/route';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const PROGRAMME = { scheduled_plan_id: 'illimite', scheduled_change_at: '2026-11-01T12:00:00Z', stripe_schedule_id: 'sub_sched_1' };
const VIDE = { scheduled_plan_id: null, scheduled_change_at: null, stripe_schedule_id: null };

let db: ReturnType<typeof fakeSupabase>;
function monde(colonnes: Record<string, unknown> = PROGRAMME) {
  db = fakeSupabase({
    box_members: [{
      id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', status: 'active', joined_at: '2026-01-01', plan_id: 'mensuel',
      subscription_status: 'active', stripe_subscription_id: 'sub_1', commitment_end_date: null, ...colonnes,
    }],
    boxes: [{ id: 'box-1', stripe_account_id: 'acct_1', archived_at: null, archive_scheduled_at: null }],
  });
  (createServiceClient as jest.Mock).mockReturnValue(db.client);
}
const ligne = () => db.tables.box_members[0];
const ecritures = () => db.writes.filter((w) => w.table === 'box_members');

function abonnement(schedule: string | null) {
  mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', schedule });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdre.length = 0;
  monde();
  abonnement('sub_sched_1');
  mockStripe.subscriptionSchedules.release.mockImplementation(async (id: string) => { mockOrdre.push(`release ${id}`); return { id, status: 'released' }; });
  mockStripe.subscriptions.update.mockImplementation(async (id: string, p: any) => { mockOrdre.push(`update ${JSON.stringify(p)}`); return { id }; });
  mockStripe.subscriptions.cancel.mockImplementation(async (id: string) => { mockOrdre.push(`cancel ${id}`); return { id, status: 'canceled' }; });
  (getServerUser as jest.Mock).mockResolvedValue({ id: 'ath-1' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('detachPlanChange', () => {
  it('notre échéancier (enregistré) : relâché avec une clé liée à lui, puis colonnes vidées sous condition', async () => {
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'resiliation' });
    expect(mockStripe.subscriptionSchedules.release).toHaveBeenCalledWith(
      'sub_sched_1', {}, { stripeAccount: 'acct_1', idempotencyKey: 'plan-change:release:sub_sched_1:resiliation' },
    );
    expect(ligne()).toMatchObject(VIDE);
    expect(ecritures()).toEqual([expect.objectContaining({ values: VIDE, match: { id: 'bm-1', stripe_schedule_id: 'sub_sched_1' } })]);
  });

  it('notre échéancier reconnu par sa marque (colonnes déjà vides) : relâché, aucune écriture inutile', async () => {
    monde(VIDE);
    abonnement('sub_sched_9');
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sub_sched_9', metadata: { athlex_plan_change: '1', member_id: 'ath-1' } });
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'arret' });
    expect(mockStripe.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_9', {}, expect.objectContaining({ stripeAccount: 'acct_1' }));
    expect(ecritures()).toEqual([]);
  });

  it.each([
    ['sans marque', {}],
    ['marqué pour un autre membre', { athlex_plan_change: '1', member_id: 'ath-2' }],
  ])('échéancier étranger (%s) : ni relâché ni colonnes touchées', async (_l, metadata) => {
    monde({ ...PROGRAMME, stripe_schedule_id: 'sub_sched_1' });
    abonnement('sub_sched_box');
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sub_sched_box', metadata });
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'arret' });
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
    expect(ecritures()).toEqual([]);
    expect(ligne()).toMatchObject(PROGRAMME);
  });

  it('plus d’échéancier chez Stripe, colonnes encore pleines : colonnes vidées', async () => {
    abonnement(null);
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'pause' });
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
    expect(ligne()).toMatchObject(VIDE);
  });

  it('déjà relâché chez Stripe : colonnes vidées quand même', async () => {
    mockStripe.subscriptionSchedules.release.mockRejectedValue(new Error('already released'));
    mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({ id: 'sub_sched_1', status: 'released' });
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'arret' });
    expect(ligne()).toMatchObject(VIDE);
  });

  it('release: false (annulation immédiate) : aucun appel Stripe, colonnes vidées', async () => {
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'arret', release: false });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
    expect(ligne()).toMatchObject(VIDE);
  });

  it('abonnement de la plateforme ou d’un programme (aucune ligne de membre) : rien', async () => {
    await detachPlanChange({ stripeAccount: undefined, subscriptionId: 'sub_1', motif: 'arret' });
    await detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_programme', motif: 'arret' });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(ecritures()).toEqual([]);
  });

  it('Stripe en panne : ne lève pas, rien d’écrit', async () => {
    mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('stripe down'));
    await expect(detachPlanChange({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', motif: 'arret' })).resolves.toBeUndefined();
    expect(ecritures()).toEqual([]);
  });
});

describe('arrêt (stopSubscription) : gérant, suppression de formule, archivage, résiliation acceptée', () => {
  it('fin de période : échéancier relâché AVANT la mise à jour de l’annulation', async () => {
    await stopSubscription({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', mode: 'period_end', idempotencyKey: 'stop-1' });
    expect(mockOrdre).toEqual(['release sub_sched_1', 'update {"cancel_at_period_end":true}']);
    expect(ligne()).toMatchObject(VIDE);
  });

  it('immédiat : annulation, puis colonnes vidées (sans relâche, Stripe l’accepte)', async () => {
    await stopSubscription({ stripeAccount: 'acct_1', subscriptionId: 'sub_1', mode: 'now', idempotencyKey: 'stop-2' });
    expect(mockOrdre).toEqual(['cancel sub_1']);
    expect(ligne()).toMatchObject(VIDE);
  });
});

describe('POST /api/cancel-membership pendant un changement programmé', () => {
  it('résiliation acceptée, changement annulé (relâche avant la mise à jour)', async () => {
    const res = (await resilier()) as any;
    expect(res._status).toBe(200);
    expect(mockOrdre).toEqual(['release sub_sched_1', 'update {"cancel_at_period_end":true}']);
    expect(ligne()).toMatchObject(VIDE);
  });
});

describe('POST /api/pause-membership pendant un changement programmé', () => {
  const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

  it('pause : changement annulé avant la pause', async () => {
    const res = (await pause(req({ box_member_id: 'bm-1', action: 'pause' }))) as any;
    expect(res._status).toBe(200);
    expect(mockOrdre[0]).toBe('release sub_sched_1');
    expect(mockOrdre[1]).toMatch(/^update .*pause_collection/);
    expect(ligne()).toMatchObject(VIDE);
  });

  it('reprise : aucun relâche', async () => {
    await pause(req({ box_member_id: 'bm-1', action: 'resume' }));
    expect(mockStripe.subscriptionSchedules.release).not.toHaveBeenCalled();
  });
});
