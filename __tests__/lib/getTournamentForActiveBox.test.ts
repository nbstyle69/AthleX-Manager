// Tests pour lib/tournaments/getTournamentForActiveBox.ts
//
// La faille corrigée : les pages tournoi lisent en `service_role`, qui ignore
// la RLS. Le contrôle d'appartenance arrivait après les requêtes (classement,
// scores) ou manquait sur des tables sans `tournament_id`
// (`tournament_division_members`, lu en entier puis trié en mémoire).

/** `notFound()` de Next lève : on reproduit ce comportement pour l'observer. */
class NotFound extends Error {
  constructor() { super('NEXT_NOT_FOUND'); this.name = 'NotFound'; }
}
const mockNotFound = jest.fn(() => { throw new NotFound(); });
jest.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));

const mockCreateClient = jest.fn();
const mockCreateServiceClient = jest.fn(() => ({ tag: 'service' }));
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createServiceClient: () => mockCreateServiceClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { divisionIdsOf, getTournamentForActiveBox } from '@/lib/tournaments/getTournamentForActiveBox';

const BOX = { id: 'box-active', name: 'AthleX Fitness' };
const AUTRE_BOX = 'box-voisine';

/**
 * Client utilisateur minimal : rend le tournoi seulement si les deux filtres
 * `id` et `box_id` correspondent, exactement comme la requête réelle.
 */
function userClient(tournois: { id: string; box_id: string; name?: string }[]) {
  const filtres: Record<string, string> = {};
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: string) => { filtres[col] = val; return chain; }),
    maybeSingle: jest.fn(async () => ({
      data: tournois.find(t => t.id === filtres.id && t.box_id === filtres.box_id) ?? null,
    })),
  };
  return { from: jest.fn(() => chain), _filtres: filtres, _chain: chain };
}

beforeEach(() => jest.clearAllMocks());

describe('getTournamentForActiveBox', () => {
  it('rend le tournoi de la box active', async () => {
    const uc = userClient([{ id: 't-1', box_id: BOX.id, name: 'Open box' }]);
    mockCreateClient.mockResolvedValue(uc);
    mockGetActiveBox.mockResolvedValue(BOX);

    const res = await getTournamentForActiveBox<{ id: string; name: string }>('t-1');

    expect(res.tournament.name).toBe('Open box');
    expect(res.box).toEqual({ id: BOX.id, name: BOX.name });
    expect(mockNotFound).not.toHaveBeenCalled();
    // Les deux filtres sont posés côté base, pas vérifiés après coup.
    expect(uc._filtres).toEqual({ id: 't-1', box_id: BOX.id });
  });

  it('refuse un tournoi d’une AUTRE box, sans rien rendre', async () => {
    const uc = userClient([{ id: 't-voisin', box_id: AUTRE_BOX, name: 'Secret' }]);
    mockCreateClient.mockResolvedValue(uc);
    mockGetActiveBox.mockResolvedValue(BOX);

    await expect(getTournamentForActiveBox('t-voisin')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('refuse un utilisateur sans box active, sans interroger les tournois', async () => {
    const uc = userClient([{ id: 't-1', box_id: BOX.id }]);
    mockCreateClient.mockResolvedValue(uc);
    mockGetActiveBox.mockResolvedValue(null);

    await expect(getTournamentForActiveBox('t-1')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(uc.from).not.toHaveBeenCalled();
  });

  it('répond pareil pour un tournoi inexistant et pour celui d’une autre box', async () => {
    // Deux réponses différentes diraient lequel des deux cas s'applique.
    mockGetActiveBox.mockResolvedValue(BOX);
    mockCreateClient.mockResolvedValue(userClient([]));
    await expect(getTournamentForActiveBox('t-inconnu')).rejects.toThrow('NEXT_NOT_FOUND');
    mockCreateClient.mockResolvedValue(userClient([{ id: 't-x', box_id: AUTRE_BOX }]));
    await expect(getTournamentForActiveBox('t-x')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledTimes(2);
  });

  it('ne crée le client privilégié qu’APRÈS le contrôle', async () => {
    mockCreateClient.mockResolvedValue(userClient([{ id: 't-x', box_id: AUTRE_BOX }]));
    mockGetActiveBox.mockResolvedValue(BOX);

    await expect(getTournamentForActiveBox('t-x')).rejects.toThrow('NEXT_NOT_FOUND');
    // Le défaut d'origine : les lectures `service_role` partaient avant le
    // contrôle. Sur un refus, le client privilégié ne doit pas même exister.
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it('lit le tournoi avec le client UTILISATEUR : la RLS reste une seconde barrière', async () => {
    const uc = userClient([{ id: 't-1', box_id: BOX.id }]);
    mockCreateClient.mockResolvedValue(uc);
    mockGetActiveBox.mockResolvedValue(BOX);

    await getTournamentForActiveBox('t-1');

    expect(uc.from).toHaveBeenCalledWith('tournaments');
    const svcClient = mockCreateServiceClient.mock.results[0]?.value;
    expect(svcClient).toEqual({ tag: 'service' });
  });

  it('ne charge que les colonnes demandées', async () => {
    const uc = userClient([{ id: 't-1', box_id: BOX.id }]);
    mockCreateClient.mockResolvedValue(uc);
    mockGetActiveBox.mockResolvedValue(BOX);

    await getTournamentForActiveBox('t-1', 'name, box_id');
    expect(uc._chain.select).toHaveBeenCalledWith('name, box_id');
  });
});

describe('divisionIdsOf', () => {
  it('borne les divisions au tournoi validé', async () => {
    const filtres: Record<string, string> = {};
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn((c: string, v: string) => { filtres[c] = v; return chain; }),
      then: (r: Function) => Promise.resolve({ data: [{ id: 'd-1' }, { id: 'd-2' }] }).then(r as any),
    };
    const svc: any = { from: jest.fn(() => chain) };

    await expect(divisionIdsOf(svc, 't-1')).resolves.toEqual(['d-1', 'd-2']);
    expect(svc.from).toHaveBeenCalledWith('tournament_divisions');
    expect(filtres).toEqual({ tournament_id: 't-1' });
  });

  it('rend un tableau vide quand le tournoi n’a pas de division', async () => {
    const chain: any = {
      select: jest.fn(() => chain), eq: jest.fn(() => chain),
      then: (r: Function) => Promise.resolve({ data: null }).then(r as any),
    };
    await expect(divisionIdsOf({ from: () => chain } as any, 't-1')).resolves.toEqual([]);
  });
});
