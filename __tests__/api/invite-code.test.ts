// Tests for app/api/box/invite-code/route.ts

const makeChain = (overrides: Record<string, any> = {}) => {
  const c: any = {};
  c.select      = jest.fn(() => c);
  c.insert      = jest.fn(() => c);
  c.update      = jest.fn(() => c);
  c.delete      = jest.fn(() => c);
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
  getServerUser:       jest.fn(),
  createClient:        jest.fn(),
  createServiceClient: jest.fn(() => ({ from: jest.fn(() => makeChain()) })),
}));

import { POST } from '../../app/api/box/invite-code/route';
import { getServerUser, createClient, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser    = getServerUser as jest.Mock;
const mockCreateClient     = createClient as jest.Mock;
const mockCreateSvcClient  = createServiceClient as jest.Mock;

function makeReq(body: any): any {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe('POST /api/box/invite-code', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when user is not authenticated', async () => {
    mockGetServerUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ invite_code: 'ABCDEF' }) as any) as any;
    expect(res._status).toBe(401);
  });

  it('returns 404 when user has no box', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: null }),
      })),
    });
    const res = await POST(makeReq({ invite_code: 'ABCDEF' }) as any) as any;
    expect(res._status).toBe(404);
  });

  it('returns 400 when invite_code is too short (< 3 chars)', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    const res = await POST(makeReq({ invite_code: 'AB' }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 400 when invite_code is empty', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    const res = await POST(makeReq({ invite_code: '' }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 400 when invite_code is missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    const res = await POST(makeReq({}) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 409 when code already used by another box', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'other-box' } }),
      })),
    });
    const res = await POST(makeReq({ invite_code: 'TAKEN1' }) as any) as any;
    expect(res._status).toBe(409);
  });

  it('returns 200 with new invite_code on success', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({ data: { invite_code: 'FREE01' }, error: null }),
      })),
    });
    const res = await POST(makeReq({ invite_code: 'free01' }) as any) as any;
    expect(res._status).toBe(200);
    expect(res._data?.invite_code).toBe('FREE01');
  });

  it('uppercases the invite_code before saving', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateClient.mockResolvedValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { id: 'box-1' } }),
      })),
    });
    mockCreateSvcClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({ data: { invite_code: 'NORD01' }, error: null }),
      })),
    });
    const res = await POST(makeReq({ invite_code: 'nord01' }) as any) as any;
    expect(res._data?.invite_code).toBe('NORD01');
  });
});
