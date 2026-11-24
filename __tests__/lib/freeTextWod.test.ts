// WOD en texte libre (#453, PR 2b) : lecture de l'app, aperçu, passages de mode.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('pas de réseau en test'); } }));

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WodEditor from '@/components/wods/WodEditor';
import {
  APP_MOVEMENT_CATALOG, FREE_TEXT_ABBREVIATIONS, FREE_TEXT_EXTRA_MOVEMENTS, MOVEMENT_MAP, freeDescription, freeTextPreview, nearCatalogName, readFreeText, splitFreeDescription,
} from '@/lib/freeTextWod';
import { EMPTY_WOD_FORM, editorContent, sharedWodColumns, wodDescription } from '@/lib/wodFields';
import { editorMovements, freeTextFromRows, rowsFromFreeText } from '@/lib/wodEditorLines';
import { ProgramWod, colonnesSeance, formulaireDepuisSeance } from '@/lib/programContent';

(globalThis as unknown as { React: typeof React }).React = React;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const fixture = (f: string) => readFileSync(path.join(__dirname, '../../lib/__fixtures__', f));

describe('contrat partagé avec l’app (free-text-wod-contract.json)', () => {
  const bytes = fixture('free-text-wod-contract.json');
  const contract = JSON.parse(bytes.toString('utf8')) as { cases: { name: string; text: string; expected: unknown }[] };

  it('le fichier est celui de l’app, octet pour octet', () => {
    // nbstyle69/athlex-app#625 (fefa951), src/__tests__/fixtures/free-text-wod-contract.json
    expect(bytes.length).toBe(21723);
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('bc688a82907f1e71839567e6ede1b4708f7ddbe8d945d3be0fc49a81e7c36fec');
  });

  it('chaque cas porte blocks, rest, recognized, toFix, ignored', () => {
    expect(contract.cases).toHaveLength(12);
    for (const c of contract.cases) {
      expect(Object.keys(c.expected as object).sort()).toEqual(['blocks', 'ignored', 'recognized', 'rest', 'toFix']);
    }
  });

  it.each(contract.cases.map(c => [c.name, c] as const))('%s', (_n, c) => {
    expect(readFreeText(c.text)).toEqual(c.expected);
  });

  it('blocs rendus sans espaces de bord', () => {
    expect(readFreeText('  Back Squat — 5 × 5 @ 100 kg  \nFor time').blocks).toEqual(['Back Squat — 5 × 5 @ 100 kg']);
  });

  it('réouverture : même découpe que l’app (ligne vide en tête = aucun bloc)', () => {
    const d = '\nBack Squat — 5 × 5 @ 100 kg\n10 burpees';
    expect(splitFreeDescription(d)).toEqual({ blockLines: [], freeText: d });
    expect(readFreeText(d).blocks).toEqual([]);
  });
});

describe('catalogue de l’app (copie)', () => {
  const bytes = fixture('app-movementsCatalog.ts.txt');

  it('la référence est le fichier de l’app, octet pour octet', () => {
    expect(bytes.length).toBe(6291);
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('20d80ab27590c90b41935815dad1ae6e7b8e967aa072fa8ecab1cb1fcf0ee9bd');
  });

  it('la copie du Manager est la liste de l’app (noms, ordre, unités)', () => {
    const src = bytes.toString('utf8');
    const block = src.slice(src.indexOf('MOVEMENT_CATALOG: CatalogMovement[] = ['), src.indexOf('];'));
    const app = [...block.matchAll(/\{ name: '([^']*)'[^}]*\}/g)].map(m => {
      const u = m[0].match(/unit: '(\w+)'/);
      return u ? { name: m[1], unit: u[1] } : { name: m[1] };
    });
    expect(app).toHaveLength(64);
    expect(APP_MOVEMENT_CATALOG).toEqual(app);
  });
});

describe('lecture de l’app (copies de freeTextWod.ts et tournamentUtils.ts)', () => {
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const free = fixture('app-freeTextWod.ts.txt');
  const utils = fixture('app-tournamentUtils.ts.txt');

  it('les références sont les fichiers de l’app (fefa951), octet pour octet', () => {
    expect([free.length, sha(free)]).toEqual([8037, '30ed1aa44024ce1f6a1ee566b0bd5222eb746b17c1ecf1d662e709c7e7211f4b']);
    expect([utils.length, sha(utils)]).toEqual([14982, '5bfe20c3fcc298631c30e7b0caaaed28574093ad0d2ae194fc1aca0a76492351']);
  });

  it('MOVEMENT_MAP du Manager = celui de l’app', () => {
    const src = utils.toString('utf8');
    const block = src.slice(src.indexOf('const MOVEMENT_MAP'), src.indexOf('\n};', src.indexOf('const MOVEMENT_MAP')));
    const body = block.slice(block.indexOf('{') + 1).replace(/\/\/.*$/gm, '');
    const app: Record<string, string> = {};
    for (const m of body.matchAll(/(?:'([^']+)'|([\p{L}\w]+))\s*:\s*'([^']+)'/gu)) app[m[1] ?? m[2]] = m[3];
    expect(Object.keys(app).length).toBeGreaterThan(150);
    expect(MOVEMENT_MAP).toEqual(app);
  });

  it('mouvements propres au texte libre et abréviations = ceux de l’app', () => {
    const src = free.toString('utf8');
    const extra = src.slice(src.indexOf('FREE_TEXT_EXTRA_MOVEMENTS: CatalogMovement[] = ['), src.indexOf('];', src.indexOf('FREE_TEXT_EXTRA_MOVEMENTS:')));
    expect(FREE_TEXT_EXTRA_MOVEMENTS.map(m => m.name)).toEqual([...extra.matchAll(/name: '([^']+)'/g)].map(m => m[1]));
    expect(FREE_TEXT_EXTRA_MOVEMENTS).toHaveLength(10);
    const ab = src.slice(src.indexOf('FREE_TEXT_ABBREVIATIONS:'), src.indexOf('};', src.indexOf('FREE_TEXT_ABBREVIATIONS:')));
    expect(FREE_TEXT_ABBREVIATIONS).toEqual(Object.fromEntries([...ab.matchAll(/(\w+): '([^']+)'/g)].map(m => [m[1], m[2]])));
  });
});

describe('aperçu « Ce que l’app comprend »', () => {
  const MAQUETTE = "For time\n21 pull-ups + 15/12 cal ski + 21 thrusters @43/29\n1'30 rest\n18 chest-to-bar + 15/12 cal ski + 18 thrusters @43/29\n1'30 rest\n15 bar muscle-ups + 12/9 cal ski + 15 thrusters @43/29\nTC 14'\nRX+ : 12'";

  it('exemple de la maquette : tout est reconnu (« ski » → SkiErg depuis #453 PR 3c), groupé par ligne', () => {
    const p = freeTextPreview(MAQUETTE);
    expect([p.okCount, p.fixCount]).toEqual([9, 0]);
    expect(p.groups[0]).toEqual({
      line: '21 pull-ups + 15/12 cal ski + 21 thrusters @43/29',
      items: [
        { ok: true, text: 'Pull-ups · 21 reps' },
        { ok: true, text: 'SkiErg · 15 / 12 cal' },
        { ok: true, text: 'Thruster · 21 reps · ♂ 43 / ♀ 29 kg' },
      ],
    });
  });

  it('écritures reconnues : plus de suggestion ; non reconnues : la suggestion reste', () => {
    const p = freeTextPreview('21 T2B + 21 KB deadlifts @24/16\n10 STOH @60/40\n1 pow clean + 3 jerk');
    expect(p.groups.map(g => g.items)).toEqual([
      [{ ok: true, text: 'Toes-to-Bar · 21 reps' }, { ok: true, text: 'KB Deadlift · 21 reps · ♂ 24 / ♀ 16 kg' }],
      [{ ok: true, text: 'Shoulder to Overhead · 10 reps · ♂ 60 / ♀ 40 kg' }],
      [
        { ok: false, text: '« pow clean » n’est pas dans la liste officielle : écris « Power Clean » pour compter 1 rep' },
        { ok: false, text: '« jerk » n’est pas dans la liste officielle : non compté' },
      ],
    ]);
    expect(freeTextPreview('1 pow clean\n2 pow clean').groups[1].items[0].text).toBe('« pow clean » : écris « Power Clean » pour compter 2 reps');
  });

  it('lignes non comptées avec leur raison, doublons regroupés', () => {
    expect(freeTextPreview(MAQUETTE).ignored).toEqual([
      { text: 'For time', reason: 'format', count: 1 },
      { text: "1'30 rest", reason: 'repos', count: 2 },
      { text: "TC 14'", reason: 'time cap', count: 1 },
      { text: "RX+ : 12'", reason: 'objectif', count: 1 },
    ]);
  });

  it('nom du seul catalogue du Manager : « pas encore compté par l’app »', () => {
    const p = freeTextPreview('20 farmer carry', ['Farmer Carry']);
    expect(p.groups[0].items[0]).toEqual({ ok: false, text: '« farmer carry » : pas encore compté par l’app' });
    expect(p.fixCount).toBe(1);
  });

  it('nom du catalogue sans quantité, singulier, nom inconnu', () => {
    expect(freeTextPreview('Run').groups[0].items[0].text).toBe('« Run » : ajoute une quantité pour le compter');
    expect(freeTextPreview('1 pull-up').groups[0].items[0]).toEqual({ ok: true, text: 'Pull-ups · 1 rep' });
    expect(freeTextPreview('10 zorglub').groups[0].items[0].text)
      .toBe('« zorglub » n’est pas dans la liste officielle : non compté');
  });

  it('blocs Musculation et Cardio : chacun dans sa rubrique, ni « non comptés » ni « à corriger »', () => {
    const p = freeTextPreview('21 thrusters @43/29', [], ['Back Squat — 5 × 3 @ 80 %', 'Row ~ 2 × 500 m ~ 250 W', 'Deadlift — 3 × 5 @ 100 kg']);
    expect(p.strength).toEqual(['Back Squat — 5 × 3 @ 80 %', 'Deadlift — 3 × 5 @ 100 kg']);
    expect(p.cardio).toEqual(['Row ~ 2 × 500 m ~ 250 W']);
    expect(p.ignored).toEqual([]);
    expect([p.okCount, p.fixCount]).toEqual([1, 0]);
  });

  it('blocs en tête + série plus loin : rubriques pour la tête, « à corriger » pour la série', () => {
    const p = freeTextPreview('Back Squat — 5 × 3 @ 80 %\nRow ~ 2 × 500 m ~ 250 W\nFor time\n21 thrusters @43/29\nDeadlift — 3 × 5 @ 100 kg\nRun ~ 3 × 400 m');
    expect(p.strength).toEqual(['Back Squat — 5 × 3 @ 80 %']);
    expect(p.cardio).toEqual(['Row ~ 2 × 500 m ~ 250 W']);
    expect(p.ignored).toEqual([{ text: 'For time', reason: 'format', count: 1 }]);
    // #454 : la série de Musculation plus loin propose « Transformer en bloc Musculation » ;
    // la série Cardio reste « non lue ». Les deux restent à corriger.
    expect(p.groups[1]).toMatchObject({ line: 'Deadlift — 3 × 5 @ 100 kg', items: [], candidate: { label: 'Deadlift · 3 × 5 @ 100 kg' } });
    expect(p.groups[2]).toEqual(
      { line: null, items: [{ ok: false, text: '« Run ~ 3 × 400 m » : série écrite après le texte, non lue : mets-la en tête, avant le reste du texte' }] },
    );
    expect(p.groups).toHaveLength(3);
    expect([p.okCount, p.fixCount, p.candidateCount]).toEqual([1, 2, 1]);
  });

  it('une ligne vide en tête : aucune rubrique, la série est à corriger (comme l’app)', () => {
    const p = freeTextPreview('\nBack Squat — 5 × 5 @ 100 kg\n10 burpees');
    expect([p.strength, p.cardio]).toEqual([[], []]);
    expect([p.okCount, p.fixCount]).toEqual([1, 1]);
  });

  it('aperçu et contrat : mêmes blocs que readFreeText de l’app', () => {
    const c = JSON.parse(fixture('free-text-wod-contract.json').toString('utf8')).cases[2];
    const p = freeTextPreview(c.text);
    expect([...p.strength, ...p.cardio]).toEqual(c.expected.blocks);
  });

  it('une ligne d’un seul morceau n’a pas de titre de groupe', () => {
    expect(freeTextPreview('10 wall balls @9/6').groups).toEqual([{ line: null, items: [{ ok: true, text: 'Wall Balls · 10 reps · ♂ 9 / ♀ 6 kg' }] }]);
  });

  it('noms proches', () => {
    expect(nearCatalogName('ski')).toBe('SkiErg');
    expect(nearCatalogName('pull-up')).toBe('Pull-ups');
    expect(nearCatalogName('thrustr')).toBe('Thruster');
    expect(nearCatalogName('zorglub')).toBeNull();
    expect(nearCatalogName('ab')).toBeNull();
  });
});

describe('description en texte libre : enregistrée telle quelle', () => {
  const libre = "For time\n  21 pull-ups + 15/12 cal ski\n\n1'30 rest  ";

  it('sans série : le texte exact, espaces et lignes vides compris', () => {
    expect(freeDescription([], libre)).toBe(libre);
    expect(freeDescription([], '   ')).toBeNull();
  });

  it('avec des séries : en tête, puis le texte intact ; relu à l’identique', () => {
    const d = freeDescription(['Back Squat — 5 × 3 @ 80 %'], libre)!;
    expect(d).toBe(`Back Squat — 5 × 3 @ 80 %\n${libre}`);
    expect(splitFreeDescription(d)).toEqual({ blockLines: ['Back Squat — 5 × 3 @ 80 %'], freeText: libre });
    expect(editorContent(d, 'free')).toEqual({ movements: ['Back Squat — 5 × 3 @ 80 %'], textMode: 'free', freeText: libre });
  });

  it('WOD en lignes : relecture d’avant, inchangée', () => {
    expect(editorContent('21 Thruster\n\n15 Pull-ups', 'lines')).toEqual({ movements: ['21 Thruster', '15 Pull-ups'], textMode: 'lines', freeText: '' });
  });

  it('enregistrement : texte libre tel quel, lignes comme avant ; text_mode écrit', () => {
    const f = { ...EMPTY_WOD_FORM, title: 'X', textMode: 'free' as const, freeText: libre };
    expect(wodDescription(f, 'autre', [])).toBe(libre);
    expect(sharedWodColumns(f, []).description).toBe(libre);
    expect(wodDescription({ ...f, textMode: 'lines' }, null, ['21 Thruster'])).toBe('21 Thruster');
    expect(sharedWodColumns(f, []).text_mode).toBe('free');
  });
});

describe('passages de mode sans perte', () => {
  it('Mouvements → Texte libre → Mouvements : mêmes lignes', () => {
    const lignes = ['For time', '21 pull-ups + 15/12 cal ski + 21 thrusters @43/29', '21 Thruster (43/29 kg)', '15/12 cal SkiErg', "TC 14'", 'Run'];
    const rows = rowsFromFreeText(lignes.join('\n'));
    const texte = freeTextFromRows(rows);
    expect(texte).toBe(lignes.join('\n'));
    expect(freeTextFromRows(rowsFromFreeText(texte))).toBe(texte);
  });

  it('en texte libre, movements ne porte que les séries (le texte est à part)', () => {
    const rows = rowsFromFreeText('21 Thruster');
    expect(editorMovements(true, rows, [], [])).toEqual([]);
    expect(editorMovements(false, rows, [], [])).toEqual(['21 Thruster']);
  });

  it('Texte libre → Mouvements : une ligne non reconnue reste une ligne libre', () => {
    const rows = rowsFromFreeText("1'30 rest\n\n  RX+ : 12'  ");
    expect(rows.map(r => r.raw)).toEqual(["1'30 rest", "RX+ : 12'"]);
    expect(rows.every(r => r.free)).toBe(true);
  });
});

describe('éditeur : sélecteur Mouvements | Texte libre', () => {
  const base = {
    heading: 'Créer un WOD', submitLabel: 'Créer le WOD', setForm: () => {}, setMovements: () => {},
    saving: false, error: null, onClose: () => {}, onSubmit: () => {},
  };
  const render = (mode: string, form: Record<string, unknown>, movements: string[] = []) => renderToStaticMarkup(
    React.createElement(WodEditor, { ...base, mode, movements, form: { ...EMPTY_WOD_FORM, title: 'X', ...form } } as any));

  it('Texte libre : zone de texte, aperçu, compteur ; pas de bouton « Ajouter »', () => {
    const html = render('whiteboard', { textMode: 'free', freeText: '21 pull-ups + 15/12 cal ski + 10 wall balls' });
    expect(html).toContain('data-testid="texte-libre"');
    expect(html).toContain('data-testid="apercu-texte-libre"');
    expect(text(html)).toContain('3 mouvements comptent · 0 à corriger');
    expect(text(html)).toContain('Crédités dans les badges seulement quand le score prouve la séance terminée.');
    expect(text(html)).toContain('Les séries Musculation et Cardio sont lues seulement si elles sont écrites en tête, avant le reste du texte.');
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>Texte libre/);
    expect(text(html)).not.toMatch(/Programme \/ Mouvements Ajouter/);
  });

  it('Mouvements : sélecteur présent, pas d’aperçu', () => {
    const html = render('whiteboard', { textMode: 'lines' });
    expect(html).toContain('data-testid="selecteur-mode"');
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>Mouvements/);
    expect(html).not.toContain('data-testid="apercu-texte-libre"');
  });

  it('Musculation et Cardio restent disponibles en texte libre', () => {
    const html = render('whiteboard', { textMode: 'free', freeText: '' }, ['Back Squat — 5 × 3 @ 80 %']);
    expect(text(html)).toContain('Musculation');
    expect(html).toContain('aria-label="Exercice de musculation"');
    expect(html).not.toContain('hidden=""');
    expect(html).toContain('data-testid="apercu-musculation"');
  });

  it('aperçu : séries des blocs dans leurs rubriques', () => {
    const html = render('whiteboard', { textMode: 'free', freeText: '21 thrusters @43/29' }, ['Back Squat — 5 × 3 @ 80 %', 'Row ~ 2 × 500 m ~ 250 W']);
    const t = text(html);
    expect(t).toContain('Musculation : séance guidée dans l’app (grille de séries) Back Squat — 5 × 3 @ 80 %');
    expect(t).toContain('Cardio : compté dans les badges cardio Row ~ 2 × 500 m ~ 250 W');
    expect(t).not.toContain('Non comptées');
    expect(t).toContain('1 mouvement compte · 0 à corriger');
  });

  it('Marketplace : même sélecteur qu’un WOD de box (#453, PR 2c)', () => {
    expect(render('programming', {})).toContain('data-testid="selecteur-mode"');
  });
});

describe('séances de programme en texte libre', () => {
  const seance: ProgramWod = {
    id: 's1', title: 'Libre', description: "For time\n21 pull-ups", wod_type: null, block_name: null,
    time_cap_seconds: null, rounds: null, notes: null, video_url: null, leaderboard_enabled: false,
    emom_interval_minutes: null, tabata_work_seconds: null, tabata_rest_seconds: null,
    scheduled_date: null, program_week: 1, program_day: 1, sort_order: 0, is_published: true,
    score_type: 'none', text_mode: 'free',
  };

  it('relue en texte libre et réécrite telle quelle', () => {
    const f = formulaireDepuisSeance(seance, 1);
    expect([f.textMode, f.freeText]).toEqual(['free', "For time\n21 pull-ups"]);
    const p = colonnesSeance(f, editorContent(seance.description, 'free').movements);
    expect([p.text_mode, p.description]).toEqual(['free', "For time\n21 pull-ups"]);
  });
});
