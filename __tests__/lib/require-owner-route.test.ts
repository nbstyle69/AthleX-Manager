/**
 * Comportement de la garde elle-même : ce que la liste de routes ne peut pas
 * dire. Une garde posée sur toutes les routes mais qui laisse passer le coach
 * ferait un contrôle statique vert et une frontière ouverte.
 *
 * Le contrôle positif (le gérant n'est pas refusé) est ce qui distingue « la
 * garde refuse le coach » de « la garde refuse tout le monde ».
 */
const forbidden = jest.fn(() => {
  throw new Error('NEXT_FORBIDDEN');
});
const getActiveBox = jest.fn();

jest.mock('next/navigation', () => ({ forbidden }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
  getServerUser: jest.fn(async () => ({ id: 'u1' })),
  getActiveBox,
}));

import { requireOwnerAdminRoute, getMyRoleOnActiveBox } from '@/lib/authz/box-route';

beforeEach(() => {
  forbidden.mockClear();
  getActiveBox.mockReset();
});

describe('requireOwnerAdminRoute', () => {
  it('refuse le coach (403 serveur, pas page vide)', async () => {
    getActiveBox.mockResolvedValue({ id: 'b1', my_role: 'coach' });
    await expect(requireOwnerAdminRoute()).rejects.toThrow('NEXT_FORBIDDEN');
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it('laisse passer le gérant / co-gérant', async () => {
    getActiveBox.mockResolvedValue({ id: 'b1', my_role: 'owner' });
    await expect(requireOwnerAdminRoute()).resolves.toBeUndefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("refuse celui qui n'administre aucune box", async () => {
    getActiveBox.mockResolvedValue(null);
    await expect(requireOwnerAdminRoute()).rejects.toThrow('NEXT_FORBIDDEN');
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it('rend le titre décidé par la base, sans le recomposer', async () => {
    getActiveBox.mockResolvedValue({ id: 'b1', my_role: 'coach' });
    await expect(getMyRoleOnActiveBox()).resolves.toBe('coach');
  });
});
