// Tournois, lot Manager PR 2 : « Décider selon les scores » par la base
// (`decide_bracket_round`, athlex-app #354). Le Manager ne calcule plus aucun
// vainqueur : il reporte ceux que la base rend et dit pourquoi un match reste
// à la main.
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { decideRoundAction } from '../../app/(dashboard)/tournaments/[id]/bracket/actions';
import { MOTIF_TEXT, applyDecidedRows, decidedMessage, manualMotifs, type DecideRow } from '@/lib/tournaments/bracketDecision';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };

function client(rpcResult: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => ({ data: { box_id: BOX.id } })),
  };
  const rpc = jest.fn(async (name: string) => (name === 'is_box_admin' ? { data: true } : { data: null, error: null, ...rpcResult }));
  return { from: jest.fn(() => chain), rpc };
}

const ROWS: DecideRow[] = [
  { match_id: 'm1', winner_id: 'u1', motif: null },
  { match_id: 'm2', winner_id: null, motif: 'score_manquant' },
  { match_id: 'm3', winner_id: null, motif: 'egalite' },
  { match_id: 'm4', winner_id: null, motif: 'wod_absent' },
];

beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('decideRoundAction : l’appel exact au serveur', () => {
  it('decide_bracket_round(tournoi, tour, WOD de la manche), lignes rendues telles quelles', async () => {
    const c = client({ data: ROWS });
    mockCreateClient.mockResolvedValue(c);
    await expect(decideRoundAction('t-1', 2, 'w-9')).resolves.toEqual({ ok: true, rows: ROWS });
    expect(c.rpc).toHaveBeenCalledWith('decide_bracket_round', { p_tournament_id: 't-1', p_round: 2, p_wod_id: 'w-9' });
  });

  it('sans WOD de manche : p_wod_id null (le WOD propre au match prime côté base)', async () => {
    const c = client({ data: [] });
    mockCreateClient.mockResolvedValue(c);
    await expect(decideRoundAction('t-1', 1, null)).resolves.toEqual({ ok: true, rows: [] });
    expect(c.rpc).toHaveBeenCalledWith('decide_bracket_round', { p_tournament_id: 't-1', p_round: 1, p_wod_id: null });
  });

  it('refus de la base : traduit, jamais brut', async () => {
    const c = client({ error: { message: 'Not authorized: only the box owner/coach or an admin can manage this tournament', code: '42501' } });
    mockCreateClient.mockResolvedValue(c);
    await expect(decideRoundAction('t-1', 1, null)).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });
});

describe('ce que l’écran affiche', () => {
  it('les trois motifs, avec les textes validés', () => {
    expect(MOTIF_TEXT).toEqual({
      score_manquant: 'À décider à la main : score manquant ou non validé.',
      egalite: 'À décider à la main : égalité parfaite (scores et tie-breaks).',
      wod_absent: 'À décider à la main : aucun WOD pour ce match.',
    });
    expect(manualMotifs(ROWS)).toEqual({ m2: 'score_manquant', m3: 'egalite', m4: 'wod_absent' });
  });

  it('confirmation : le nombre vient du retour de la base, au singulier et au pluriel', () => {
    expect(decidedMessage(ROWS)).toBe('1 match décidé selon les scores.');
    expect(decidedMessage([...ROWS, { match_id: 'm5', winner_id: 'u9', motif: null }])).toBe('2 matchs décidés selon les scores.');
    expect(decidedMessage(ROWS.slice(1))).toBe('Aucun match n’a pu être décidé.');
    expect(decidedMessage([])).toBe('Aucun match n’a pu être décidé.');
  });

  it('les vainqueurs rendus sont reportés tels quels ; les autres matchs ne bougent pas', () => {
    const matches = [
      { id: 'm1', participant1_id: 'u2', participant2_id: 'u1', winner_id: null, loser_id: null, status: 'pending', completed_at: null },
      { id: 'm2', participant1_id: 'u3', participant2_id: 'u4', winner_id: null, loser_id: null, status: 'pending', completed_at: null },
    ];
    const out = applyDecidedRows(matches, ROWS, '2026-09-26T10:00:00.000Z');
    expect(out[0]).toEqual({ ...matches[0], winner_id: 'u1', loser_id: 'u2', status: 'completed', completed_at: '2026-09-26T10:00:00.000Z' });
    expect(out[1]).toBe(matches[1]);
  });
});

describe('plus aucune règle sportive dans le Manager', () => {
  const bm = read('components/tournaments/BracketManager.tsx');
  const actions = read('app/(dashboard)/tournaments/[id]/bracket/actions.ts');

  it('le tableau ne compare plus de scores et n’écrit plus de vainqueur « calculé »', () => {
    expect(bm).not.toMatch(/winnerFromScores|parseScoreVal|higherWins|applyDecisionsAction/);
    expect(bm).not.toMatch(/'For Time'\)?\s*[!=]==/);
    expect(actions).not.toMatch(/applyDecisionsAction/);
  });

  it('« Décider » passe par la base, avec le WOD de la manche, et affiche son retour', () => {
    expect(bm).toMatch(/run: \(\) => decideRound\(round, wod\?\.id \?\? null\),/);
    expect(bm).toContain('const res = await decideRoundAction(tournamentId, round, wodId);');
    expect(bm).toContain('setMatches(arr => applyDecidedRows(arr, res.rows, new Date().toISOString()));');
    expect(bm).toContain('setDecision({ message: decidedMessage(res.rows), motifs: manualMotifs(res.rows) });');
    expect(bm).toMatch(/Match #\{m\.match_number\} · \{MOTIF_TEXT\[decision\.motifs\[m\.id\]\]\}/);
    // Refus de la base : dans la boîte d'erreur (lisible dans les deux thèmes), pas dans le bandeau rouge.
    const decide = bm.slice(bm.indexOf('async function decideRound('), bm.indexOf('function askGenerateRound1()'));
    expect(decide).toContain("if (!res.ok) { void inform({ kind: 'error', title: ERROR_TITLE, body: res.error }); return; }");
    expect(decide).not.toContain('setError(res.error)');
  });

  it('l’ancien bandeau « Aucun WOD assigné à cette manche » a disparu', () => {
    expect(bm).not.toMatch(/Aucun WOD assigné à cette manche|Aucun match décidable/);
  });
});
