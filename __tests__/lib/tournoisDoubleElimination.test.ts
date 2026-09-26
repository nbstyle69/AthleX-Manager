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

import { advanceRoundAction, assignStageWodAction } from '../../app/(dashboard)/tournaments/[id]/bracket/actions';
import { canAdvance, decideRoundWodId, grandFinals, lastRound, loserRoundTitle, matchPlace, matchWodId, type RoundMatch } from '@/lib/tournaments/bracketRounds';
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

describe('WOD des matchs (correction du repli des perdants)', () => {
  // Étapes : tour 1 → WOD « w-quart », tour 2 → « w-demi ».
  const stage = (r: number) => ({ 1: 'w-quart', 2: 'w-demi' } as Record<number, string>)[r];
  const mk = (side: string, round: number, wod_id: string | null = null) => ({ side, round, wod_id });

  it('un match des perdants n’utilise jamais le WOD des gagnants du même tour', () => {
    expect(matchWodId(mk('loser', 2), 'swiss', stage)).toBeUndefined();
    expect(matchWodId(mk('loser', 2, 'w-perdants'), 'swiss', stage)).toBe('w-perdants');
  });

  it('un match des gagnants garde le WOD de son étape (ou le sien)', () => {
    expect(matchWodId(mk('winner', 2), 'swiss', stage)).toBe('w-demi');
    expect(matchWodId(mk('winner', 1, 'w-propre'), 'swiss', stage)).toBe('w-propre');
  });

  it('grande finale et match décisif inchangés : leur WOD choisi, sinon aucun', () => {
    expect(matchWodId(mk('grand_final', 2, 'w-finale'), 'swiss', stage)).toBe('w-finale');
    expect(matchWodId(mk('grand_final', 2), 'swiss', stage)).toBeUndefined();
  });

  it('bracket simple inchangé : repli sur l’étape du tour, WOD de tour envoyé à la base', () => {
    expect(matchWodId(mk('winner', 1), 'bracket', stage)).toBe('w-quart');
    expect(matchWodId(mk('third_place', 2), 'bracket', stage)).toBe('w-demi');
    expect(decideRoundWodId('bracket', 'w-demi')).toBe('w-demi');
  });

  it('double élimination : aucun WOD de tour envoyé à la base', () => {
    expect(decideRoundWodId('swiss', 'w-demi')).toBeNull();
  });

  it('écriture du WOD de l’étape sur les matchs des gagnants non joués et sans WOD du tour, côté serveur', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const upd: any = {};
    ['eq', 'is'].forEach(k => (upd[k] = jest.fn((...a: unknown[]) => { calls.push([k, ...a]); return upd; })));
    upd.then = (r: Function) => Promise.resolve({ error: null }).then(r as any);
    const chain: any = { select: jest.fn(() => chain), eq: jest.fn(() => chain), maybeSingle: jest.fn(async () => ({ data: { box_id: BOX.id } })) };
    const update = jest.fn(() => upd);
    const c = {
      from: jest.fn((t: string) => (t === 'tournaments' ? chain : { update })),
      rpc: jest.fn(async () => ({ data: true })),
    };
    mockCreateClient.mockResolvedValue(c);
    await expect(assignStageWodAction('t-1', 2, 'w-demi')).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ wod_id: 'w-demi' });
    expect(calls).toEqual([
      ['eq', 'tournament_id', 't-1'], ['eq', 'round', 2], ['eq', 'side', 'winner'], ['is', 'wod_id', null], ['is', 'winner_id', null],
    ]);
  });

  it('motif sans ambiguïté : la colonne d’un match des perdants ou d’une grande finale, rien pour les gagnants ni en élimination simple', () => {
    const rows = [
      { id: 'w', round: 3, side: 'winner', winner_id: null }, { id: 'l2', round: 2, side: 'loser', winner_id: 'x' },
      { id: 'l3', round: 3, side: 'loser', winner_id: null }, { id: 'gf', round: 5, side: 'grand_final', winner_id: 'x' },
      { id: 'gf2', round: 6, side: 'grand_final', winner_id: null },
    ];
    expect(matchPlace(rows[0], rows, 'swiss')).toBeNull();
    expect(matchPlace(rows[2], rows, 'swiss')).toBe('Tour 2 des perdants');
    expect(matchPlace(rows[4], rows, 'swiss')).toBe('Grande finale — match décisif');
    expect(matchPlace(rows[2], rows, 'bracket')).toBeNull();
    expect(read('components/tournaments/BracketManager.tsx'))
      .toContain("{matchPlace(m, matches, format) ? `${matchPlace(m, matches, format)} · ` : ''}Match #{m.match_number} · {MOTIF_TEXT[decision.motifs[m.id]]}");
  });

  it('branchements : repli par matchWodId ; en double élimination, écriture puis décision sans WOD de tour', () => {
    const bm = read('components/tournaments/BracketManager.tsx');
    expect(bm).toContain('const id = matchWodId(match, format, r => wodForRound(r)?.id);');
    const decide = bm.slice(bm.indexOf('async function decideRound('), bm.indexOf('function askGenerateRound1()'));
    expect(decide).toMatch(/if \(format === 'swiss' && stageWodId\) \{\s*const assigned = await assignStageWodAction\(tournamentId, round, stageWodId\);/);
    expect(decide.indexOf('assignStageWodAction(')).toBeLessThan(decide.indexOf('decideRoundAction('));
    expect(decide).toContain('decideRoundAction(tournamentId, round, decideRoundWodId(format, stageWodId))');
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
