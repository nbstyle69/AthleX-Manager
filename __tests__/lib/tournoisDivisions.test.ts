// Tournois, lot Manager priorité 4 : ligues à divisions. Répartition par ELO
// (`affecter_divisions`, #357), placement manuel, fin de saison avec la saison
// attendue (`end_season_and_advance`, #349).
import { readFileSync } from 'fs';
import { join } from 'path';

const mockCreateClient = jest.fn();
const mockGetActiveBox = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  getActiveBox: (c: unknown) => mockGetActiveBox(c),
}));

import { affecterDivisionsAction, endSeasonAction, setAutoPlacementAction } from '../../app/(dashboard)/tournaments/[id]/divisions/actions';
import {
  affectationBody, affectationMessage, divisionFill, divisionRefusal, endSeasonBody, endSeasonOutcome, parsePlaces,
} from '@/lib/tournaments/divisions';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const BOX = { id: 'box-active', name: 'AthleX Fitness' };

/** Faux client : enregistre chaque appel de chaîne, rend ce qu'on lui donne par table. */
function client(opts: {
  owned?: boolean; admin?: boolean;
  rpc?: { data?: unknown; error?: { message: string; code?: string } | null };
  divisions?: { id: string }[];
  updated?: { id: string }[] | null;
  updateError?: { message: string; code?: string } | null;
}) {
  const calls: Array<[string, string, unknown[]]> = [];
  const from = jest.fn((table: string) => {
    const chain: any = {};
    for (const op of ['select', 'eq', 'in', 'update']) {
      chain[op] = jest.fn((...args: unknown[]) => { calls.push([table, op, args]); return chain; });
    }
    chain.maybeSingle = jest.fn(async () => ({ data: opts.owned === false ? null : { box_id: BOX.id } }));
    chain.then = (resolve: (v: unknown) => void) => {
      if (table === 'tournament_divisions') return resolve({ data: opts.divisions ?? [{ id: 'd1' }, { id: 'd2' }] });
      return resolve({ data: opts.updated === undefined ? [{ id: 'row-1' }] : opts.updated, error: opts.updateError ?? null });
    };
    return chain;
  });
  const rpc = jest.fn(async (name: string) => (name === 'is_box_admin'
    ? { data: opts.admin !== false }
    : { data: null, error: null, ...(opts.rpc ?? {}) }));
  return { from, rpc, calls };
}

beforeEach(() => { jest.clearAllMocks(); mockGetActiveBox.mockResolvedValue(BOX); });

describe('garde : box active et is_box_admin, comme les actions du tableau', () => {
  it('tournoi d’une autre box : refus, aucune RPC de ligue', async () => {
    const c = client({ owned: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(affecterDivisionsAction('t-1')).resolves.toEqual({ ok: false, error: 'Tournoi introuvable.' });
    expect(c.calls).toContainEqual(['tournaments', 'eq', ['box_id', BOX.id]]);
    expect(c.rpc).not.toHaveBeenCalledWith('affecter_divisions', expect.anything());
  });

  it('pas administrateur de la box : refus', async () => {
    const c = client({ admin: false });
    mockCreateClient.mockResolvedValue(c);
    await expect(endSeasonAction('t-1', 2)).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
    expect(c.rpc).not.toHaveBeenCalledWith('end_season_and_advance', expect.anything());
  });

  it('aucune box active : refus', async () => {
    mockGetActiveBox.mockResolvedValue(null);
    mockCreateClient.mockResolvedValue(client({}));
    await expect(setAutoPlacementAction('t-1', 'row-1')).resolves.toEqual({ ok: false, error: 'Aucune box active.' });
  });
});

describe('« Répartir par ELO »', () => {
  it('appelle affecter_divisions(tournoi) et rend le nombre placé', async () => {
    const c = client({ rpc: { data: 7 } });
    mockCreateClient.mockResolvedValue(c);
    await expect(affecterDivisionsAction('t-1')).resolves.toEqual({ ok: true, placed: 7 });
    expect(c.rpc).toHaveBeenCalledWith('affecter_divisions', { p_tournament_id: 't-1' });
  });

  it('refus de la base traduit', async () => {
    mockCreateClient.mockResolvedValue(client({ rpc: { error: { message: 'Not authorized: only the box owner/coach' } } }));
    await expect(affecterDivisionsAction('t-1')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });

  it('textes : avant et après le premier score validé, résultat', () => {
    expect(affectationBody(false)).toMatch(/ELO décroissant/);
    expect(affectationBody(true)).toMatch(/seuls les inscrits sans division sont placés/);
    expect(affectationBody(true)).toMatch(/placés à la main restent/);
    expect(affectationMessage(0)).toMatch(/déjà à jour/);
    expect(affectationMessage(1)).toBe('1 athlète placé par ELO.');
    expect(affectationMessage(4)).toBe('4 athlètes placés par ELO.');
  });
});

describe('« Rendre à l’automatique »', () => {
  it('écrit placement = auto sur une ligne d’une division de CE tournoi', async () => {
    const c = client({ divisions: [{ id: 'd1' }, { id: 'd2' }] });
    mockCreateClient.mockResolvedValue(c);
    await expect(setAutoPlacementAction('t-1', 'row-1')).resolves.toEqual({ ok: true });
    expect(c.calls).toContainEqual(['tournament_divisions', 'eq', ['tournament_id', 't-1']]);
    expect(c.calls).toContainEqual(['tournament_division_members', 'update', [{ placement: 'auto' }]]);
    expect(c.calls).toContainEqual(['tournament_division_members', 'eq', ['id', 'row-1']]);
    expect(c.calls).toContainEqual(['tournament_division_members', 'in', ['division_id', ['d1', 'd2']]]);
  });

  it('zéro ligne touchée (autre tournoi, RLS) : échec, pas un succès', async () => {
    mockCreateClient.mockResolvedValue(client({ updated: [] }));
    await expect(setAutoPlacementAction('t-1', 'row-x')).resolves.toEqual({ ok: false, error: 'Tu n’as pas les droits pour gérer ce tournoi.' });
  });

  it('tournoi sans division : rien n’est écrit', async () => {
    const c = client({ divisions: [] });
    mockCreateClient.mockResolvedValue(c);
    await expect(setAutoPlacementAction('t-1', 'row-1')).resolves.toMatchObject({ ok: false });
    expect(c.calls.some(([t, op]) => t === 'tournament_division_members' && op === 'update')).toBe(false);
  });
});

describe('Fin de saison avec la saison attendue', () => {
  it('passe p_saison_attendue ; saison + 1 rendue : close', async () => {
    const c = client({ rpc: { data: 3 } });
    mockCreateClient.mockResolvedValue(c);
    await expect(endSeasonAction('t-1', 2)).resolves.toEqual({ ok: true, closed: true, message: 'Saison 2 close : la saison 3 commence.' });
    expect(c.rpc).toHaveBeenCalledWith('end_season_and_advance', { p_tournament_id: 't-1', p_saison_attendue: 2 });
  });

  it('autre saison rendue : « Saison déjà close », rien n’a changé', async () => {
    mockCreateClient.mockResolvedValue(client({ rpc: { data: 3 } }));
    const res = await endSeasonAction('t-1', 3);
    expect(res).toMatchObject({ ok: true, closed: false });
    expect((res as { message: string }).message).toMatch(/^Saison déjà close/);
    expect(endSeasonOutcome(2, 2).closed).toBe(false);
  });

  it('saison sans score : confirmation explicite', () => {
    expect(endSeasonBody(2, 0)).toMatch(/^Attention : la saison 2 n’a aucun score validé/);
    expect(endSeasonBody(2, 5)).not.toMatch(/Attention/);
  });
});

describe('Places et remplissage', () => {
  it.each([['', null], ['0', null], ['abc', null], ['2.5', null], ['1', 1], ['16', 16]])('« %s » → %p (jamais NaN ni 0)', (raw, v) => {
    expect(parsePlaces(raw as string)).toBe(v);
  });

  it('« n / places », dépassement signalé, dernière division qui prend le reste', () => {
    expect(divisionFill(3, 16, false)).toEqual({ text: '3 / 16 places', over: false, note: null });
    expect(divisionFill(1, 1, false).text).toBe('1 / 1 place');
    const last = divisionFill(18, 16, true);
    expect(last.over).toBe(true);
    expect(last.note).toBe('Dépasse de 2 athlètes : la dernière division prend le reste.');
    expect(divisionFill(17, 16, false).note).toBe('Dépasse d’1 athlète (placements à la main).');
  });
});

describe('refus des écritures de divisions', () => {
  it('doublon, droits, autre', () => {
    expect(divisionRefusal('duplicate key value violates unique constraint', '23505')).toBe('Cet athlète est déjà dans une division de ce tournoi.');
    expect(divisionRefusal('new row violates row-level security policy', '42501')).toBe('Tu n’as pas les droits pour gérer ce tournoi.');
    expect(divisionRefusal('conflit', '23505')).toBe('Cet athlète est déjà dans une division de ce tournoi.');
    expect(divisionRefusal('boom')).toMatch(/^L’action n’a pas abouti/);
  });
});

describe('écran Divisions', () => {
  const src = read('components/tournaments/DivisionsManager.tsx');
  const page = read('app/(dashboard)/tournaments/[id]/divisions/page.tsx');

  it('« Répartir par ELO » passe par une boîte de confirmation puis l’action serveur', () => {
    expect(src).toMatch(/onClick=\{askAffecter\}/);
    expect(src).toMatch(/confirmLabel: 'Répartir par ELO',\n\s+run: affecter,/);
    expect(src).toMatch(/await affecterDivisionsAction\(tournamentId\)/);
  });

  it('fin de saison par l’action serveur avec la saison en cours, plus d’appel direct sans saison', () => {
    expect(src).toMatch(/await endSeasonAction\(tournamentId, currentSeason\)/);
    expect(src).not.toMatch(/rpc\('end_season_and_advance'/);
    expect(src).toMatch(/body: endSeasonBody\(currentSeason, validatedThisSeason\)/);
  });

  it('pastille « Placé à la main » et « Rendre à l’automatique » sur les placements manuels', () => {
    expect(src).toMatch(/\{row\.placement === 'manual' && \(\n\s+<span data-testid="placement-manuel"/);
    expect(src).toMatch(/onClick=\{\(\) => setAuto\(row\.id\)\}/);
    expect(page).toMatch(/select\('id, division_id, athlete_id, points, rank, joined_at, placement'\)/);
  });

  it('ajout : doublon relu avant l’insertion, refus traduits, plus aucun message brut', () => {
    expect(src).toMatch(/\.select\('id'\)\.eq\('athlete_id', athleteId\)\.in\('division_id', divisions\.map\(x => x\.id\)\)/);
    expect(src).toMatch(/if \(already && already\.length > 0\) \{\n\s+setBusy\(null\);\n\s+setError\(divisionRefusal\(null, '23505'\)\);\n\s+return;/);
    expect(src).not.toMatch(/setError\(err\.message\)/);
  });

  it('« Places » remplace le champ « Max » qui pouvait valoir 0', () => {
    expect(src).not.toMatch(/label="Max"/);
    expect(src).toMatch(/<PlacesField value=\{d\.max_members\}/);
    expect(src).toMatch(/if \(parsed != null && parsed !== value\) onCommit\(parsed\)/);
  });

  it('la page compte les scores validés de la saison en cours, bornés au tournoi', () => {
    expect(page).toMatch(/from\('tournament_scores'\)\.select\('tournament_wod_id'\)\.eq\('tournament_id', id\)\.eq\('status', 'validated'\)/);
    expect(page).toMatch(/w\.season_number === currentSeason/);
  });
});
