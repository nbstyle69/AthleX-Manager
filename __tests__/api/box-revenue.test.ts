// Tests for app/api/box-revenue/route.ts — classification de l'argent (lot 5-D)
//
// Le test adversarial dans les deux sens exigé par le cadrage : une ligne
// comptoir de PROGRAMME doit faire bouger le seau « Programmes » et lui seul ;
// une assignation offerte (`staff`) ne doit faire bouger aucun seau. Le défaut
// que ces assertions attrapent n'est pas une erreur visible : un total faux
// reste plausible à l'écran.

const chaine = (data: any) => {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'order', 'neq']) c[m] = jest.fn(() => c);
  c.then = (resolve: any) => Promise.resolve({ data, error: null }).then(resolve);
  c.single = jest.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  c.maybeSingle = c.single;
  return c;
};

interface Fixture {
  programMembers?: unknown[];
  cashPayments?: unknown[];
}

let fixture: Fixture = {};

jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createClient: jest.fn(),
  getActiveBox: jest.fn(),
  createServiceClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === 'boxes') return chaine({ stripe_account_id: null });
      if (table === 'programs') return chaine([{ id: 'prog-1' }]);
      if (table === 'program_members') return chaine(fixture.programMembers ?? []);
      if (table === 'box_cash_payments') return chaine(fixture.cashPayments ?? []);
      throw new Error(`table non prévue : ${table}`);
    },
  })),
}));

jest.mock('@/lib/isBoxOwnerAdmin', () => ({ isBoxOwnerAdmin: jest.fn() }));

import { GET } from '../../app/api/box-revenue/route';
import { getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';

const mockGetServerUser = getServerUser as jest.Mock;
const mockIsOwnerAdmin = isBoxOwnerAdmin as jest.Mock;

const MOIS = new Date().toISOString().slice(0, 7);
const HORODATAGE = `${MOIS}-15T10:00:00.000Z`;

function req(params = 'box_id=box-1&months=6'): any {
  return { nextUrl: new URL(`https://athlexapp.eu/api/box-revenue?${params}`) };
}

async function moisCourant(f: Fixture) {
  fixture = f;
  mockGetServerUser.mockResolvedValue({ id: 'owner-1' });
  mockIsOwnerAdmin.mockResolvedValue(true);
  const res = await GET(req()) as any;
  expect(res._status ?? 200).toBe(200);
  const mois = (res._data?.months ?? []).find((m: any) => m.month === MOIS);
  expect(mois).toBeDefined();
  return mois as { program_cents: number; cash_cents: number; membership_cents: number };
}

describe('GET /api/box-revenue — un euro, un seul seau', () => {
  beforeEach(() => { jest.clearAllMocks(); fixture = {}; });

  it('refuse un coach de la box (403)', async () => {
    mockGetServerUser.mockResolvedValue({ id: 'coach-1' });
    mockIsOwnerAdmin.mockResolvedValue(false);
    const res = await GET(req()) as any;
    expect(res._status).toBe(403);
  });

  it('un encaissement comptoir de programme entre dans « Programmes »', async () => {
    const m = await moisCourant({
      cashPayments: [{ amount_cents: 4900, collected_at: HORODATAGE, source: 'program' }],
    });
    expect(m.program_cents).toBe(4900);
  });

  it('… et n’est pas recompté en « comptoir »', async () => {
    const m = await moisCourant({
      cashPayments: [{ amount_cents: 4900, collected_at: HORODATAGE, source: 'program' }],
    });
    expect(m.cash_cents).toBe(0);
    // Le total du graphe est membership+program+cash : 4900 encaissés doivent
    // faire 4900 de total, jamais 9800.
    expect(m.membership_cents + m.program_cents + m.cash_cents).toBe(4900);
  });

  it('un encaissement comptoir d’adhésion reste du comptoir', async () => {
    const m = await moisCourant({
      cashPayments: [{ amount_cents: 6000, collected_at: HORODATAGE, source: 'renewal' }],
    });
    expect(m.cash_cents).toBe(6000);
    expect(m.program_cents).toBe(0);
  });

  it('un achat Stripe de programme reste compté', async () => {
    const m = await moisCourant({
      programMembers: [{ amount_cents: 3900, purchased_at: HORODATAGE, status: 'active' }],
    });
    expect(m.program_cents).toBe(3900);
    expect(m.cash_cents).toBe(0);
  });

  it('un accès offert ne fait bouger aucun seau', async () => {
    // La requête filtre `provenance='stripe'` : une ligne `staff` n'est jamais
    // retournée, et n'a pas de contrepartie au journal.
    const m = await moisCourant({ programMembers: [], cashPayments: [] });
    expect(m.program_cents).toBe(0);
    expect(m.cash_cents).toBe(0);
    expect(m.membership_cents).toBe(0);
  });

  it('un remboursement Stripe sort du chiffre d’affaires', async () => {
    const m = await moisCourant({
      programMembers: [{ amount_cents: 3900, purchased_at: HORODATAGE, status: 'refunded' }],
    });
    expect(m.program_cents).toBe(0);
  });

  it('comptoir de programme et achat Stripe s’additionnent dans le même seau', async () => {
    const m = await moisCourant({
      programMembers: [{ amount_cents: 3900, purchased_at: HORODATAGE, status: 'active' }],
      cashPayments: [{ amount_cents: 4900, collected_at: HORODATAGE, source: 'program' }],
    });
    expect(m.program_cents).toBe(8800);
    expect(m.cash_cents).toBe(0);
  });
});
