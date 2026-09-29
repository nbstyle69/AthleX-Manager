// Tournois, lot Manager priorité 3 : forfait (#355), petite finale (#356),
// classement du tableau lu de la base, garde unique des actions du tableau.
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import * as actions from '../../app/(dashboard)/tournaments/[id]/bracket/actions';
import { forfeitBody, forfeitPatch, forfeitRefusal, isDecided } from '@/lib/tournaments/forfeit';
import { THIRD_PLACE_LOCKED_HINT, THIRD_PLACE_TITLE, matchPlace, thirdPlaceLocked } from '@/lib/tournaments/bracketRounds';
import { initialTournamentForm, tournamentUpdatePayload } from '@/lib/tournamentForm';
import { bracketPlacement, generalFromBracket } from '@/lib/tournaments/standings';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };
const MATCH = { participant1_id: 'a', participant2_id: 'b', status: 'active' };

function client(opts: {
  owned?: boolean; admin?: boolean;
  match?: Record<string, unknown> | null;
  updated?: { id: string }[];
  updateError?: { message: string; code?: string } | null;
} = {}) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = jest.fn((table: string) => {
    const chain: any = {};
    for (const op of ['select', 'eq', 'in', 'is', 'update', 'delete']) {
      chain[op] = jest.fn((...args: unknown[]) => { calls.push([table, op, args]); return chain; });
    }
    chain.maybeSingle = jest.fn(async () => (table === 'tournaments'
      ? { data: opts.owned === false ? null : { box_id: BOX.id } }
      : { data: opts.match === undefined ? MATCH : opts.match }));
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: opts.updated ?? [{ id: 'm1' }], error: opts.updateError ?? null });
    return chain;
  });
  const rpc = jest.fn(async (name: string) => (name === 'is_box_admin' ? { data: opts.admin !== false } : { data: 0, error: null }));
  return { from, rpc, calls };
}
const writes = (c: ReturnType<typeof client>) => c.calls.filter(([t, op]) => t === 'tournament_bracket_matches' && op === 'update');

beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('forfait : écriture déduite du match relu', () => {
  it('l’absent perd, l’autre athlète gagne', () => {
    expect(forfeitPatch(MATCH, 'a')).toEqual({ status: 'forfeit', winner_id: 'b', loser_id: 'a' });
    expect(forfeitPatch(MATCH, 'b')).toEqual({ status: 'forfeit', winner_id: 'a', loser_id: 'b' });
    expect(forfeitPatch({ ...MATCH, status: 'completed' }, 'b')).toMatchObject({ status: 'forfeit' });
  });

  it('refus : exemption, un seul athlète, absent hors du match', () => {
    expect(forfeitPatch({ ...MATCH, status: 'bye' }, 'a')).toEqual({ error: 'Forfait impossible : ce match n’a pas deux athlètes.' });
    expect(forfeitPatch({ ...MATCH, participant2_id: null }, 'a')).toHaveProperty('error');
    expect(forfeitPatch({ ...MATCH, participant2_id: 'a' }, 'a')).toHaveProperty('error');
    expect(forfeitPatch(MATCH, 'z')).toEqual({ error: 'Forfait impossible : cet athlète ne joue pas ce match.' });
  });

  it('textes : aucun ELO ; sur un match terminé, son ELO est rendu', () => {
    expect(forfeitBody(false)).toMatch(/ne donne ni ne retire aucun point ELO/);
    expect(forfeitBody(false)).not.toMatch(/rendu/);
    expect(forfeitBody(true)).toMatch(/l’ELO gagné ou perdu sur ce match est rendu/);
  });

  it('contrainte de la base traduite ; autre erreur laissée à tournamentRefusal', () => {
    expect(forfeitRefusal('violates check constraint "tournament_bracket_matches_forfait_check"', '23514')).toMatch(/^Forfait impossible/);
    expect(forfeitRefusal('x', '23514')).toMatch(/^Forfait impossible/);
    expect(forfeitRefusal('boom', null)).toBeNull();
  });

  it('match décidé : victoire ou forfait, pas une exemption', () => {
    expect(isDecided('completed')).toBe(true);
    expect(isDecided('forfeit')).toBe(true);
    expect(isDecided('bye')).toBe(false);
    expect(isDecided('active')).toBe(false);
  });
});

describe('forfeitMatchAction', () => {
  it('relit le match de CE tournoi, puis écrit le forfait avec la date', async () => {
    const c = client();
    mockCreateClient.mockResolvedValue(c);
    await expect(actions.forfeitMatchAction('t-1', 'm1', 'a')).resolves.toEqual({ ok: true });
    expect(c.calls).toContainEqual(['tournament_bracket_matches', 'select', ['participant1_id, participant2_id, status']]);
    const [[, , [patch]]] = writes(c);
    expect(patch).toMatchObject({ status: 'forfeit', winner_id: 'b', loser_id: 'a' });
    expect(typeof (patch as { completed_at: string }).completed_at).toBe('string');
    expect(c.calls.filter(([t, op, a]) => t === 'tournament_bracket_matches' && op === 'eq' && a[0] === 'tournament_id' && a[1] === 't-1')).toHaveLength(2);
  });

  it('match introuvable, ou absent hors du match : aucune écriture', async () => {
    let c = client({ match: null });
    mockCreateClient.mockResolvedValue(c);
    await expect(actions.forfeitMatchAction('t-1', 'mx', 'a')).resolves.toEqual({ ok: false, error: 'Match introuvable.' });
    expect(writes(c)).toHaveLength(0);
    c = client();
    mockCreateClient.mockResolvedValue(c);
    await expect(actions.forfeitMatchAction('t-1', 'm1', 'z')).resolves.toMatchObject({ ok: false });
    expect(writes(c)).toHaveLength(0);
  });

  it('zéro ligne écrite : refus, pas un succès', async () => {
    mockCreateClient.mockResolvedValue(client({ updated: [] }));
    await expect(actions.forfeitMatchAction('t-1', 'm1', 'a')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });

  it('contrainte refusée par la base : message clair', async () => {
    mockCreateClient.mockResolvedValue(client({ updateError: { message: 'violates check constraint', code: '23514' } }));
    await expect(actions.forfeitMatchAction('t-1', 'm1', 'a')).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/^Forfait impossible/) });
  });
});

describe('garde unique des actions du tableau (non-régression)', () => {
  const CALLS: Array<[string, () => Promise<{ ok: boolean }>]> = [
    ['generateRound1Action', () => actions.generateRound1Action('t-1')],
    ['advanceRoundAction', () => actions.advanceRoundAction('t-1', 1)],
    ['setMatchWinnerAction', () => actions.setMatchWinnerAction('t-1', 'm1', 'a', 'b')],
    ['decideRoundAction', () => actions.decideRoundAction('t-1', 1, null)],
    ['setMatchWodAction', () => actions.setMatchWodAction('t-1', 'm1', 'w')],
    ['assignStageWodAction', () => actions.assignStageWodAction('t-1', 1, 'w')],
    ['setLoserRoundWodAction', () => actions.setLoserRoundWodAction('t-1', 2, 'w')],
    ['forfeitMatchAction', () => actions.forfeitMatchAction('t-1', 'm1', 'a')],
    ['resetMatchAction', () => actions.resetMatchAction('t-1', 'm1')],
    ['regenerateBracketAction', () => actions.regenerateBracketAction('t-1')],
    ['saveMatchEditAction', () => actions.saveMatchEditAction('t-1', 'm1', { participant1_id: 'a', participant2_id: 'b', scheduled_at: null, notes: null })],
  ];

  it.each(CALLS)('%s : tournoi d’une autre box → refus, rien d’écrit', async (_n, call) => {
    const c = client({ owned: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(call()).resolves.toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(c.calls).toContainEqual(['tournaments', 'eq', ['box_id', BOX.id]]);
    expect(c.calls.some(([t]) => t === 'tournament_bracket_matches')).toBe(false);
    expect(c.rpc.mock.calls.every(([n]) => n === 'is_box_admin')).toBe(true);
  });

  it.each(CALLS)('%s : pas administrateur de la box → refus', async (_n, call) => {
    const c = client({ admin: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(call()).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    expect(c.calls.some(([t]) => t === 'tournament_bracket_matches')).toBe(false);
  });

  it('plus de garde locale ni de message brut dans les actions du tableau', () => {
    const src = read('app/(dashboard)/tournaments/[id]/bracket/actions.ts');
    expect(src).not.toMatch(/async function authorize\(/);
    expect(src).not.toMatch(/getActiveBox|createClient/);
    expect(src.match(/await authorizeTournament\(tournamentId\)/g)).toHaveLength(CALLS.length);
    expect(src).not.toMatch(/error: err\.message/);
  });
});

describe('petite finale', () => {
  it('verrouillée dès que la finale ou la petite finale existe', () => {
    const r1 = [{ round: 1, side: 'winner' }, { round: 1, side: 'winner' }];
    expect(thirdPlaceLocked([])).toBe(false);
    expect(thirdPlaceLocked(r1)).toBe(false);
    expect(thirdPlaceLocked([...r1, { round: 2, side: 'winner' }, { round: 2, side: 'winner' }])).toBe(false);
    expect(thirdPlaceLocked([...r1, { round: 2, side: 'winner' }])).toBe(true);
    expect(thirdPlaceLocked([{ round: 3, side: 'third_place' }])).toBe(true);
    // Tableau à 2 : un seul match au premier tour, ce n'est pas une finale « avancée ».
    expect(thirdPlaceLocked([{ round: 1, side: 'winner' }])).toBe(false);
  });

  it('motif « Décider » : la petite finale se distingue de la finale', () => {
    const m = { id: 'x', round: 3, side: 'third_place', winner_id: null };
    expect(matchPlace(m, [m], 'bracket')).toBe(THIRD_PLACE_TITLE);
  });

  it('formulaire : l’option part quand elle change, relue telle qu’enregistrée', () => {
    const start = initialTournamentForm({ name: 'T', format: 'bracket', third_place_match: true }, ['simple']);
    expect(start.third_place_match).toBe(true);
    expect(initialTournamentForm(undefined, ['bracket']).third_place_match).toBe(false);
    const opts = { boxId: 'b', bannerUrl: null, initialBannerUrl: null };
    expect(tournamentUpdatePayload(start, { ...start, third_place_match: false }, opts)).toMatchObject({ third_place_match: false });
    expect(tournamentUpdatePayload(start, start, opts)).not.toHaveProperty('third_place_match');
  });

  it('formulaire et page de modification : case en élimination simple, désactivée et expliquée si verrouillée', () => {
    const form = read('components/tournaments/TournamentForm.tsx');
    expect(form).toMatch(/\{\(initial\?\.format \?\? form\.format\) === 'bracket' && \(/);
    expect(form).toMatch(/checked=\{form\.third_place_match\} disabled=\{thirdPlaceLocked\}/);
    expect(form).toMatch(/\? THIRD_PLACE_LOCKED_HINT/);
    expect(form).toMatch(/third_place_match: form\.format === 'bracket' && form\.third_place_match,/);
    expect(THIRD_PLACE_LOCKED_HINT).toMatch(/demi-finales sont avancées/);
    const edit = read('app/(dashboard)/tournaments/[id]/edit/page.tsx');
    expect(edit).toMatch(/select\('round, side'\)\.eq\('tournament_id', t\.id\)/);
    expect(edit).toMatch(/setLockThirdPlace\(thirdPlaceLocked\(ms \?\? \[\]\)\)/);
    expect(edit).toMatch(/thirdPlaceLocked=\{lockThirdPlace\}/);
  });
});

describe('écran du tableau', () => {
  const bm = read('components/tournaments/BracketManager.tsx');

  it('forfait : boîte à deux choix, action destructive, part de son bouton', () => {
    expect(bm).toMatch(/title: 'Déclarer un forfait \?'/);
    expect(bm).toMatch(/body: forfeitBody\(isDecided\(match\.status\)\)/);
    expect(bm).toMatch(/choices: \[p1, p2\]\.map/);
    expect(bm).toMatch(/run: \(_v, absent\) => forfeit\(match, absent \?\? ''\)/);
    expect(bm).toMatch(/await forfeitMatchAction\(tournamentId, match\.id, absentId\)/);
  });

  it('carte : badge « Forfait », bouton de forfait sauf exemption et forfait déjà posé, actions au clavier', () => {
    expect(bm).toMatch(/const completed = isDecided\(match\.status\);/);
    expect(bm).toMatch(/const canForfeit = !isBye && !isForfeit && twoPlayers;/);
    expect(bm).toMatch(/\{isForfeit && <span data-testid="badge-forfait"/);
    expect(bm).toMatch(/group-hover:opacity-100 group-focus-within:opacity-100/);
  });

  it('annuler un forfait : texte propre (aucun ELO à rendre)', () => {
    expect(bm).toMatch(/title: wasForfeit \? 'Annuler ce forfait \?'/);
  });

  it('petite finale affichée et décidée avec le dernier tour', () => {
    expect(bm).toMatch(/else if \(m\.side === 'third_place'\) thirdPlace = m;/);
    expect(bm).toMatch(/\{grouped\.thirdPlace && \(/);
    expect(bm).toMatch(/m\.side === 'winner' \|\| m\.side === 'third_place'\)\);/);
  });
});

describe('classement du tableau lu de la base', () => {
  const row = (final_rank: number, still_alive = false) => ({ athlete_id: 'x', final_rank, still_alive });

  it('libellés : en lice, champion, finaliste, 3e / 4e place si petite finale jouée, sinon le tour', () => {
    expect(bracketPlacement(row(1, true), 'Demi-finaliste', false)).toBe('En lice');
    expect(bracketPlacement(row(1), undefined, false)).toBe('Champion');
    expect(bracketPlacement(row(2), undefined, false)).toBe('Finaliste');
    expect(bracketPlacement(row(3), 'Demi-finaliste', true)).toBe('3e place');
    expect(bracketPlacement(row(4), 'Demi-finaliste', true)).toBe('4e place');
    expect(bracketPlacement(row(3), 'Demi-finaliste', false)).toBe('Demi-finaliste');
    expect(bracketPlacement(row(5), 'Quart de finaliste', true)).toBe('Quart de finaliste');
    expect(bracketPlacement(row(9), undefined, false)).toBe('9e');
  });

  it('rang de la base, trié, ex-aequo par nom', () => {
    const rows = [
      { athlete_id: 'c', final_rank: 3, still_alive: false },
      { athlete_id: 'a', final_rank: 1, still_alive: false },
      { athlete_id: 'b', final_rank: 3, still_alive: false },
    ];
    const profiles = { a: { username: 'Ana', level: 'rx', elo: 1 }, b: { username: 'Bob', level: 'rx', elo: 1 }, c: { username: 'Cléo', level: 'rx', elo: 1 } };
    const out = generalFromBracket(rows, profiles, { a: 12 }, {}, false);
    expect(out.map(r => [r.athlete_id, r.rank])).toEqual([['a', 1], ['b', 3], ['c', 3]]);
    expect(out[0]).toMatchObject({ placement: 'Champion', elo_change: 12, username: 'Ana' });
  });

  it('la page lit tournament_bracket_standings pour un tableau', () => {
    const page = read('app/(dashboard)/tournaments/[id]/leaderboard/page.tsx');
    expect(page).toMatch(/\? svc\.rpc\('tournament_bracket_standings', \{ p_tournament_id: tournamentId \}\)/);
    expect(page).toMatch(/\? generalFromBracket\(\(standingsRaw \?\? \[\]\) as BracketStandingRow\[\]/);
    expect(page).toMatch(/m\.side === 'third_place' && m\.winner_id/);
  });
});
