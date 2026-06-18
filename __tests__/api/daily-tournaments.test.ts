// Tests for app/api/admin/daily-tournaments/route.ts

const makeChain = (overrides: Record<string, any> = {}) => {
  const c: any = {};
  c.select      = jest.fn(() => c);
  c.insert      = jest.fn(() => c);
  c.update      = jest.fn(() => c);
  c.delete      = jest.fn(() => c);
  c.upsert      = jest.fn(() => c);
  c.eq          = jest.fn(() => c);
  c.neq         = jest.fn(() => c);
  c.in          = jest.fn(() => c);
  c.order       = jest.fn(() => c);
  c.then        = (resolve: Function) => Promise.resolve({ data: null, error: null }).then(resolve as any);
  c.catch       = (reject: Function) => Promise.resolve({ data: null, error: null }).catch(reject as any);
  c.single      = jest.fn().mockResolvedValue({ data: null, error: null });
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null });
  Object.assign(c, overrides);
  return c;
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: jest.fn(() => makeChain()) })),
  getServerUser: jest.fn(),
}));

jest.mock('@/lib/elo', () => ({ K_PAIRWISE: 64 }));

import { PATCH, DELETE } from '../../app/api/admin/daily-tournaments/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser    = getServerUser as jest.Mock;
const mockCreateSvcClient  = createServiceClient as jest.Mock;

function makeReq(body: any, url = 'http://localhost/api/admin/daily-tournaments'): any {
  return { json: jest.fn().mockResolvedValue(body), url };
}

describe('PATCH /api/admin/daily-tournaments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({}) as any) as any;
    expect(res._status).toBe(403);
  });

  it('returns 403 when user is not admin', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'member' } }),
      })),
    });
    const res = await PATCH(makeReq({ action: 'cancel', tournament_id: 'tid' }) as any) as any;
    expect(res._status).toBe(403);
  });

  it('action=cancel marks tournament as cancelled', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    const updateFn = jest.fn(() => c);
    const c: any = makeChain({
      single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
    });
    mockCreateSvcClient.mockReturnValue({ from: jest.fn(() => c) });

    const res = await PATCH(makeReq({ action: 'cancel', tournament_id: 't-1' }) as any) as any;
    expect(res._data?.ok).toBe(true);
    expect(res._status).toBe(200);
  });

  it('action=update_score_status returns 400 when score_id missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
      })),
    });
    const res = await PATCH(makeReq({
      action: 'update_score_status',
      status: 'validated',
    }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('action=update_score_value returns 400 when score_value missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
      })),
    });
    const res = await PATCH(makeReq({
      action: 'update_score_value',
      score_id: 'score-1',
    }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('unknown action returns 400', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    const res = await PATCH(makeReq({ action: 'unknown_action' }) as any) as any;
    expect(res._status).toBe(400);
    expect(res._data?.error).toBeTruthy();
  });
});

describe('DELETE /api/admin/daily-tournaments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when not authenticated', async () => {
    mockGetServerUser.mockResolvedValueOnce(null);
    const req = makeReq(null, 'http://localhost/api/admin/daily-tournaments?id=t-1');
    const res = await DELETE(req as any) as any;
    expect(res._status).toBe(403);
  });

  it('returns 400 when id is missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    const req = makeReq(null, 'http://localhost/api/admin/daily-tournaments');
    const res = await DELETE(req as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 200 on successful delete', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateSvcClient
      .mockReturnValueOnce({
        from: jest.fn(() => makeChain({
          single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
        })),
      })
      .mockReturnValueOnce({
        from: jest.fn(() => makeChain({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      });
    const req = makeReq(null, 'http://localhost/api/admin/daily-tournaments?id=t-1');
    const res = await DELETE(req as any) as any;
    expect(res._data?.ok).toBe(true);
  });
});
