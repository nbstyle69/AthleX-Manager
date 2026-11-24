// #443 — le corps d'erreur de Resend (qui peut citer l'adresse du destinataire
// ou la configuration du domaine) n'est ni journalisé ni renvoyé au navigateur :
// relance d'impayé (journal), invitation et séance d'essai (réponse).

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({})) }));
jest.mock('@/lib/supabase/server', () => ({ getServerUser: jest.fn(), createServiceClient: jest.fn() }));

const rpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc,
    from: () => {
      const c: any = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: null, error: null }) };
      return c;
    },
  })),
}));

import { POST as dunning } from '../../app/api/dunning/route';
import { POST as sendInvitation } from '../../app/api/invitations/send/route';
import { POST as bookTrial } from '../../app/api/trial/book/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const ADDRESS = 'membre.prive@exemple.fr';
const RESEND_BODY = JSON.stringify({
  statusCode: 422, name: 'validation_error', message: `Invalid \`to\` field: ${ADDRESS} (domain athlex.app is not verified)`,
});

let fetchSpy: jest.SpyInstance;
let logs: jest.SpyInstance[];
const journal = () => JSON.stringify(logs.flatMap(s => s.mock.calls));

const expectNoLeak = (text: string) => {
  expect(text).not.toContain(ADDRESS);
  expect(text).not.toContain('validation_error');
  expect(text).not.toContain('not verified');
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 're_dummy';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique';
  (getServerUser as jest.Mock).mockResolvedValue({ id: 'owner-1' });
  (createServiceClient as jest.Mock).mockReturnValue(fakeSupabase({
    boxes: [{ id: 'box-1', owner_id: 'owner-1', name: 'AthleX Fitness', contact_email: null, stripe_account_id: 'acct_1' }],
    box_members: [{ id: 'bm-1', box_id: 'box-1', member_id: 'ath-1', subscription_status: 'past_due', amount_cents: 5900, stripe_subscription_id: 'sub_1' }],
    profiles: [{ id: 'ath-1', email: ADDRESS }],
    box_invitations: [{ id: 'inv-1', box_id: 'box-1', email: ADDRESS, first_name: 'Nora', status: 'pending', expires_at: '2026-12-31T00:00:00Z', plan_id: null }],
  }).client);
  fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, status: 422, text: async () => RESEND_BODY, json: async () => JSON.parse(RESEND_BODY) } as any);
  logs = (['error', 'warn', 'log', 'info'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  fetchSpy.mockRestore();
  logs.forEach(s => s.mockRestore());
});

const refOf = (text: string) => text.match(/ref=([0-9a-f-]{36})/)?.[1];

it('relance d’impayé : le journal garde le statut et un identifiant, ni le corps ni l’adresse', async () => {
  const res: any = await dunning({ json: async () => ({ box_member_id: 'bm-1', action: 'remind' }) } as any);
  expect(res.status).toBe(502);
  const body = JSON.stringify(await res.json());
  expect(body).toContain('Envoi de la relance impossible.');
  expectNoLeak(body);
  expect(journal()).toContain('dunning resend error');
  expect(journal()).toContain('422');
  expect(refOf(journal())).toBeTruthy();
  expectNoLeak(journal());
});

it('invitation : message générique au navigateur, identifiant de corrélation identique à celui du journal', async () => {
  const res: any = await sendInvitation({ json: async () => ({ invitation_id: 'inv-1', token: 'jeton' }) } as any);
  const payload = await res.json();
  expect(payload).toMatchObject({
    sent: false,
    error: "L'e-mail d'invitation n'est pas parti. Partage le QR code ou le lien, ou réessaie plus tard.",
  });
  expectNoLeak(JSON.stringify(payload));
  expect(journal()).toContain('invitation resend error');
  expect(journal()).toContain('422');
  expect(payload.ref).toBe(refOf(journal()));
  expectNoLeak(journal());
});

it('séance d’essai (visiteur sans compte) : la place reste prise, message générique, rien de Resend', async () => {
  rpc.mockResolvedValue({
    data: {
      ok: true, prospect_id: 'pros-1', reservation_id: 'res-1', plan: { id: 'plan-1', name: 'Découverte' },
      slot: { schedule_id: 'sch-1', title: 'WOD 18h', scheduled_date: '2026-11-02', start_time: '18:00:00', end_time: null },
    },
    error: null,
  });
  const res: any = await bookTrial({
    headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }),
    json: async () => ({ box_id: 'box-1', schedule_id: 'sch-1', first_name: 'Jean', email: ADDRESS }),
  } as any);
  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload).toMatchObject({ ok: true, email_sent: false, email_error: "La confirmation par e-mail n'a pas pu être envoyée." });
  expectNoLeak(JSON.stringify(payload));
  expect(journal()).toContain('trial-booking resend error');
  expect(refOf(journal())).toBeTruthy();
  expectNoLeak(journal());
});
