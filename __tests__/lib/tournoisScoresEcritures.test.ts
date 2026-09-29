// Écran Scores des tournois : valider, rejeter, corriger un score, écrire à
// l'athlète. Un refus de la base ou zéro ligne modifiée est un échec affiché,
// jamais un faux succès.
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { setAdminMessageAction, setScoreStatusAction, setScoreValueAction } from '../../app/(dashboard)/tournaments/[id]/scores/actions';
import { SCORE_NOT_UPDATED } from '@/lib/tournaments/refusals';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };

function client(opts: { owned?: boolean; admin?: boolean; updated?: { id: string }[]; updateError?: { message: string; code?: string } } = {}) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = jest.fn((table: string) => {
    const chain: any = {};
    for (const op of ['select', 'eq', 'update']) {
      chain[op] = jest.fn((...args: unknown[]) => { calls.push([table, op, args]); return chain; });
    }
    chain.maybeSingle = jest.fn(async () => ({ data: opts.owned === false ? null : { box_id: BOX.id } }));
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: opts.updateError ? null : opts.updated ?? [{ id: 's1' }], error: opts.updateError ?? null });
    return chain;
  });
  const rpc = jest.fn(async () => ({ data: opts.admin !== false }));
  return { from, rpc, calls };
}
const writes = (c: ReturnType<typeof client>) => c.calls.filter(([t, op]) => t === 'tournament_scores' && op === 'update');

beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

const ACTIONS = [
  ['valider', () => setScoreStatusAction('t-1', 's1', 'validated')],
  ['rejeter', () => setScoreStatusAction('t-1', 's1', 'rejected')],
  ['modifier le score', () => setScoreValueAction('t-1', 's1', '570')],
  ['envoyer un message', () => setAdminMessageAction('t-1', 's1', 'Vidéo floue')],
] as const;

describe.each(ACTIONS)('%s', (_name, run) => {
  it('nominal : une ligne du tournoi modifiée → succès', async () => {
    const c = client();
    mockCreateClient.mockResolvedValue(c);
    await expect(run()).resolves.toEqual({ ok: true });
    expect(writes(c)).toHaveLength(1);
    expect(c.calls).toContainEqual(['tournament_scores', 'eq', ['id', 's1']]);
    expect(c.calls).toContainEqual(['tournament_scores', 'eq', ['tournament_id', 't-1']]);
    expect(c.calls).toContainEqual(['tournament_scores', 'select', ['id']]);
  });

  it('erreur de la base → échec traduit, jamais le texte brut', async () => {
    mockCreateClient.mockResolvedValue(client({ updateError: { message: 'tournament_scores : colonne réservée au staff du tournoi', code: '42501' } }));
    await expect(run()).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    mockCreateClient.mockResolvedValue(client({ updateError: { message: 'new row violates row-level security policy', code: 'XX000' } }));
    await expect(run()).resolves.toEqual({ ok: false, error: 'L’action n’a pas abouti. Réessaie, ou contacte le support si ça continue.' });
  });

  it('aucune ligne modifiée → échec', async () => {
    mockCreateClient.mockResolvedValue(client({ updated: [] }));
    await expect(run()).resolves.toEqual({ ok: false, error: SCORE_NOT_UPDATED });
  });

  it('tournoi d’une autre box ou pas administrateur → refus, rien d’écrit', async () => {
    let c = client({ owned: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(run()).resolves.toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(writes(c)).toHaveLength(0);
    c = client({ admin: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(run()).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    expect(writes(c)).toHaveLength(0);
  });
});

describe('ce qui est écrit', () => {
  it('valider pose validated_at, rejeter non ; score et message tels quels', async () => {
    const c = client();
    mockCreateClient.mockResolvedValue(c);
    await setScoreStatusAction('t-1', 's1', 'validated');
    await setScoreStatusAction('t-1', 's1', 'rejected');
    await setScoreValueAction('t-1', 's1', '570');
    await setAdminMessageAction('t-1', 's1', null);
    const patches = writes(c).map(([, , [p]]) => p as Record<string, unknown>);
    expect(patches[0]).toEqual({ status: 'validated', validated_at: expect.any(String) });
    expect(patches[1]).toEqual({ status: 'rejected' });
    expect(patches[2]).toEqual({ score_value: '570' });
    expect(patches[3]).toEqual({ admin_message: null });
  });
});

describe('écran Scores : aucun succès affiché après un échec', () => {
  const src = read('app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx');
  const fn = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));

  it('plus aucune écriture directe depuis le navigateur', () => {
    expect(src).not.toMatch(/from\('tournament_scores'\)/);
    expect(src).not.toMatch(/@\/lib\/supabase\/client/);
  });

  it.each([
    ['updateStatus', 'async function updateStatus(', 'async function saveScoreValue(', /const res = await setScoreStatusAction\(tournamentId, scoreId, newStatus\);\n\s+if \(!settle\(`status-\$\{scoreId\}`, res\)\) \{ setProcessing\(null\); return; \}\n\s+setScores/],
    ['saveScoreValue', 'async function saveScoreValue(', 'async function saveAdminMessage(', /const res = await setScoreValueAction\(tournamentId, scoreId, newVal\);\n\s+if \(!settle\(`value-\$\{scoreId\}`, res\)\) \{ setSavingScore\(null\); return; \}\n\s+setScores/],
    ['saveAdminMessage', 'async function saveAdminMessage(', 'function askScoreDivision(', /const res = await setAdminMessageAction\(tournamentId, scoreId, msg \|\| null\);\n\s+if \(!settle\(`message-\$\{scoreId\}`, res\)\) \{ setSavingMsg\(null\); return; \}\n\s+setScores/],
  ])('%s : l’état ne change qu’après un succès', (_n, from, to, re) => {
    expect(fn(from, to)).toMatch(re);
  });

  it('settle retient l’échec et ne dit « réussi » que sur ok', () => {
    expect(src).toMatch(/function settle\(key: string, res: [^)]+\): boolean \{\n\s+setWriteError\(prev => \(\{ \.\.\.prev, \[key\]: res\.ok \? '' : res\.error \}\)\);\n\s+return res\.ok;\n\s+\}/);
  });

  it.each(['status', 'value', 'message'])('échec « %s » dit sous l’élément, en alerte', (k) => {
    const re = new RegExp(`\\{writeError\\[\`${k}-\\$\\{score\\.id\\}\`\\] && \\(\\n\\s+<p role="alert" className="[^"]*text-ax-danger">\\{writeError\\[\`${k}-\\$\\{score\\.id\\}\`\\]\\}</p>`);
    expect(src).toMatch(re);
  });
});
