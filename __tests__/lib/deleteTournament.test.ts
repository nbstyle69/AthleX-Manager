// Tests pour lib/tournaments/deleteTournament.ts.
//
// Le défaut corrigé : `router.push('/tournaments')` puis `router.refresh()`
// rechargeait la route du tournoi supprimé (404), et un refus silencieux de la
// RLS faisait quitter la page comme si le tournoi avait disparu.

import { ARCHIVE_INSTEAD, deleteTournamentAndLeave, NOT_DELETED } from '@/lib/tournaments/deleteTournament';
import { GENERIC_REFUSAL } from '@/lib/tournaments/refusals';

function client(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const calls: { table?: string; eq?: [string, string]; select?: string } = {};
  const c = {
    from: jest.fn((table: string) => {
      calls.table = table;
      return {
        delete: () => ({
          eq: (col: string, value: string) => {
            calls.eq = [col, value];
            return { select: async (cols: string) => { calls.select = cols; return result; } };
          },
        }),
      };
    }),
  };
  return { c: c as any, calls };
}

/** Un routeur qui enregistre tout : `push` et `refresh` ne doivent plus servir. */
function router() {
  return { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
}

describe('deleteTournamentAndLeave', () => {
  it('succès : supprime ce tournoi, remplace la route par la liste, sans rafraîchir', async () => {
    const { c, calls } = client({ data: [{ id: 't-1' }], error: null });
    const r = router();

    await expect(deleteTournamentAndLeave(c, 't-1', r)).resolves.toBeNull();

    expect(calls).toEqual({ table: 'tournaments', eq: ['id', 't-1'], select: 'id' });
    expect(r.replace).toHaveBeenCalledTimes(1);
    expect(r.replace).toHaveBeenCalledWith('/tournaments');
    // Le défaut : refresh() rechargeait la route supprimée, qui répond 404.
    expect(r.refresh).not.toHaveBeenCalled();
    expect(r.push).not.toHaveBeenCalled();
  });

  it('erreur de la base sans code : message générique en français (jamais le texte brut), ne quitte pas la page', async () => {
    const { c } = client({ data: null, error: { message: 'violates foreign key constraint' } });
    const r = router();

    await expect(deleteTournamentAndLeave(c, 't-1', r)).resolves.toBe(GENERIC_REFUSAL);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it('résultats validés (TOURNOI_AVEC_RESULTATS) : propose l’archivage, ne quitte pas la page', async () => {
    const { c } = client({ data: null, error: { message: 'TOURNOI_AVEC_RESULTATS: ce tournoi a des résultats validés (score validé) et ne peut pas être supprimé. Archive-le à la place : son ELO et ses résultats sont conservés.' } });
    const r = router();

    await expect(deleteTournamentAndLeave(c, 't-1', r)).resolves.toBe(ARCHIVE_INSTEAD);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it('refus silencieux (RLS, aucune ligne supprimée) : c’est un échec, pas un succès', async () => {
    const { c } = client({ data: [], error: null });
    const r = router();

    await expect(deleteTournamentAndLeave(c, 't-1', r)).resolves.toBe(NOT_DELETED);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it('réponse sans données : même traitement qu’un refus', async () => {
    const { c } = client({ data: null, error: null });
    const r = router();

    await expect(deleteTournamentAndLeave(c, 't-1', r)).resolves.toBe(NOT_DELETED);
    expect(r.replace).not.toHaveBeenCalled();
  });
});
