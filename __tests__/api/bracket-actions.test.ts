// Tests pour app/(dashboard)/tournaments/[id]/bracket/actions.ts
//
// Les actions du tableau écrivent avec le client de l'utilisateur (RLS), mais
// elles autorisaient sur la box DU TOURNOI, pas sur la box ACTIVE : un gérant
// de plusieurs box pouvait écrire sur l'une en travaillant dans l'autre.

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import {
  setMatchWinnerAction, regenerateBracketAction, generateRound1Action,
} from '../../app/(dashboard)/tournaments/[id]/bracket/actions';

const BOX = { id: 'box-active', name: 'AthleX Fitness' };
const AUTRE_BOX = 'box-voisine';

/**
 * Client utilisateur : `tournaments` ne rend la ligne que si `id` ET `box_id`
 * correspondent. `update` / `delete` / `rpc` sont observés pour prouver
 * qu'aucune écriture ne part sur un refus.
 */
function client(tournois: { id: string; box_id: string }[]) {
  const filtres: Record<string, string> = {};
  const update = jest.fn(() => tail);
  const del = jest.fn(() => tail);
  const insert = jest.fn(async () => ({ error: null }));
  const tail: any = {
    eq: jest.fn(() => tail),
    then: (r: Function) => Promise.resolve({ error: null }).then(r as any),
  };
  const tournamentsChain: any = {
    select: jest.fn(() => tournamentsChain),
    eq: jest.fn((c: string, v: string) => { filtres[c] = v; return tournamentsChain; }),
    maybeSingle: jest.fn(async () => ({
      data: tournois.find(t => t.id === filtres.id && t.box_id === filtres.box_id) ?? null,
    })),
  };
  const matchesChain: any = { update, delete: del, insert };
  const rpc = jest.fn(async (name: string) => (name === 'is_box_admin' ? { data: true } : { error: null }));
  return {
    from: jest.fn((table: string) => (table === 'tournaments' ? tournamentsChain : matchesChain)),
    rpc, _update: update, _delete: del, _rpc: rpc, _filtres: filtres,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('actions du tableau — la box active borne l’écriture', () => {
  it('refuse un tournoi d’une autre box, sans écrire', async () => {
    const c = client([{ id: 't-voisin', box_id: AUTRE_BOX }]);
    mockCreateClient.mockResolvedValue(c);
    mockGetActiveBox.mockResolvedValue(BOX);

    const res = await setMatchWinnerAction('t-voisin', 'm-1', 'a-1', 'a-2');

    expect(res).toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(c._update).not.toHaveBeenCalled();
    // Le rôle n'est même pas interrogé : la box active tranche avant.
    expect(c._rpc).not.toHaveBeenCalled();
  });

  it('refuse une régénération sur un tournoi d’une autre box, sans rien supprimer', async () => {
    const c = client([{ id: 't-voisin', box_id: AUTRE_BOX }]);
    mockCreateClient.mockResolvedValue(c);
    mockGetActiveBox.mockResolvedValue(BOX);

    const res = await regenerateBracketAction('t-voisin');

    expect(res).toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(c._delete).not.toHaveBeenCalled();
    expect(c._rpc).not.toHaveBeenCalled();
  });

  it('refuse sans box active', async () => {
    const c = client([{ id: 't-1', box_id: BOX.id }]);
    mockCreateClient.mockResolvedValue(c);
    mockGetActiveBox.mockResolvedValue(null);

    const res = await generateRound1Action('t-1');

    expect(res).toEqual({ ok: false, error: 'Aucune box active.' });
    expect(c.from).not.toHaveBeenCalled();
  });

  it('laisse passer un tournoi de la box active', async () => {
    const c = client([{ id: 't-1', box_id: BOX.id }]);
    mockCreateClient.mockResolvedValue(c);
    mockGetActiveBox.mockResolvedValue(BOX);

    const res = await setMatchWinnerAction('t-1', 'm-1', 'a-1', 'a-2');

    expect(res).toEqual({ ok: true });
    expect(c._update).toHaveBeenCalledTimes(1);
    expect(c._filtres).toEqual({ id: 't-1', box_id: BOX.id });
  });

  it('refuse encore un gérant qui n’a pas le rôle sur la box active', async () => {
    // La box active dit SUR QUOI on travaille ; le rôle dit si on peut écrire.
    const c = client([{ id: 't-1', box_id: BOX.id }]);
    c.rpc.mockResolvedValue({ data: false } as any);
    mockCreateClient.mockResolvedValue(c);
    mockGetActiveBox.mockResolvedValue(BOX);

    const res = await setMatchWinnerAction('t-1', 'm-1', 'a-1', 'a-2');

    expect(res.ok).toBe(false);
    expect(c._update).not.toHaveBeenCalled();
  });
});
