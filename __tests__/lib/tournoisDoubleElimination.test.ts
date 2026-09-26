// Tournois, lot Manager PR 3 : « Tour suivant » par la base sur le dernier tour,
// tous tableaux confondus ; tableau des perdants ; grande finale et match
// décisif créés par la base (athlex-app #352, #353). Le tableau simple garde sa
// règle d'avant.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { advanceRoundAction } from '../../app/(dashboard)/tournaments/[id]/bracket/actions';
import { canAdvance, grandFinals, lastRound, loserRoundTitle, type RoundMatch } from '@/lib/tournaments/bracketRounds';
import { tournamentRefusal } from '@/lib/tournaments/refusals';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };
const M = (round: number, side: string, winner: string | null, id = `${side}-${round}-${Math.random()}`) =>
  ({ id, round, side, winner_id: winner });

function client(rpcResult: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const chain: any = { select: jest.fn(() => chain), eq: jest.fn(() => chain), maybeSingle: jest.fn(async () => ({ data: { box_id: BOX.id } })) };
  const rpc = jest.fn(async (name: string) => (name === 'is_box_admin' ? { data: true } : { data: null, error: null, ...rpcResult }));
  return { from: jest.fn(() => chain), rpc };
}
beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('advanceRoundAction : l’appel exact au serveur', () => {
  it('advance_bracket_round(tournoi, tour joué) ; nombre de matchs créés rendu tel quel', async () => {
    const c = client({ data: 3 });
    mockCreateClient.mockResolvedValue(c);
    await expect(advanceRoundAction('t-1', 4)).resolves.toEqual({ ok: true, created: 3 });
    expect(c.rpc).toHaveBeenCalledWith('advance_bracket_round', { p_tournament_id: 't-1', p_completed_round: 4 });
  });

  it('refus traduits, jamais bruts', async () => {
    mockCreateClient.mockResolvedValue(client({ error: { message: 'Round 3 has 2 unfinished matches' } }));
    await expect(advanceRoundAction('t-1', 3)).resolves.toEqual({ ok: false, error: 'Le tour 3 a encore 2 matchs à décider.' });
    mockCreateClient.mockResolvedValue(client({ error: { message: 'Not authorized: only the box owner/coach or an admin can manage this tournament' } }));
    await expect(advanceRoundAction('t-1', 3)).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });

  it('un match restant : singulier', () => {
    expect(tournamentRefusal('Round 5 has 1 unfinished matches')).toBe('Le tour 5 a encore 1 match à décider.');
  });
});

describe('dernier tour, tous tableaux confondus (double élimination)', () => {
  // Tableau des gagnants fini au tour 2, perdants jusqu'au tour 4, grande finale au tour 5.
  const swiss: RoundMatch[] = [
    M(1, 'winner', 'a'), M(1, 'winner', 'c'), M(2, 'winner', 'a'),
    M(2, 'loser', 'b'), M(3, 'loser', 'b'), M(4, 'loser', 'c'),
  ];
  it('swiss : le plus grand tour, tous côtés ; bracket : le tableau des gagnants seul', () => {
    expect(lastRound(swiss, 'swiss')).toBe(4);
    expect(lastRound([...swiss, M(5, 'grand_final', null)], 'swiss')).toBe(5);
    expect(lastRound(swiss, 'bracket')).toBe(2);
    expect(lastRound([], 'swiss')).toBeNull();
  });

  it('swiss : « Tour suivant » quand le dernier tour est décidé, pas avant', () => {
    expect(canAdvance(swiss, 'swiss')).toBe(true);
    expect(canAdvance([...swiss, M(5, 'loser', null)], 'swiss')).toBe(false);
  });

  it('swiss : le bouton reste après la grande finale (match décisif), disparaît après lui', () => {
    expect(canAdvance([...swiss, M(5, 'grand_final', null)], 'swiss')).toBe(false);
    expect(canAdvance([...swiss, M(5, 'grand_final', 'c')], 'swiss')).toBe(true);
    expect(canAdvance([...swiss, M(5, 'grand_final', 'c'), M(6, 'grand_final', 'a')], 'swiss')).toBe(false);
  });

  it('bracket simple inchangé : pas après la finale, pas avec un match en attente', () => {
    expect(canAdvance([M(1, 'winner', 'a'), M(1, 'winner', 'b')], 'bracket')).toBe(true);
    expect(canAdvance([M(1, 'winner', 'a'), M(1, 'winner', null)], 'bracket')).toBe(false);
    expect(canAdvance([M(1, 'winner', 'a'), M(1, 'winner', 'b'), M(2, 'winner', 'a')], 'bracket')).toBe(false);
  });
});

describe('affichage', () => {
  it('grandes finales par tour croissant : « Grande finale », puis « Grande finale — match décisif »', () => {
    const rows = [M(6, 'grand_final', null, 'decisif'), M(2, 'winner', 'a'), M(5, 'grand_final', 'c', 'gf')];
    expect(grandFinals(rows).map(g => [g.match.id, g.title])).toEqual([
      ['gf', 'Grande finale'], ['decisif', 'Grande finale — match décisif'],
    ]);
    expect(grandFinals([M(1, 'winner', 'a')])).toEqual([]);
  });

  it('tableau des perdants numéroté depuis 1', () => {
    expect([0, 1, 2].map(loserRoundTitle)).toEqual(['Tour 1 des perdants', 'Tour 2 des perdants', 'Tour 3 des perdants']);
  });

  it('branchements du tableau', () => {
    const bm = read('components/tournaments/BracketManager.tsx');
    // « Décider » et « Tour suivant » : le même dernier tour, tous tableaux confondus en double élimination.
    expect(bm.match(/const lastR = lastRound\(matches, format\);/g)).toHaveLength(2);
    expect(bm).toContain("const lastMatches = matches.filter(m => m.round === lastR && (format === 'swiss' || m.side === 'winner'));");
    expect(bm).toContain('if (lastR == null || !canAdvance(matches, format)) return null;');
    expect(bm).toContain('<button onClick={() => advanceRound(lastR)}');
    expect(bm).toContain('<RoundColumn key={`l-${r}`} title={loserRoundTitle(i)}');
    expect(bm).toContain('{isBye && <span className="text-ax-warning font-bold">Exempté</span>}');
    expect(bm).toMatch(/\{format === 'swiss' && grandFinals\(matches\)\.length > 0 && \([\s\S]*?\{grandFinals\(matches\)\.map\(\(\{ match, title \}\) => \(/);
    expect(bm).toContain("? 'Aucun nouveau match : le tour suivant existe déjà, ou le tableau est terminé.'");
  });
});

describe('plus aucune création de grande finale côté Manager', () => {
  it('ni action, ni bouton, ni insertion d’une ligne grand_final', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
    const hits = ['app', 'components', 'lib'].flatMap(r => walk(join(process.cwd(), r)))
      .filter(f => /createGrandFinalAction|Créer la grande finale|side: 'grand_final'/.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(process.cwd(), ''));
    expect(hits).toEqual([]);
  });
});
