// Tests pour app/api/invitations/send/route.ts
//
// La route est un relais d'envoi : le risque n'est pas qu'elle échoue, c'est
// qu'elle envoie le lien à l'adresse que l'appelant demande, ou qu'elle
// serve à un gérant d'une autre box. Les tests verrouillent ces deux points,
// plus le cas Resend 403 (domaine non vérifié) qui doit rester visible.

const invitationRow = {
  id: 'inv-1',
  box_id: 'box-1',
  email: 'invite@example.com',
  first_name: 'Nora',
  status: 'pending',
  expires_at: '2026-12-31T00:00:00.000Z',
  plan_id: 'plan-1',
};

const makeChain = (maybeSingleValue: any) => {
  const c: any = {};
  c.select = jest.fn(() => c);
  c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn().mockResolvedValue({ data: maybeSingleValue, error: null });
  return c;
};

const tableRows: Record<string, any> = {
  box_invitations: invitationRow,
  boxes: { name: 'CrossFit Test' },
  membership_plans: { name: 'Illimité', price_cents: 5900 },
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({
    from: jest.fn((table: string) => makeChain(tableRows[table] ?? null)),
  })),
  getServerUser: jest.fn(),
}));

jest.mock('@/lib/isBoxStaff', () => ({ isBoxStaff: jest.fn() }));

import { POST } from '../../app/api/invitations/send/route';
import { getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

const mockGetServerUser = getServerUser as jest.Mock;
const mockIsBoxStaff = isBoxStaff as jest.Mock;

function makeReq(body: unknown): any {
  return {
    json: jest.fn().mockResolvedValue(body),
    nextUrl: { origin: 'https://athlex.test' },
  };
}

describe('POST /api/invitations/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tableRows.box_invitations = { ...invitationRow };
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM = 'AthleX <no-reply@athlex.app>';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }) as any;
  });

  it('refuse un appel non authentifié', async () => {
    mockGetServerUser.mockResolvedValueOnce(null);
    const res: any = await POST(makeReq({ invitation_id: 'inv-1', token: 'abc' }));
    expect(res.status).toBe(401);
  });

  it('exige l’identifiant et le jeton', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    const res: any = await POST(makeReq({ invitation_id: 'inv-1' }));
    expect(res.status).toBe(400);
  });

  it('refuse un gérant qui n’administre pas la box de l’invitation', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockIsBoxStaff.mockResolvedValueOnce(false);
    const res: any = await POST(makeReq({ invitation_id: 'inv-1', token: 'abc' }));
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse une invitation qui n’est plus en attente', async () => {
    tableRows.box_invitations = { ...invitationRow, status: 'accepted' };
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockIsBoxStaff.mockResolvedValueOnce(true);
    const res: any = await POST(makeReq({ invitation_id: 'inv-1', token: 'abc' }));
    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('envoie à l’adresse de l’invitation, jamais à celle du corps de requête', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockIsBoxStaff.mockResolvedValueOnce(true);
    const res: any = await POST(makeReq({
      invitation_id: 'inv-1', token: 'jeton-brut', to: 'attaquant@example.com',
    }));

    expect(res.status).toBe(200);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.to).toBe('invite@example.com');
    expect(body.html).toContain('https://athlex.test/rejoindre/jeton-brut');
  });

  it('remonte l’échec Resend au lieu de le taire', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, status: 403, text: async () => 'The athlex.app domain is not verified',
    });
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockIsBoxStaff.mockResolvedValueOnce(true);
    const res: any = await POST(makeReq({ invitation_id: 'inv-1', token: 'jeton-brut' }));

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.sent).toBe(false);
    expect(payload.error).toContain('not verified');
  });

  it('signale l’absence de clé Resend sans prétendre avoir envoyé', async () => {
    delete process.env.RESEND_API_KEY;
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockIsBoxStaff.mockResolvedValueOnce(true);
    const res: any = await POST(makeReq({ invitation_id: 'inv-1', token: 'jeton-brut' }));
    const payload = await res.json();
    expect(payload.sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
