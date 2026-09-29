// Tournois : division figée du score (athlex-app #350). Affichage de
// `tournament_scores.division_id` et correction par le gérant.
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { setScoreDivisionAction } from '../../app/(dashboard)/tournaments/[id]/scores/actions';
import { SCORE_DIVISION_NOTE, scoreDivisionBody, scoreDivisionInfo } from '@/lib/tournaments/scoreDivision';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };
const DIVS = [{ id: 'd1', name: 'D1' }, { id: 'd2', name: 'D2' }];

function client(opts: { owned?: boolean; admin?: boolean; division?: boolean; updated?: { id: string }[]; updateError?: { message: string; code?: string } } = {}) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = jest.fn((table: string) => {
    const chain: any = {};
    for (const op of ['select', 'eq', 'update']) {
      chain[op] = jest.fn((...args: unknown[]) => { calls.push([table, op, args]); return chain; });
    }
    chain.maybeSingle = jest.fn(async () => (table === 'tournaments'
      ? { data: opts.owned === false ? null : { box_id: BOX.id } }
      : { data: opts.division === false ? null : { id: 'd2' } }));
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: opts.updated ?? [{ id: 's1' }], error: opts.updateError ?? null });
    return chain;
  });
  const rpc = jest.fn(async () => ({ data: opts.admin !== false }));
  return { from, rpc, calls };
}
const scoreWrites = (c: ReturnType<typeof client>) => c.calls.filter(([t, op]) => t === 'tournament_scores' && op === 'update');

beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('setScoreDivisionAction', () => {
  it('division de CE tournoi, score de CE tournoi : écrit division_id', async () => {
    const c = client();
    mockCreateClient.mockResolvedValue(c);
    await expect(setScoreDivisionAction('t-1', 's1', 'd2')).resolves.toEqual({ ok: true });
    expect(c.calls).toContainEqual(['tournament_divisions', 'eq', ['tournament_id', 't-1']]);
    expect(scoreWrites(c)).toEqual([['tournament_scores', 'update', [{ division_id: 'd2' }]]]);
    expect(c.calls).toContainEqual(['tournament_scores', 'eq', ['tournament_id', 't-1']]);
  });

  it('division d’un autre tournoi : refus, rien d’écrit', async () => {
    const c = client({ division: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(setScoreDivisionAction('t-1', 's1', 'dx')).resolves.toEqual({ ok: false, error: 'Cette division n’appartient pas à ce tournoi.' });
    expect(scoreWrites(c)).toHaveLength(0);
  });

  it('autre box ou pas administrateur : refus, rien d’écrit', async () => {
    let c = client({ owned: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(setScoreDivisionAction('t-1', 's1', 'd2')).resolves.toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(scoreWrites(c)).toHaveLength(0);
    c = client({ admin: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(setScoreDivisionAction('t-1', 's1', 'd2')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    expect(scoreWrites(c)).toHaveLength(0);
  });

  it('zéro ligne (score d’un autre tournoi, RLS) ou colonne réservée : refus traduit', async () => {
    mockCreateClient.mockResolvedValue(client({ updated: [] }));
    await expect(setScoreDivisionAction('t-1', 'sx', 'd2')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    mockCreateClient.mockResolvedValue(client({ updateError: { message: 'tournament_scores : colonne réservée au staff du tournoi', code: '42501' } }));
    await expect(setScoreDivisionAction('t-1', 's1', 'd2')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });
});

describe('affichage', () => {
  it('division du score, et l’actuelle si elle diffère', () => {
    expect(scoreDivisionInfo('d2', 'd2', DIVS)).toEqual({ label: 'D2', current: null });
    expect(scoreDivisionInfo('d2', 'd1', DIVS)).toEqual({ label: 'D2', current: 'D1' });
    expect(scoreDivisionInfo(null, 'd1', DIVS)).toEqual({ label: 'Aucune division', current: 'D1' });
    expect(scoreDivisionInfo('d2', null, DIVS)).toEqual({ label: 'D2', current: null });
    expect(scoreDivisionInfo('dz', null, DIVS).label).toBe('Division supprimée');
  });

  it('la boîte dit quand les points bougent (pas de recalcul immédiat)', () => {
    expect(scoreDivisionBody(true)).toMatch(/^Ce score validé sera classé dans cette division/);
    expect(scoreDivisionBody(false)).toMatch(/une fois validé/);
    expect(scoreDivisionBody(true)).toContain(SCORE_DIVISION_NOTE);
    expect(SCORE_DIVISION_NOTE).toMatch(/au prochain score validé, rejeté ou corrigé/);
  });

  it('écran Scores : bloc en ligue seulement, boîte de confirmation, action serveur', () => {
    const src = read('app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx');
    expect(src).toMatch(/\{divisions && \(\(\) => \{/);
    expect(src).toMatch(/onChange=\{e => askScoreDivision\(score, e\.target\.value\)\}/);
    expect(src).toMatch(/if \(!target \|\| divisionId === score\.division_id\) return;/);
    expect(src).toMatch(/run: \(\) => saveScoreDivision\(score\.id, divisionId\)/);
    expect(src).toMatch(/await setScoreDivisionAction\(tournamentId, scoreId, divisionId\)/);
    expect(src).toMatch(/<label htmlFor=\{`division-score-\$\{score\.id\}`\}/);
    // Échec : dit sous le sélecteur, et la division affichée ne change pas.
    expect(src).toMatch(/setDivisionError\(prev => \(\{ \.\.\.prev, \[scoreId\]: res\.ok \? '' : res\.error \}\)\);\n\s+if \(!res\.ok\) return;/);
    expect(src).toMatch(/\{divisionError\[score\.id\] && \(\n\s+<p role="alert"/);
  });

  it('page : division_id lue, divisions et appartenances bornées au tournoi, ligue seulement', () => {
    const page = read('app/(dashboard)/tournaments/[id]/scores/page.tsx');
    expect(page).toMatch(/tournament_wod_id, division_id, tw:tournament_wods/);
    expect(page).toMatch(/from\('tournament_divisions'\)\.select\('id, name'\)\.eq\('tournament_id', tournamentId\)/);
    expect(page).toMatch(/\.in\('division_id', divisionIds\)/);
    expect(page).toMatch(/divisions=\{isLeague \? divisions : undefined\}/);
  });
});
