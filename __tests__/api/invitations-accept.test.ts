// Tests for app/api/invitations/accept/route.ts
//
// Frontière centrale : la route ne décide JAMAIS d'un rattachement. Elle relit
// l'adresse dans l'invitation (jamais celle du corps de la requête) et laisse
// les RPC du lot 1 trancher.

const makeChain = (overrides: Record<string, any> = {}) => {
  const c: any = {};
  c.select      = jest.fn(() => c);
  c.insert      = jest.fn(() => c);
  c.update      = jest.fn(() => c);
  c.upsert      = jest.fn().mockResolvedValue({ error: null });
  c.eq          = jest.fn(() => c);
  c.ilike       = jest.fn(() => c);
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null });
  Object.assign(c, overrides);
  return c;
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
  getAccessToken: jest.fn(),
}));

const mockSignUp = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { signUp: mockSignUp },
    rpc: mockAsUserRpc,
  })),
}));

const mockAsUserRpc = jest.fn();

import { POST } from '../../app/api/invitations/accept/route';
import { createServiceClient, getAccessToken } from '@/lib/supabase/server';

const mockCreateSvc = createServiceClient as jest.Mock;
const mockGetToken = getAccessToken as jest.Mock;

function makeReq(body: any): any {
  return { json: jest.fn().mockResolvedValue(body) };
}

/**
 * Client service : `rpc` scripté. Côté `from`, la recherche de pseudo (ilike)
 * ne trouve rien — le pseudo demandé est libre — tandis que la relecture du
 * profil (eq) renvoie le pseudo réellement posé en base.
 */
function svcWith(rpc: jest.Mock, profileUsername = 'Lea') {
  return {
    rpc,
    from: jest.fn(() => {
      const chain: any = makeChain();
      let lookedUpByName = false;
      chain.ilike = jest.fn(() => { lookedUpByName = true; return chain; });
      chain.maybeSingle = jest.fn(async () =>
        lookedUpByName ? { data: null } : { data: { username: profileUsername } });
      return chain;
    }),
  };
}

const INVITATION = {
  ok: true,
  email: 'lea@example.com',
  first_name: 'Léa',
  payment_mode: 'box',
  box: { name: 'CrossFit Test' },
  plan: null,
};

describe('POST /api/invitations/accept', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });
  });

  it('refuse une requête sans jeton', async () => {
    const res = await POST(makeReq({ mode: 'signup', username: 'Lea', password: 'secret1' })) as any;
    expect(res._status).toBe(400);
  });

  it('refuse un mot de passe trop court', async () => {
    const res = await POST(makeReq({ token: 'tok', username: 'Lea', password: '123' })) as any;
    expect(res._status).toBe(400);
  });

  it('crée le compte avec l’adresse DE L’INVITATION, jamais celle du corps de la requête', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: INVITATION, error: null })            // peek
      .mockResolvedValueOnce({ data: { ok: true }, error: null });         // consume_for
    mockCreateSvc.mockReturnValue(svcWith(rpc));

    const res = await POST(makeReq({
      token: 'tok', username: 'Lea', password: 'secret1',
      email: 'attaquant@example.com', // ignoré
    })) as any;

    expect(res._status).toBe(200);
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'lea@example.com' }));
    expect(rpc).toHaveBeenNthCalledWith(1, 'peek_box_invitation', { p_token: 'tok' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'consume_box_invitation_for', {
      p_token: 'tok', p_user_id: 'user-1',
    });
  });

  it('ne crée AUCUN compte quand l’invitation est refusée', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({
      data: { ok: false, reason: 'invitation_expiree' }, error: null,
    });
    mockCreateSvc.mockReturnValue(svcWith(rpc));

    const res = await POST(makeReq({ token: 'tok', username: 'Lea', password: 'secret1' })) as any;

    expect(res._status).toBe(400);
    expect(res._data?.error).toMatch(/expiré/i);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('signale l’échec du rattachement plutôt que de laisser croire à une adhésion', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ data: INVITATION, error: null })
      .mockResolvedValueOnce({ data: { ok: false, reason: 'membre_exclu' }, error: null });
    mockCreateSvc.mockReturnValue(svcWith(rpc));

    const res = await POST(makeReq({ token: 'tok', username: 'Lea', password: 'secret1' })) as any;

    expect(res._status).toBe(400);
    expect(res._data?.error).toMatch(/suspendu/i);
    expect(res._data?.error).toMatch(/compte AthleX a bien été créé/i);
  });

  it('renvoie 409 quand l’adresse invitée a déjà un compte', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: INVITATION, error: null });
    mockCreateSvc.mockReturnValue(svcWith(rpc));
    mockSignUp.mockResolvedValueOnce({ data: { user: null }, error: { message: 'User already registered' } });

    const res = await POST(makeReq({ token: 'tok', username: 'Lea', password: 'secret1' })) as any;

    expect(res._status).toBe(409);
    expect(res._data?.error).toMatch(/Connecte-toi/i);
  });

  it('mode « déjà connecté » : consomme avec le JWT du visiteur, sans nommer personne', async () => {
    mockGetToken.mockResolvedValueOnce('jwt-abc');
    mockCreateSvc.mockReturnValue(svcWith(jest.fn()));
    mockAsUserRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const res = await POST(makeReq({ token: 'tok', mode: 'existing' })) as any;

    expect(res._status).toBe(200);
    expect(mockAsUserRpc).toHaveBeenCalledWith('consume_box_invitation', { p_token: 'tok' });
    // Aucun identifiant d'utilisateur ni de box ne transite par la requête.
    expect(mockAsUserRpc.mock.calls[0][1]).toEqual({ p_token: 'tok' });
  });

  it('mode « déjà connecté » sans session : 401', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    mockCreateSvc.mockReturnValue(svcWith(jest.fn()));

    const res = await POST(makeReq({ token: 'tok', mode: 'existing' })) as any;
    expect(res._status).toBe(401);
  });

  it('mode « déjà connecté » : un compte à la mauvaise adresse est refusé par la RPC', async () => {
    mockGetToken.mockResolvedValueOnce('jwt-abc');
    mockCreateSvc.mockReturnValue(svcWith(jest.fn()));
    mockAsUserRpc.mockResolvedValueOnce({
      data: { ok: false, reason: 'email_non_correspondant' }, error: null,
    });

    const res = await POST(makeReq({ token: 'tok', mode: 'existing' })) as any;
    expect(res._status).toBe(400);
    expect(res._data?.error).toMatch(/nominative/i);
  });
});
