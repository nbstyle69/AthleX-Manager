// Tests pour app/api/box-export/route.ts
//
// Le risque de cette route n'est pas de mal formater un CSV : c'est de sortir
// une donnée qui n'appartient pas au gérant. Les tests verrouillent donc
// l'autorisation, le filtrage par box, et surtout les colonnes demandées —
// un `select('*')` sur box_invitations exporterait le token_hash, et sur
// box_members les identifiants Stripe.

interface Selected { table: string; columns: string; boxFilter: string | null }

const selected: Selected[] = [];

const rowsByTable: Record<string, any[]> = {
  boxes: [{ id: 'box-1', name: 'CrossFit Test', slug: 'crossfit-test', city: 'Lyon' }],
  box_members: [{
    member_id: 'u-1', role: 'member', status: 'active', joined_at: '2026-01-05T10:00:00Z',
    plan_id: 'plan-1', subscription_status: 'active', subscription_current_period_end: '2026-07-01T00:00:00Z',
    subscription_cancel_at_period_end: false, subscription_paused: false, amount_cents: 6900,
    payment_method_type: 'card', past_due_since: null, commitment_end_date: null,
  }],
  membership_plans: [{ id: 'plan-1', name: 'Illimité', price_cents: 6900, plan_type: 'subscription', is_active: true }],
  box_cash_payments: [{
    collected_at: '2026-02-01T09:00:00Z', member_id: 'u-1', plan_name: 'Illimité',
    amount_cents: 6900, source: 'invitation', collected_by: 'u-owner',
  }],
  box_invitations: [{
    created_at: '2026-01-01T09:00:00Z', email: 'nouveau@exemple.fr', first_name: 'Nora', last_name: 'B',
    plan_id: 'plan-1', payment_mode: 'box', cash_collected: true, status: 'pending',
    expires_at: '2026-01-08T09:00:00Z', accepted_at: null, send_count: 1, last_sent_at: '2026-01-01T09:05:00Z',
  }],
  class_schedules: [{
    id: 'sch-1', title: 'WOD 18h', coach: 'Nab', scheduled_date: '2026-02-03',
    start_time: '18:00', end_time: '19:00', max_capacity: 15,
  }],
  box_wods: [{
    scheduled_date: '2026-02-03', title: 'Fran', wod_type: 'For Time', description: '21-15-9',
    rounds: null, time_cap_seconds: 600, notes: null, is_published: true, created_at: '2026-02-01T08:00:00Z',
  }],
  class_reservations: [
    { created_at: '2026-02-02T12:00:00Z', schedule_id: 'sch-1', member_id: 'u-1', status: 'confirmed', attended: true },
    // Cours d'une AUTRE box : la réservation ne doit pas atterrir dans le pack.
    { created_at: '2026-02-02T12:00:00Z', schedule_id: 'sch-autre-box', member_id: 'u-2', status: 'confirmed', attended: null },
  ],
  profiles: [{ id: 'u-1', email: 'membre@exemple.fr', username: 'membre', full_name: 'Membre Un', gender: 'M' }],
};

function makeChain(table: string) {
  const state: Selected = { table, columns: '', boxFilter: null };
  const c: any = {
    select: jest.fn((cols: string) => { state.columns = cols; selected.push(state); return c; }),
    eq: jest.fn((col: string, val: string) => { if (col === 'box_id' || col === 'id') state.boxFilter = val; return c; }),
    in: jest.fn(() => c),
    order: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: rowsByTable[table]?.[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: rowsByTable[table] ?? [], error: null }),
  };
  return c;
}

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: jest.fn((t: string) => makeChain(t)) })),
  getServerUser: jest.fn(),
}));
jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn() }));

import JSZip from 'jszip';
import { GET } from '../../app/api/box-export/route';
import { getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

const mockGetServerUser = getServerUser as jest.Mock;
const mockIsBoxOwnerAdmin = isBoxOwnerAdmin as jest.Mock;

const makeReq = (boxId: string | null): any => ({
  nextUrl: { searchParams: new URLSearchParams(boxId ? { box_id: boxId } : {}) },
});

describe('GET /api/box-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selected.length = 0;
    mockGetServerUser.mockResolvedValue({ id: 'u-owner' });
    mockIsBoxOwnerAdmin.mockResolvedValue(true);
  });

  it('refuse un visiteur non authentifié', async () => {
    mockGetServerUser.mockResolvedValue(null);
    expect((await GET(makeReq('box-1'))).status).toBe(401);
  });

  it('refuse le gérant d’une autre box', async () => {
    mockIsBoxOwnerAdmin.mockResolvedValue(false);
    const res = await GET(makeReq('box-2'));
    expect(res.status).toBe(403);
    expect(selected).toHaveLength(0);
  });

  it('produit un ZIP nommé, avec un CSV par famille de données', async () => {
    const res = await GET(makeReq('box-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('athlex-crossfit-test-');

    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    expect(Object.keys(zip.files).sort()).toEqual([
      'LISEZ-MOI.txt', 'abonnements.csv', 'encaissements-comptoir.csv', 'formules.csv',
      'invitations.csv', 'membres.csv', 'reservations.csv', 'wods.csv',
    ]);

    const membres = await zip.file('membres.csv')!.async('string');
    expect(membres).toContain('membre@exemple.fr;Membre Un;member;active');
    const abos = await zip.file('abonnements.csv')!.async('string');
    expect(abos).toContain('69.00');
  });

  it('n’exporte aucune colonne sensible : pas de token_hash, pas d’identifiant Stripe, jamais d’étoile', async () => {
    await GET(makeReq('box-1'));
    for (const s of selected) {
      expect(s.columns).not.toBe('*');
      expect(s.columns).not.toContain('token_hash');
      expect(s.columns).not.toContain('stripe_');
    }
  });

  it('scope chaque lecture sur la box demandée', async () => {
    await GET(makeReq('box-1'));
    const scoped = selected.filter(s => s.table !== 'profiles');
    expect(scoped.length).toBeGreaterThan(0);
    for (const s of scoped) expect(s.boxFilter).toBe('box-1');
  });

  it('écarte une réservation rattachée au cours d’une autre box', async () => {
    const res = await GET(makeReq('box-1'));
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    const reservations = await zip.file('reservations.csv')!.async('string');
    expect(reservations).toContain('WOD 18h');
    expect(reservations.trim().split('\r\n')).toHaveLength(2); // en-tête + 1 ligne
  });
});
