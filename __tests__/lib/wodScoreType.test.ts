// Type de score choisi par le créateur du WOD (#453, PR 2a).
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));

const inserts: { table: string; row: any }[] = [];
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: any = {
        insert: (row: any) => { inserts.push({ table, row }); return chain; },
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: { id: `nouveau-${inserts.length}` }, error: null }),
        then: (r: any) => Promise.resolve({ data: null, error: null }).then(r),
      };
      return chain;
    },
  }),
}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WodEditor from '@/components/wods/WodEditor';
import { EMPTY_WOD_FORM, WodFormState, withScoreType, withWodType } from '@/lib/wodFields';
import {
  MARKETPLACE_SCORE_NOTE, NOT_DONE, SCORE_LOCK_UNREADABLE, boxWodScoreColumns, formatBoxWodScore, loadScoreLock,
  proposedScoreType, scoreLockFor, scoreTypeAllowed, sortScoresByWod, sortWodScores,
} from '@/lib/wodScoreType';
import { COLONNES, ProgramWod, colonnesSeance, duplicateProgramWeek, formulaireDepuisSeance } from '@/lib/programContent';

(globalThis as unknown as { React: typeof React }).React = React;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();

describe('valeur proposée selon le Type', () => {
  it.each([
    ['for-time', 'time'], ['amrap', 'rounds_reps'], ['emom', 'reps'], ['tabata', 'reps'],
    ['strength', 'weight'], ['custom', ''], ['', ''], [null, ''],
  ])('%s → %s', (type, attendu) => {
    expect(proposedScoreType(type as string | null)).toBe(attendu);
  });

  it('le Score suit le Type à la création, plus après un choix à la main', () => {
    let f: WodFormState = { ...EMPTY_WOD_FORM };
    f = withWodType(f, 'amrap');
    expect(f.scoreType).toBe('rounds_reps');
    f = withWodType(f, 'for-time');
    expect(f.scoreType).toBe('time');
    f = withScoreType(f, 'reps');
    f = withWodType(f, 'strength');
    expect(f.scoreType).toBe('reps');
    expect(f.wod_type).toBe('strength');
  });

  it('un WOD existant ne reçoit pas de valeur proposée', () => {
    const f = withWodType({ ...EMPTY_WOD_FORM, scoreTypeAuto: false }, 'amrap');
    expect(f.scoreType).toBe('');
  });
});

describe('Sans score ⇒ classement coupé', () => {
  it('choisir « Sans score » coupe le classement, le quitter le rallume', () => {
    let f = withScoreType({ ...EMPTY_WOD_FORM, leaderboard: true }, 'none');
    expect(f.leaderboard).toBe(false);
    f = withScoreType(f, 'time');
    expect(f.leaderboard).toBe(true);
  });

  it('un autre changement de score garde le choix du classement', () => {
    expect(withScoreType({ ...EMPTY_WOD_FORM, scoreType: 'time', leaderboard: false }, 'reps').leaderboard).toBe(false);
  });

  it('les colonnes envoient leaderboard_enabled = false même si l’interrupteur dit oui', () => {
    expect(boxWodScoreColumns('none', true)).toEqual({ score_type: 'none', leaderboard_enabled: false });
    expect(boxWodScoreColumns('time', true)).toEqual({ score_type: 'time', leaderboard_enabled: true });
    expect(boxWodScoreColumns('', true)).toEqual({ score_type: null, leaderboard_enabled: true });
  });
});

describe('verrouillage avec des scores existants', () => {
  it('aucun score : tout est permis', () => {
    const l = scoreLockFor([]);
    expect(l.allowed).toBeNull();
    expect(scoreTypeAllowed(l, 'none')).toBe(true);
  });

  it('un seul type de score : ce type seul, raison affichée', () => {
    const l = scoreLockFor(['time', 'time']);
    expect(l.allowed).toEqual(['time']);
    expect(scoreTypeAllowed(l, 'reps')).toBe(false);
    expect(l.reason).toBe('2 scores existent déjà en « Temps » : seul ce type reste possible.');
    expect(scoreLockFor(['done']).allowed).toEqual(['none']);
    expect(scoreLockFor(['rounds_reps']).reason).toBe('Un score existe déjà en « Tours + reps » : seul ce type reste possible.');
  });

  it('types mêlés ou ancien format : verrouillé', () => {
    expect(scoreLockFor(['time', 'reps']).allowed).toEqual([]);
    expect(scoreLockFor(['rounds']).allowed).toEqual([]);
    expect(scoreLockFor([null]).allowed).toEqual([]);
    expect(scoreLockFor(['rounds']).reason).toContain('ancien format');
  });

  it('scores illisibles : verrouillé, jamais permis par défaut', async () => {
    const err = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }) };
    expect(await loadScoreLock(err, 'w')).toBe(SCORE_LOCK_UNREADABLE);
    const ok = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [{ score_type: 'weight' }], error: null }) }) }) };
    expect((await loadScoreLock(ok, 'w')).allowed).toEqual(['weight']);
  });
});

describe('formatage et tri des scores', () => {
  it('formate selon le type', () => {
    expect(formatBoxWodScore(7012, 'rounds_reps')).toBe('7 + 12');
    expect(formatBoxWodScore(5000, 'rounds_reps')).toBe('5 + 0');
    expect(formatBoxWodScore(1, 'done')).toBe('Faite');
    expect(formatBoxWodScore(125, 'time')).toBe('02:05');
    expect(formatBoxWodScore(120, 'weight')).toBe('120');
  });

  const s = (v: number, t: string) => ({ score_value: v, score_type: t });

  it('temps croissant, sinon décroissant, WOD sans type comme avant (croissant)', () => {
    expect(sortWodScores([s(300, 'time'), s(200, 'time')], 'time').map(x => x.score_value)).toEqual([200, 300]);
    expect(sortWodScores([s(5010, 'rounds_reps'), s(7002, 'rounds_reps')], 'rounds_reps').map(x => x.score_value)).toEqual([7002, 5010]);
    expect(sortWodScores([s(80, 'weight'), s(120, 'weight')], 'weight').map(x => x.score_value)).toEqual([120, 80]);
    expect(sortWodScores([s(80, 'reps'), s(120, 'reps')], null).map(x => x.score_value)).toEqual([80, 120]);
  });

  it('« Faite » n’est jamais classée : en fin de liste', () => {
    expect(sortWodScores([s(1, 'done'), s(300, 'time')], 'time').map(x => x.score_type)).toEqual(['time', 'done']);
  });

  it('tri par WOD : chaque WOD a son sens', () => {
    const scores = [
      { wod_id: 'a', ...s(5010, 'rounds_reps') }, { wod_id: 'b', ...s(300, 'time') },
      { wod_id: 'a', ...s(7002, 'rounds_reps') }, { wod_id: 'b', ...s(200, 'time') },
    ];
    const out = sortScoresByWod(scores, [{ id: 'a', score_type: 'rounds_reps' }, { id: 'b', score_type: 'time' }]);
    expect(out.map(x => `${x.wod_id}${x.score_value}`)).toEqual(['a7002', 'a5010', 'b200', 'b300']);
  });

  it('le filtre des totaux garde les scores sans type', () => {
    expect(NOT_DONE).toBe('score_type.is.null,score_type.neq.done');
  });
});

describe('éditeur de WOD : champ Score', () => {
  const base = {
    heading: 'Créer un WOD', submitLabel: 'Créer le WOD', setForm: () => {}, movements: [], setMovements: () => {},
    saving: false, error: null, onClose: () => {}, onSubmit: () => {},
  };
  const wb = (form: Partial<WodFormState>, extra: Record<string, unknown> = {}) => renderToStaticMarkup(
    React.createElement(WodEditor, {
      ...base, mode: 'whiteboard', form: { ...EMPTY_WOD_FORM, title: 'Fran', date: '2026-11-20', audience: 'all', ...form }, ...extra,
    } as any));
  const submitDisabled = (html: string) => /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Créer le WOD/s.test(html);

  it('création : Score obligatoire', () => {
    expect(submitDisabled(wb({ scoreType: '' }))).toBe(true);
    expect(submitDisabled(wb({ scoreType: 'time' }))).toBe(false);
  });

  it('Score affiché à côté du Type, avec sa phrase d’aide', () => {
    const html = wb({ scoreType: 'time', wod_type: 'for-time' });
    expect(html).toContain('data-testid="champ-score"');
    expect(text(html)).toContain('Au time cap, l’athlète saisit ses reps.');
  });

  it('Sans score : classement grisé et coupé', () => {
    const html = wb({ scoreType: 'none', leaderboard: true });
    expect(text(html)).toContain('Pas de classement sans score');
    expect(html).toMatch(/role="switch" aria-checked="false" aria-label="Classement" disabled=""/);
  });

  it('WOD existant sans type : « Non défini : les athlètes choisissent », pas obligatoire', () => {
    const html = wb({ scoreType: '' }, { scoreLock: scoreLockFor([]) });
    expect(text(html)).toContain('Non défini : les athlètes choisissent.');
    expect(submitDisabled(html)).toBe(false);
  });

  it('WOD existant avec scores de types mêlés : verrouillé, raison affichée', () => {
    const html = wb({ scoreType: '' }, { scoreLock: scoreLockFor(['time', 'reps']) });
    expect(text(html)).toContain('le score ne peut plus changer');
    expect(html).toMatch(/data-testid="score-trigger"[^>]*disabled=""|disabled=""[^>]*data-testid="score-trigger"/);
  });

  it('Marketplace : pas de champ Score, une phrase', () => {
    const html = renderToStaticMarkup(React.createElement(WodEditor, { ...base, mode: 'programming', form: { ...EMPTY_WOD_FORM, title: 'X' } } as any));
    expect(html).not.toContain('data-testid="champ-score"');
    expect(text(html)).toContain(MARKETPLACE_SCORE_NOTE);
    expect(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Créer le WOD/s.test(html)).toBe(false);
  });
});

describe('séances de programme', () => {
  const seance: ProgramWod = {
    id: 's1', title: 'Fran', description: '21 Thruster', wod_type: 'for-time', block_name: null,
    time_cap_seconds: null, rounds: null, notes: null, video_url: null, leaderboard_enabled: false,
    emom_interval_minutes: null, tabata_work_seconds: null, tabata_rest_seconds: null,
    scheduled_date: null, program_week: 1, program_day: 2, sort_order: 0, is_published: true,
    score_type: 'time', text_mode: 'free',
  };

  it('le formulaire relit le Score ; l’enregistrement l’écrit', () => {
    const f = formulaireDepuisSeance(seance, 1);
    expect(f.scoreType).toBe('time');
    expect(f.scoreTypeAuto).toBe(false);
    expect(colonnesSeance(f, ['21 Thruster']).score_type).toBe('time');
  });

  it('les séances sont lues avec score_type et text_mode (sinon la duplication les perd)', () => {
    expect(COLONNES.split(', ')).toEqual(expect.arrayContaining(['score_type', 'text_mode']));
  });

  it('« Dupliquer la semaine » recopie score_type et text_mode', async () => {
    inserts.length = 0;
    await duplicateProgramWeek('prog', 'box', 'u', [seance]);
    const row = inserts.find(i => i.table === 'box_wods')!.row;
    expect(row.score_type).toBe('time');
    expect(row.text_mode).toBe('free');
    expect(row.program_week).toBe(2);
  });
});

describe('/admin/analytics', () => {
  it('les deux totaux de scores WOD excluent « Faite »', () => {
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'app/admin/analytics/page.tsx'), 'utf8') as string;
    const lignes = src.split('\n').filter(l => l.includes("from('wod_scores').select('*'"));
    expect(lignes).toHaveLength(2);
    for (const l of lignes) expect(l).toContain('.or(NOT_DONE)');
  });
});
