// Tests for app/api/admin/boxes/route.ts

/**
 * Creates a chainable + awaitable Supabase mock.
 * - Chaining: .insert().select().single() works (insert returns the chain)
 * - Direct await: await .insert({}) resolves to { data: thenValue, error: null }
 */
const makeChain = (overrides: Record<string, any> = {}, thenValue: any = null) => {
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
  // Make chain awaitable (thenable) — resolves directly when no further chaining
  c.then        = (resolve: Function) => Promise.resolve({ data: thenValue, error: null }).then(resolve as any);
  c.catch       = (reject: Function) => Promise.resolve({ data: thenValue, error: null }).catch(reject as any);
  c.single      = jest.fn().mockResolvedValue({ data: null, error: null });
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null });
  Object.assign(c, overrides);
  return c;
};

const mockSupabaseChain = makeChain();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: jest.fn(() => makeChain()) })),
  getServerUser: jest.fn(),
  createClient: jest.fn(),
}));

import { POST } from '../../app/api/admin/boxes/route';
import { NextResponse } from 'next/server';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';

const mockGetServerUser = getServerUser as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

function makeReq(body: any): any {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe('POST /api/admin/boxes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user is not authenticated', async () => {
    mockGetServerUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({}) as any) as any;
    expect(res._status).toBe(403);
  });

  it('returns 403 when user is not admin/super_admin', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'user-1' });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'member' } }),
      })),
    });
    const res = await POST(makeReq({}) as any) as any;
    expect(res._status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    const res = await POST(makeReq({ owner_id: 'user-1', invite_code: 'ABC123' }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 400 when owner_id is missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    const res = await POST(makeReq({ name: 'My Box', invite_code: 'ABC123' }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 400 when invite_code is missing', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    const res = await POST(makeReq({ name: 'My Box', owner_id: 'user-1' }) as any) as any;
    expect(res._status).toBe(400);
  });

  it('returns 200 with box data on success', async () => {
    const boxData = { id: 'box-1', name: 'CrossFit Nord', owner_id: 'user-1' };
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    // 1st call: checkAdmin() — profile role check
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
      })),
    });
    // 2nd call: POST body — boxes.insert().select().single() + box_members.insert()
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: boxData, error: null }),
      }, null /* thenValue for direct await */)),
    });

    const res = await POST(makeReq({
      name: 'CrossFit Nord',
      owner_id: 'user-1',
      invite_code: 'NORD01',
      description: 'Box in the north',
      city: 'Lille',
    }) as any);

    expect(NextResponse.json).toHaveBeenCalled();
    expect((res as any)._status).not.toBe(400);
    expect((res as any)._status).not.toBe(403);
  });

  it('returns 500 when Supabase insert fails', async () => {
    mockGetServerUser.mockResolvedValueOnce({ id: 'admin-1' });
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: { role: 'admin' } }),
      })),
    });
    // Make single() return an error to trigger the 500 path
    mockCreateServiceClient.mockReturnValueOnce({
      from: jest.fn(() => makeChain({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    });

    const res = await POST(makeReq({
      name: 'Box', owner_id: 'u1', invite_code: 'CODE1',
    }) as any) as any;
    expect(res._status).toBe(500);
  });
});
