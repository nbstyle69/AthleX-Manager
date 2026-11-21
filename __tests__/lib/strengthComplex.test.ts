// Complexes de musculation (#454, PR B) : carte Complexe de l'éditeur et
// « Transformer en bloc Musculation » dans le texte libre.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('pas de réseau en test'); } }));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WodEditor from '@/components/wods/WodEditor';
import FreeTextPreview from '@/components/wods/FreeTextPreview';
import { parseMovementRow } from '@/lib/movements';
import { freeTextPreview, freeTextWithout, readFreeText, strengthCandidate } from '@/lib/freeTextWod';
import { parseStrengthLine, serializeStrength } from '@/lib/strengthBlock';
import { EMPTY_WOD_FORM, editorContent, sharedWodColumns } from '@/lib/wodFields';
import { offerWodPayload } from '@/lib/offerWod';
import { colonnesSeance } from '@/lib/programContent';
import {
  COMPLEX_TWO_MOVES, StrengthRow, addComplexMove, changeStrengthUnit, complexRefName, composeMovements,
  emptyComplexEntry, removeComplexMove, repsWord, serializeStrengthRow, setComplexRef, strengthRowError,
  strengthRowsFromLines, strengthUnitChoices, transformFreeTextLine, updateComplexMove, updateStrengthRow,
} from '@/lib/wodEditorLines';

(globalThis as unknown as { React: typeof React }).React = React;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const BRIEF = 'Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean — repos 2:00';
const CATALOG = ['Deadlift', 'Hang Power Clean', 'Power Clean', 'Back Squat', 'Push Jerk'];

/** Carte Complexe remplie comme le ferait le coach. */
function filled(): StrengthRow[] {
  let rows: StrengthRow[] = [emptyComplexEntry()];
  rows = updateComplexMove(rows, 0, 0, { name: 'Deadlift' });
  rows = updateComplexMove(rows, 0, 1, { name: 'Hang Power Clean' });
  rows = addComplexMove(rows, 0);
  rows = updateComplexMove(rows, 0, 2, { name: 'Power Clean' });
  return rows;
}

describe('carte Complexe : écriture au format exact', () => {
  it('nouvelle carte : deux mouvements à nommer, 5 × 1, charge en kg, rien d’écrit', () => {
    const e = emptyComplexEntry();
    expect(e).toMatchObject({ name: 'Complexe', sets: 5, reps: 1, load: null, unit: 'kg' });
    expect(e.complex!.movements).toEqual([{ reps: 1, name: '' }, { reps: 1, name: '' }]);
    expect(serializeStrength(e)).toBe('');
    expect(strengthRowError(e)).toBeNull();
  });

  it('%1RM du dernier mouvement par défaut, repos 2:00 : la ligne du brief', () => {
    let rows = filled();
    rows = changeStrengthUnit(rows, 0, '%1RM');
    rows = updateStrengthRow(rows, 0, { load: 75, restSec: 120 });
    expect(complexRefName(rows[0])).toBe('Power Clean');
    expect(serializeStrengthRow(rows[0])).toBe(BRIEF);
  });

  it('mouvement de référence choisi dans la liste', () => {
    let rows = changeStrengthUnit(filled(), 0, '%1RM');
    rows = updateStrengthRow(rows, 0, { load: 70 });
    rows = setComplexRef(rows, 0, 'Deadlift');
    expect(complexRefName(rows[0])).toBe('Deadlift');
    expect(serializeStrengthRow(rows[0])).toBe('Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 70 %1RM Deadlift');
  });

  it('référence retirée du complexe : le dernier mouvement, à l’écran comme à l’écriture', () => {
    let rows = setComplexRef(changeStrengthUnit(filled(), 0, '%1RM'), 0, 'Hang Power Clean');
    rows = updateStrengthRow(rows, 0, { load: 70 });
    rows = removeComplexMove(rows, 0, 1);
    expect(complexRefName(rows[0])).toBe('Power Clean');
    expect(serializeStrengthRow(rows[0])).toMatch(/@ 70 %1RM Power Clean$/);
  });

  it('charge en kg : sans mouvement de référence ; charge libre, repos, tempo comme une ligne normale', () => {
    let rows = filled();
    rows = updateComplexMove(rows, 0, 0, { reps: 2 });
    rows = updateStrengthRow(rows, 0, { sets: 4, reps: 2, load: 80, loadNote: 'RPE 8', restSec: 90, tempo: '21X1' });
    expect(serializeStrengthRow(rows[0]))
      .toBe('Complexe — 2 Deadlift + 1 Hang Power Clean + 1 Power Clean — 4 × 2 @ 80 kg — charge RPE 8 — repos 1:30 — tempo 21X1');
  });

  it('unités proposées : kg et %1RM, jamais « % du max »', () => {
    expect(strengthUnitChoices(filled()[0])).toEqual(['kg', '%1RM']);
    expect(strengthUnitChoices({ ...filled()[0], name: 'Ring Muscle-up' })).toEqual(['kg', '%1RM']);
  });

  it('au moins deux mouvements : la corbeille ne descend pas sous deux', () => {
    const rows = filled();
    const two = removeComplexMove(rows, 0, 2);
    expect(two[0].complex!.movements).toHaveLength(2);
    expect(removeComplexMove(two, 0, 0)).toBe(two);
  });

  it('un seul mouvement nommé : erreur qui bloque l’enregistrement', () => {
    const rows = updateComplexMove([emptyComplexEntry()], 0, 0, { name: 'Deadlift' });
    expect(strengthRowError(rows[0])).toBe(COMPLEX_TWO_MOVES);
    expect(serializeStrengthRow(rows[0])).toBe('');
    expect(strengthRowError(filled()[0])).toBeNull();
  });

  it('« rep » au singulier, « reps » au-delà', () => {
    expect(repsWord(1)).toBe('rep');
    expect(repsWord(2)).toBe('reps');
    expect(repsWord(0)).toBe('rep');
  });

  it('un « + » dans un nom ne casse pas la ligne', () => {
    const rows = updateComplexMove(filled(), 0, 1, { name: 'Hang + Power Clean' });
    expect(parseStrengthLine(serializeStrengthRow(rows[0]))?.complex?.movements.map(m => m.name))
      .toEqual(['Deadlift', 'Hang Power Clean', 'Power Clean']);
  });

  it('lecture stricte : nommé « Complexe », reps d’au moins 1 par mouvement', () => {
    expect(parseStrengthLine('Olympic — 1 Deadlift + 1 Power Clean — 5 × 1')).toBeNull();
    expect(parseStrengthLine('Complexe — 0 Deadlift + 1 Power Clean — 5 × 1')).toBeNull();
    expect(parseStrengthLine('complexe — 1 Deadlift + 1 Power Clean — 5 × 1')?.complex?.movements).toHaveLength(2);
  });

  it('jamais de reps de badge : le crédit du metcon ignore la ligne', () => {
    expect(parseMovementRow(BRIEF).reps).toBeNull();
  });
});

describe('relecture à l’ouverture d’un WOD', () => {
  it('le complexe redevient une carte, texte d’origine gardé tant qu’il n’est pas touché', () => {
    const rows = strengthRowsFromLines(['Back Squat — 5 × 3 @ 80 %1RM', BRIEF, '21 Thruster']);
    expect(rows).toHaveLength(2);
    expect(rows[1].complex?.refName).toBe('Power Clean');
    expect(rows[1].raw).toBe(BRIEF);
    expect(composeMovements([], rows, [])).toEqual(['Back Squat — 5 × 3 @ 80 %1RM', BRIEF]);
  });

  it('en texte libre, un complexe en tête est une série du bloc', () => {
    const c = editorContent(`${BRIEF}\nFor time\n21 thrusters`, 'free');
    expect(c.movements).toEqual([BRIEF]);
    expect(c.freeText).toBe('For time\n21 thrusters');
  });
});

describe('même écriture : WOD de box, offre Marketplace, séance de programme', () => {
  const form = { ...EMPTY_WOD_FORM, title: 'Force', scoreType: 'weight' as const };
  it.each([
    ['WOD de box', (m: string[]) => sharedWodColumns(form, m).description],
    ['offre Marketplace', (m: string[]) => offerWodPayload(form, m).description],
    ['séance de programme', (m: string[]) => colonnesSeance(form, m).description],
  ])('%s', (_n, write) => {
    expect(write([BRIEF, '21 Thruster'])).toBe(`${BRIEF}\n21 Thruster`);
    expect(write([BRIEF])).toBe(BRIEF);
  });

  it('texte libre : le complexe transformé s’écrit en tête, avant le texte', () => {
    const free = { ...form, textMode: 'free' as const, freeText: 'For time\n21 thrusters' };
    expect(sharedWodColumns(free, [BRIEF]).description).toBe(`${BRIEF}\nFor time\n21 thrusters`);
    expect(readFreeText(sharedWodColumns(free, [BRIEF]).description).blocks).toEqual([BRIEF]);
  });
});

describe('« Transformer en bloc Musculation » : formes connues', () => {
  it('maquette 188:86 : complexe écrit à la main', () => {
    const c = strengthCandidate('5 × (1 deadlift + 1 hang power clean + 1 power clean) @75% power clean', CATALOG)!;
    expect(c.label).toBe('Complexe · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean · 5 × 1 @ 75 %1RM Power Clean');
    expect(c.guessedPct).toBe(true);
    expect(c.entry.raw).toBeUndefined();
    expect(serializeStrength(c.entry)).toBe('Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean');
  });

  it('maquette 188:86 : « Back squat 5×3 @80% » lu comme %1RM, à vérifier', () => {
    const c = strengthCandidate('Back squat 5×3 @80%', CATALOG)!;
    expect(c.label).toBe('Back Squat · 5 × 3 @ 80 %1RM');
    expect(c.guessedPct).toBe(true);
  });

  it('kg et %1RM écrits en toutes lettres ne sont pas « à vérifier »', () => {
    expect(strengthCandidate('Back squat 5x3 @ 100 kg', CATALOG)).toMatchObject({ label: 'Back Squat · 5 × 3 @ 100 kg', guessedPct: false });
    expect(strengthCandidate('Back squat 5x3 @80 %1RM', CATALOG)?.guessedPct).toBe(false);
    expect(strengthCandidate('Pull-ups 4 x 8', CATALOG)?.label).toBe('Pull-ups · 4 × 8');
    expect(strengthCandidate('3 x (2 power clean + 1 push jerk) @ 80 kg', CATALOG)?.label)
      .toBe('Complexe · 2 Power Clean + 1 Push Jerk · 3 × 1 @ 80 kg');
  });

  it('référence absente = le dernier ; hors du complexe = refusée ; nommée avec une charge en kg = refusée', () => {
    expect(strengthCandidate('5 x (1 deadlift + 1 power clean) @70%', CATALOG)?.entry.complex?.refName).toBe('Power Clean');
    expect(strengthCandidate('5 x (1 deadlift + 1 power clean) @70% deadlift', CATALOG)?.entry.complex?.refName).toBe('Deadlift');
    expect(strengthCandidate('5 x (1 deadlift + 1 power clean) @70% back squat', CATALOG)).toBeNull();
    expect(strengthCandidate('5 x (1 deadlift + 1 power clean) @70 kg deadlift', CATALOG)).toBeNull();
  });

  it('au moins deux mouvements, chacun avec ses reps', () => {
    expect(strengthCandidate('5 x (1 deadlift) @70%', CATALOG)).toBeNull();
    expect(strengthCandidate('5 x (deadlift + 1 power clean)', CATALOG)).toBeNull();
    expect(strengthCandidate('5 x (0 deadlift + 1 power clean)', CATALOG)).toBeNull();
    expect(strengthCandidate('0 x (1 deadlift + 1 power clean)', CATALOG)).toBeNull();
    expect(strengthCandidate('Back squat 0x3', CATALOG)).toBeNull();
  });

  it('format exact (complexe compris) : repris tel quel', () => {
    const c = strengthCandidate(`  ${BRIEF}  `, CATALOG)!;
    expect(c.line).toBe(BRIEF);
    expect(c.entry.raw).toBe(BRIEF);
    expect(c.guessedPct).toBe(false);
    expect(c.label).toBe('Complexe · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean · 5 × 1 @ 75 %1RM Power Clean · repos 2:00');
  });

  it('nom hors du catalogue : gardé tel qu’écrit', () => {
    expect(strengthCandidate('Zercher squat 5x3', CATALOG)?.entry.name).toBe('Zercher squat');
  });

  it('pas une ligne de musculation : metcon, cardio, format, repos', () => {
    for (const l of ['21 thrusters @43/29', 'Row ~ 2 × 500 m', 'For time', "Repos 2'", 'Olympic complex', '15/12 cal ski', 'Run 5 x 400m']) {
      expect(strengthCandidate(l, CATALOG)).toBeNull();
    }
  });
});

describe('aperçu : lignes repérées hors de la tête du texte', () => {
  const MAQUETTE = 'Olympic complex\n5 × (1 deadlift + 1 hang power clean + 1 power clean) @75% power clean\nRepos 2\'\nBack squat 5×3 @80%';

  it('deux lignes repérées, à corriger tant que non transformées', () => {
    const p = freeTextPreview(MAQUETTE, CATALOG);
    expect(p.candidateCount).toBe(2);
    expect(p.groups.filter(g => g.candidate).map(g => g.line)).toEqual([
      '5 × (1 deadlift + 1 hang power clean + 1 power clean) @75% power clean', 'Back squat 5×3 @80%',
    ]);
    expect(p.fixCount).toBe(3);   // les deux lignes + « Olympic complex »
    expect(p.ignored).toEqual([{ text: "Repos 2'", reason: 'repos', count: 1 }]);
  });

  it('format exact écrit après le texte : à transformer, plus une série « non lue » muette', () => {
    const p = freeTextPreview(`For time\n21 thrusters @43/29\n${BRIEF}`, CATALOG);
    expect(p.groups.at(-1)).toMatchObject({ line: BRIEF, candidate: { entry: { raw: BRIEF } } });
    expect(p.fixCount).toBe(1);
    // L'app, elle, ne la lit pas (contrat) : toujours « à corriger ».
    expect(readFreeText(`For time\n${BRIEF}`).toFix).toEqual([BRIEF]);
  });

  it('ligne de format (« EMOM 10 x 3 », « Tabata 8 x 20 ») : ignorée, jamais proposée', () => {
    const p = freeTextPreview('For time\nEMOM 10 x 3\nTabata 8 x 20', CATALOG);
    expect(p.candidateCount).toBe(0);
    expect(p.ignored.map(i => i.text)).toEqual(['For time', 'EMOM 10 x 3', 'Tabata 8 x 20']);
  });

  it('une série Cardio plus loin reste « non lue », sans transformation', () => {
    const p = freeTextPreview('For time\nRow ~ 2 × 500 m', CATALOG);
    expect(p.candidateCount).toBe(0);
    expect(p.groups[0].items[0].text).toContain('série écrite après le texte, non lue');
  });

  it('en tête : un bloc lu par l’app, rien à transformer', () => {
    const p = freeTextPreview(`${BRIEF}\nFor time`, CATALOG);
    expect(p.strength).toEqual([BRIEF]);
    expect(p.candidateCount).toBe(0);
  });

  it('rendu : bouton, interprétation, note, compteur ; repos « à reporter »', () => {
    const html = renderToStaticMarkup(React.createElement(FreeTextPreview, { text: MAQUETTE, managerCatalog: CATALOG, onTransform: () => {} }));
    const t = text(html);
    expect(html.match(/data-testid="apercu-a-transformer"/g)).toHaveLength(2);
    expect(html.match(/>Transformer en bloc Musculation</g)).toHaveLength(2);
    expect(t).toContain('Complexe · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean · 5 × 1 @ 75 %1RM Power Clean');
    expect(t).toContain('Lu comme %1RM : à vérifier avant de transformer.');
    expect(t).toContain('2 lignes de musculation repérées');
    expect(t).toContain("« Repos 2' » (repos : à reporter dans le bloc après transformation)");
  });

  it('rendu : note par défaut quand la charge est écrite en toutes lettres', () => {
    const t = text(renderToStaticMarkup(React.createElement(FreeTextPreview, { text: `For time\n${BRIEF}`, managerCatalog: CATALOG, onTransform: () => {} })));
    expect(t).toContain('Tant que la ligne n’est pas transformée, l’athlète voit le texte, sans grille ni charge calculée.');
    expect(t).toContain('1 ligne de musculation repérée');
  });

  it('rendu sans éditeur (onTransform absent) : pas de bouton', () => {
    const html = renderToStaticMarkup(React.createElement(FreeTextPreview, { text: MAQUETTE, managerCatalog: CATALOG }));
    expect(html).not.toContain('Transformer en bloc Musculation');
  });
});

describe('transformation et « Annuler »', () => {
  const TEXT = 'Olympic complex\n5 × (1 deadlift + 1 power clean) @75% power clean\nRepos 2\'\nBack squat 5×3 @80%';
  const back: StrengthRow = { ...parseStrengthLine('Front Squat — 3 × 3')!, raw: 'Front Squat — 3 × 3' };

  it('la ligne quitte le texte et devient la dernière carte du bloc', () => {
    const c = strengthCandidate('Back squat 5×3 @80%', CATALOG)!;
    const r = transformFreeTextLine(TEXT, [back], null, c);
    expect(r.freeText).toBe('Olympic complex\n5 × (1 deadlift + 1 power clean) @75% power clean\nRepos 2\'');
    expect(r.rows).toEqual([back, c.entry]);
    expect(r.undo).toEqual({ freeText: TEXT, rows: [back], count: 1 });
  });

  it('deux transformations : « Annuler » rend l’état d’avant la première', () => {
    const a = strengthCandidate('Back squat 5×3 @80%', CATALOG)!;
    const b = strengthCandidate('5 × (1 deadlift + 1 power clean) @75% power clean', CATALOG)!;
    const r1 = transformFreeTextLine(TEXT, [back], null, a);
    const r2 = transformFreeTextLine(r1.freeText, r1.rows, r1.undo, b);
    expect(r2.freeText).toBe('Olympic complex\nRepos 2\'');
    expect(r2.rows.map(serializeStrengthRow)).toEqual([
      'Front Squat — 3 × 3', 'Back Squat — 5 × 3 @ 80 %1RM', 'Complexe — 1 Deadlift + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean',
    ]);
    expect(r2.undo).toEqual({ freeText: TEXT, rows: [back], count: 2 });
  });

  it('freeTextWithout : seulement la première occurrence, espaces de bord ignorés', () => {
    expect(freeTextWithout('a\n  x  \nb\nx', 'x')).toBe('a\nb\nx');
    expect(freeTextWithout('a\nb', 'x')).toBe('a\nb');
  });
});

describe('éditeur : bloc Musculation (maquette 183:3)', () => {
  const base = {
    heading: 'Créer un WOD', submitLabel: 'Créer le WOD', setForm: () => {}, setMovements: () => {},
    saving: false, error: null, onClose: () => {}, onSubmit: () => {},
  };
  const render = (mode: string, movements: string[], form: Record<string, unknown> = {}) => renderToStaticMarkup(
    React.createElement(WodEditor, { ...base, mode, movements, form: { ...EMPTY_WOD_FORM, title: 'X', ...form } } as never));

  it.each(['whiteboard', 'programming', 'program'])('%s : « Ajouter un complexe » dans l’en-tête', mode => {
    const html = render(mode, []);
    expect(html).toContain('data-testid="ajouter-complexe"');
    expect(text(html)).toContain('Ajouter une série Ajouter un complexe');
  });

  it('carte Complexe relue : mouvements, « rep », référence, ligne écrite, rappel 1RM', () => {
    const html = render('whiteboard', [BRIEF]);
    const t = text(html);
    expect(html.match(/data-testid="carte-complexe"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Mouvement 3 du complexe"');
    expect(html).toMatch(/value="Power Clean"[^>]*aria-label="Mouvement 3 du complexe"|aria-label="Mouvement 3 du complexe"[^>]*value="Power Clean"/);
    expect(t).toContain('Complexe rep rep rep Ajouter un mouvement au complexe');
    expect(t).toContain('Ajouter un mouvement au complexe');
    expect(t).toContain('× complexe');
    expect(html).toContain('%1RM de…');
    expect(html).toContain('aria-label="Mouvement de référence du %1RM"');
    expect(html).toMatch(/<option value="Power Clean" class="[^"]*" selected=""/);
    expect(t).toContain(BRIEF);
    expect(t).toContain('Un complexe ne met jamais à jour un 1RM et ne compte pas de reps de badge.');
    expect(html).toContain('value="120"');
  });

  it('complexe en kg : pas de sélecteur de référence ; « reps » au-delà de 1', () => {
    const html = render('whiteboard', ['Complexe — 2 Power Clean + 1 Push Jerk — 4 × 2 @ 80 kg']);
    expect(html).not.toContain('aria-label="Mouvement de référence du %1RM"');
    expect(text(html)).toContain('Complexe reps rep Ajouter');
  });

  it('un complexe de deux mouvements : corbeilles des mouvements désactivées', () => {
    const html = render('whiteboard', ['Complexe — 2 Power Clean + 1 Push Jerk — 4 × 2 @ 80 kg']);
    expect(html.match(/disabled=""[^>]*aria-label="Retirer le mouvement \d"/g)).toHaveLength(2);
  });
});
