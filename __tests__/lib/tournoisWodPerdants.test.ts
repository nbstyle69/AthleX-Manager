// Tournois : liste « WOD de ce tour » en haut de chaque colonne du tableau des
// perdants. Le WOD choisi part, par une action serveur, sur les matchs non joués
// de ce tour des perdants ; l'en-tête affiche son nom, sinon « WOD non assigné ».
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { setLoserRoundWodAction } from '../../app/(dashboard)/tournaments/[id]/bracket/actions';
import { loserColumnWodId } from '@/lib/tournaments/bracketRounds';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };

function client(updateError: { message: string; code?: string } | null = null) {
  const calls: unknown[][] = [];
  const upd: any = {};
  ['eq', 'is'].forEach(k => (upd[k] = jest.fn((...a: unknown[]) => { calls.push([k, ...a]); return upd; })));
  upd.then = (r: Function) => Promise.resolve({ error: updateError }).then(r as any);
  const chain: any = { select: jest.fn(() => chain), eq: jest.fn(() => chain), maybeSingle: jest.fn(async () => ({ data: { box_id: BOX.id } })) };
  const update = jest.fn(() => upd);
  return { c: { from: jest.fn((t: string) => (t === 'tournaments' ? chain : { update })), rpc: jest.fn(async () => ({ data: true })) }, update, calls };
}
beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('setLoserRoundWodAction : écriture côté serveur', () => {
  it('le WOD choisi part sur les matchs non joués de ce tour des perdants, et seulement eux', async () => {
    const { c, update, calls } = client();
    mockCreateClient.mockResolvedValue(c);
    await expect(setLoserRoundWodAction('t-1', 3, 'w-perdants')).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ wod_id: 'w-perdants' });
    expect(calls).toEqual([['eq', 'tournament_id', 't-1'], ['eq', 'round', 3], ['eq', 'side', 'loser'], ['is', 'winner_id', null]]);
  });

  it('« — Choisir un WOD — » retire le WOD de ces matchs', async () => {
    const { c, update } = client();
    mockCreateClient.mockResolvedValue(c);
    await setLoserRoundWodAction('t-1', 3, null);
    expect(update).toHaveBeenCalledWith({ wod_id: null });
  });

  it('refus de la base : traduit, jamais brut', async () => {
    const { c } = client({ message: 'permission denied for table tournament_bracket_matches', code: '42501' });
    mockCreateClient.mockResolvedValue(c);
    await expect(setLoserRoundWodAction('t-1', 3, 'w')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });
});

describe('WOD affiché en tête de colonne', () => {
  const M = (wod_id: string | null, winner_id: string | null, status = winner_id ? 'completed' : 'pending') => ({ wod_id, winner_id, status });

  it('celui des matchs non joués d’abord, sinon celui d’un match joué, sinon aucun', () => {
    expect(loserColumnWodId([M('w-ancien', 'u1'), M('w-nouveau', null)])).toBe('w-nouveau');
    expect(loserColumnWodId([M('w-joue', 'u1'), M(null, null)])).toBe('w-joue');
    expect(loserColumnWodId([M(null, null), M(null, 'u1')])).toBeNull();
  });

  it('une exemption ne compte pas', () => {
    expect(loserColumnWodId([M('w-bye', 'u6', 'bye'), M(null, null)])).toBeNull();
  });
});

describe('branchements', () => {
  const bm = read('components/tournaments/BracketManager.tsx');

  it('chaque colonne des perdants a sa liste, son en-tête et son aide', () => {
    expect(bm).toContain('wodName={wods.find(w => w.id === loserColumnWodId(grouped.loserByRound[r]))?.name}');
    expect(bm).toContain("value: loserColumnWodId(grouped.loserByRound[r]) ?? '',");
    expect(bm).toContain('onChange: (wodId: string) => setLoserRoundWod(r, wodId),');
    expect(bm).toMatch(/>WOD de ce tour<\/label>/);
    expect(bm).toContain('<option value="">— Choisir un WOD —</option>');
    expect(bm).toContain('Ce WOD s’applique aux matchs de ce tour des perdants qui ne sont pas encore joués.');
    expect(bm).toMatch(/\{wodName \? \([\s\S]{0,200}🏋️ \{wodName\}[\s\S]{0,300}WOD non assigné/);
  });

  it('l’écriture passe par l’action serveur ; l’écran ne met à jour que les matchs non joués de ce tour des perdants', () => {
    const fn = bm.slice(bm.indexOf('async function setLoserRoundWod('), bm.indexOf('async function setMatchWod('));
    expect(fn).toContain('const res = await setLoserRoundWodAction(tournamentId, round, wodId || null);');
    expect(fn).toContain("m.side === 'loser' && m.round === round && !m.winner_id ? { ...m, wod_id: wodId || null } : m");
    expect(fn).toContain("if (!res.ok) { void inform({ kind: 'error', title: ERROR_TITLE, body: res.error }); return; }");
    expect(bm).not.toMatch(/createClient\(\)[\s\S]{0,80}tournament_bracket_matches/);
  });

  it('le tableau des gagnants garde son WOD d’étape, sans liste', () => {
    expect(bm.match(/wodPicker=\{\{/g)).toHaveLength(1);
    expect(bm).toContain('wodForRound={wodForRound}');
  });
});
