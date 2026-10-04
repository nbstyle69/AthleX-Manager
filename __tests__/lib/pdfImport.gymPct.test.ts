import { parseDocument } from '@/lib/pdfImport/core';
import { resolveMovementName } from '@/lib/pdfImport/movements';
import { parseStrengthLine } from '@/lib/pdfImport/strength';
import { entryToBoxWod, serializeImportMovement, serializeImportStrength } from '@/lib/pdfImport/serialize';
import { kplusPerf } from '@/lib/pdfImport/profiles/kplus-perf';
import { gymPrLabel } from '@/lib/gymMovements';
import { parseStrengthLine as parseStrengthLineEditor } from '@/lib/strengthBlock';
import type { ImportEntry, ParsedStrength } from '@/lib/pdfImport/types';

/**
 * Retour R2 (1.0.61) : la gymnastique en % du max à l'import PDF. Un % sur un
 * des 11 mouvements de `lib/gymMovements.ts` s'écrit `Mvt — S × P % du max`,
 * jamais en ligne de metcon ni en %1RM ; S vient de la section ou la ligne
 * reste non structurée.
 */

const opts = { synonyms: kplusPerf.synonyms, typoFixes: kplusPerf.typoFixes };

/** Une journée K+ Perf avec une section GYM faite des sous-blocs donnés. */
function gymDay(...subBlocks: string[]): ImportEntry[] {
  const body = subBlocks.map((b, i) => `${i + 1}) ${b}`).join('\n');
  const r = parseDocument([
    { index: 1, text: 'K+ PERF\nPROGRAMMATION S41' },
    { index: 2, text: `LUNDI | S41\n🎯 GYM\n${body}\n2` },
  ], kplusPerf, '2026-10-05');
  return r.entries;
}

function row(e: ImportEntry) {
  return entryToBoxWod(e, { boxId: 'b', userId: 'u', sourcePdfUrl: null, sortOrder: 0 });
}

function gs(p: Partial<ParsedStrength>): ParsedStrength {
  return { exercise: 'Toes-to-Bar', resolved: true, sets: null, reps: null, percent: null, rpe: null, charge_note: null, tempo: null, rest: null, ...p };
}

describe('gymnastique en % : « Mvt — S × P % du max », S tiré de la section', () => {
  it("EMOM 7' à une ligne → 7 séries ; plus de ligne de metcon ; consignes en notes", () => {
    const [e] = gymDay("BMU (technique)\nEMOM 7' :\n- 20% BMU (Série Max BMU UBK) (CAP à 7)");
    expect(e.movements).toEqual([]);
    const r = row(e);
    expect(r.description).toBe('Bar Muscle-ups — 7 × 20 % du max');
    expect(r.notes).toContain('Bar Muscle-ups : max UBK · CAP à 7');
    expect(e.warnings).not.toContain('strength-unstructured');
  });

  it('EMOM alterné, liste de minutes → une série par minute listée', () => {
    const [e] = gymDay('HSPU X T2B (résistance)\nEMOM :\n- Min 1/3/5/7/9/11 : 35% T2B (CAP à 15)\n- Min 2/4/6/8/10/12 : 25% Strict HSPU (CAP à 6)');
    expect(row(e).description).toBe('Toes-to-Bar — 6 × 35 % du max\nStrict Handstand Push-Ups — 6 × 25 % du max');
  });

  it("Every 1'30 X 4 Rounds → 4 séries", () => {
    const [e] = gymDay("C2B (technique)\nEvery 1'30 X 4 Rounds :\n- 33% C2B (CAP à 16)");
    expect(row(e).description).toBe('Chest-to-Bar — 4 × 33 % du max');
  });

  it('entêtes « N rounds » / « N séries » : chacun vaut pour les lignes qui le suivent', () => {
    const [e] = gymDay("BMU X C2B (résistance)\n3 Rounds :\n- 30% BMU\n1' Rest Each rounds\n5 Rounds :\n- 20% C2B\n4 séries :\n- 25% RMU");
    expect(row(e).description).toBe('Bar Muscle-ups — 3 × 30 % du max\nChest-to-Bar — 5 × 20 % du max\nRing Muscle-ups — 4 × 25 % du max');
  });

  it.each([
    ["EMOM à deux lignes sans liste de minutes", "EMOM 12' :\n- 20% BMU\n- 20% C2B"],
    ['une seule minute listée', "EMOM 20' :\n- Min 2 : 30% T2B"],
    ['AMRAP', "AMRAP 10' :\n- 30% T2B"],
    ['Tabata sans rounds écrits', 'TABATA :\n- 30% T2B'],
    ['aucun format', '- 30% T2B'],
  ])('séries ambiguës (%s) → non structurée, carte orange, rien d’inventé', (_, block) => {
    const [e] = gymDay(`GYM\n${block}`);
    const r = row(e);
    expect(e.warnings).toContain('strength-unstructured');
    expect(r.description ?? '').not.toMatch(/% du max|^\d+%/m);
    expect(r.notes).toMatch(/Musculation \(non structurée\) :\n- (?:Toes-to-Bar|Bar Muscle-ups) \d+ % du max/);
  });

  it('une charge sur une ligne de gym en % la laisse non structurée (jamais de « charge »)', () => {
    const [e] = gymDay("GYM\nEMOM 7' :\n- 20% BMU @10kg");
    const r = row(e);
    expect(e.warnings).toContain('strength-unstructured');
    expect(r.description ?? '').not.toMatch(/charge|kg/);
    expect(r.notes).toMatch(/Bar Muscle-ups 20 % du max \(charge 10kg\)/);
  });

  it('un % sur un mouvement hors des 11 reste une ligne de metcon', () => {
    const [e] = gymDay("GYM\nEMOM 7' :\n- 40% Wall Balls");
    expect(e.musculation).toEqual([]);
    expect(row(e).description).toBe('40% Wall Balls');
  });
});

describe('gymnastique « NxM @ P % » (section de force) : les reps écrites gagnent', () => {
  it('ligne « Mvt — N × M », le % en notes, jamais de %1RM', () => {
    const s = parseStrengthLine('- 6X5 Toes-to-Bar @35%', opts)!;
    const out = serializeImportStrength([s]);
    expect(out.lines).toEqual(['Toes-to-Bar — 6 × 5']);
    expect(out.gymNotes).toEqual(['Toes-to-Bar : 35 % du max']);
    expect(out.chargeNotes).toEqual([]);
  });
  it('fourchette → ligne sans charge, fourchette en % du max dans les notes', () => {
    const out = serializeImportStrength([parseStrengthLine('- 3X8 RMU @30-40%', opts)!]);
    expect(out.lines).toEqual(['Ring Muscle-ups — 3 × 8']);
    expect(out.gymNotes).toEqual(['Ring Muscle-ups : 30-40 % du max']);
  });
  it('les notes du WOD portent « <Mvt> : P % du max »', () => {
    const entry = { ...gymDay("BMU (technique)\nEMOM 7' :\n- 20% BMU")[0], musculation: [parseStrengthLine('- 6X5 Toes-to-Bar @35%', opts)!] };
    const r = row(entry);
    expect(r.description).toBe('Toes-to-Bar — 6 × 5');
    expect(r.notes).toContain('Toes-to-Bar : 35 % du max');
    expect(r.notes).not.toMatch(/%1RM/);
  });
  it('un mouvement chargé garde son %1RM', () => {
    expect(serializeImportStrength([parseStrengthLine('- 5X3 Back Squat @80%', opts)!]).lines).toEqual(['Back Squat — 5 × 3 @ 80 %1RM']);
  });
  it('% du max sans séries → non structurée, décrite en « % du max »', () => {
    const out = serializeImportStrength([gs({ percent: 35, charge_note: 'CAP à 15' })]);
    expect(out.lines).toEqual([]);
    expect(out.unstructured).toEqual(['Toes-to-Bar 35 % du max (CAP à 15)']);
  });
});

describe('variantes HSPU : chacune vers son propre libellé', () => {
  it.each([
    ['Strict HSPU', 'Strict Handstand Push-Ups', 'Strict Hand Stand Push Up'],
    ['Kipping HSPU', 'Handstand Push-ups', 'Hand Stand Push Up'],
    ['HSPU', 'Handstand Push-ups', 'Hand Stand Push Up'],
  ])('%s → %s (record %s), profil K+ Perf comme générique', (raw, name, label) => {
    for (const syn of [kplusPerf.synonyms, {}]) {
      const r = resolveMovementName(raw, syn);
      expect(r).toEqual({ name, resolved: true });
      expect(gymPrLabel(r.name)).toBe(label);
    }
  });
  it('les autres résolutions ne changent pas', () => {
    expect(resolveMovementName('Strict Pull-ups', kplusPerf.synonyms).name).toBe('Pull-ups');
    expect(resolveMovementName('Wall Facing HSPU', kplusPerf.synonyms)).toEqual({ name: 'Wall Facing HSPU', resolved: false });
  });
});

describe('correctifs de mise en forme', () => {
  it('l’espace avant « du max » est gardé ; « 500 m » reste collé', () => {
    const mv = { name: 'Air Squat', resolved: true, charge_h: null, charge_f: null, note: null };
    expect(serializeImportMovement({ ...mv, reps: '35% du max' })).toBe('35% du max Air Squat');
    expect(serializeImportMovement({ ...mv, name: 'Run', reps: '500 m' })).toBe('500m Run');
  });
  it('« tempo 30X1 » n’est plus doublé', () => {
    const s = parseStrengthLine("- 5X3 Back Squat @80% tempo 30X1 2' rest", opts)!;
    expect(s.tempo).toBe('30X1');
    expect(serializeImportStrength([s]).lines).toEqual(['Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1']);
  });
});

describe('RPE en section de force : charge notée (décision de Nab, option A)', () => {
  it('Back Squat 5×3 RPE 8 → « Back Squat — 5 × 3 — charge RPE 8 », relue avec loadNote', () => {
    const out = serializeImportStrength([parseStrengthLine('- 5X3 Back Squat RPE 8', opts)!]);
    expect(out.lines).toEqual(['Back Squat — 5 × 3 — charge RPE 8']);
    expect(out.unstructured).toEqual([]);
    expect(parseStrengthLineEditor(out.lines[0])).toMatchObject({ name: 'Back Squat', sets: 5, reps: 3, load: null, loadNote: 'RPE 8' });
  });
  it.each([
    ['- 3X5 Front Squat @RPE 7/8', 'Front Squat — 3 × 5 — charge RPE 7/8'],
    ['- 4X2 Deadlift (RPE 8-9)', 'Deadlift — 4 × 2 — charge RPE 8-9'],
  ])('fourchette reprise telle quelle : %s', (src, line) => {
    expect(serializeImportStrength([parseStrengthLine(src, opts)!]).lines).toEqual([line]);
  });
  it('gymnastique avec RPE → reps seules, RPE dans les notes du WOD, jamais de « charge »', () => {
    const out = serializeImportStrength([parseStrengthLine('- 6X5 Toes-to-Bar @RPE8', opts)!]);
    expect(out.lines).toEqual(['Toes-to-Bar — 6 × 5']);
    expect(out.gymNotes).toEqual(['Toes-to-Bar : RPE 8']);
    const entry = { ...gymDay("BMU (technique)\nEMOM 7' :\n- 20% BMU")[0], musculation: [parseStrengthLine('- 6X5 Toes-to-Bar @RPE8', opts)!] };
    expect(row(entry).notes).toContain('Toes-to-Bar : RPE 8');
  });
  it('séries ou reps introuvables → toujours non structurée (carte orange)', () => {
    const out = serializeImportStrength([parseStrengthLine('- 8 Hip Thrust @RPE10', opts)!]);
    expect(out.lines).toEqual([]);
    expect(out.unstructured).toEqual(['8 Hip Thrust RPE 10']);
  });
  it('les autres lignes non structurées restent orange (décision C)', () => {
    const out = serializeImportStrength([parseStrengthLine('- 2X5 Back Squat @-20%', opts)!]);
    expect(out.lines).toEqual([]);
    expect(out.unstructured).toHaveLength(1);
  });
});
