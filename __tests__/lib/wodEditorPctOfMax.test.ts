import {
  PCT_OF_MAX_ONLY_GYM,
  changeStrengthUnit,
  composeMovements,
  serializeStrengthRow,
  strengthRowError,
  strengthRowsFromLines,
  strengthUnitChoice,
  strengthUnitChoices,
  updateStrengthRow,
} from '@/lib/wodEditorLines';
import { EMPTY_STRENGTH_ENTRY } from '@/lib/strengthBlock';
import { buildWodJson } from '@/lib/wodJson';

const RMU = 'Ring Muscle-up — 3 × 15 % du max — repos 1:30';

describe('éditeur de WOD — unité « % du max »', () => {
  it('n’est proposée que pour un mouvement de gymnastique', () => {
    expect(strengthUnitChoices({ ...EMPTY_STRENGTH_ENTRY, name: 'Back Squat' })).toEqual(['kg', '%1RM']);
    expect(strengthUnitChoices({ ...EMPTY_STRENGTH_ENTRY, name: '' })).toEqual(['kg', '%1RM']);
    expect(strengthUnitChoices({ ...EMPTY_STRENGTH_ENTRY, name: 'Strict Pull-Ups' })).toEqual(['kg', '%1RM']);
    expect(strengthUnitChoices({ ...EMPTY_STRENGTH_ENTRY, name: 'ring muscle-ups' })).toEqual(['kg', '%1RM', 'pctOfMax']);
    expect(strengthUnitChoices({ ...EMPTY_STRENGTH_ENTRY, name: 'T2B' })).toEqual(['kg', '%1RM', 'pctOfMax']);
  });

  it('création : séries × % → ligne du contrat, sans reps ni « @ »', () => {
    let rows = updateStrengthRow([{ ...EMPTY_STRENGTH_ENTRY }], 0, { name: 'Ring Muscle-up', load: 20, restSec: 90 });
    rows = changeStrengthUnit(rows, 0, 'pctOfMax');
    expect(strengthUnitChoice(rows[0])).toBe('pctOfMax');
    rows = updateStrengthRow(rows, 0, { sets: 3, pctOfMax: 15 });
    expect(serializeStrengthRow(rows[0])).toBe(RMU);
    expect(composeMovements([], rows, [])).toEqual([RMU]);
  });

  it('réouverture : une ligne existante se relit en « % du max » et se réécrit intacte', () => {
    const rows = strengthRowsFromLines([RMU, '21 Thruster (43 kg)']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Ring Muscle-up', sets: 3, pctOfMax: 15, restSec: 90 });
    expect(strengthUnitChoice(rows[0])).toBe('pctOfMax');
    expect(composeMovements([], rows, [])).toEqual([RMU]);
    const edited = updateStrengthRow(rows, 0, { sets: 4 });
    expect(serializeStrengthRow(edited[0])).toBe('Ring Muscle-up — 4 × 15 % du max — repos 1:30');
  });

  it('exercice changé pour un mouvement chargé : erreur, unité inchangée', () => {
    const rows = updateStrengthRow(strengthRowsFromLines([RMU]), 0, { name: 'Back Squat' });
    expect(strengthRowError(rows[0])).toBe(PCT_OF_MAX_ONLY_GYM);
    expect(strengthUnitChoice(rows[0])).toBe('pctOfMax');
    // L'option reste affichée (en erreur) : jamais retirée en silence.
    expect(strengthUnitChoices(rows[0])).toContain('pctOfMax');
    expect(PCT_OF_MAX_ONLY_GYM).toBe('« % du max » ne s’applique qu’aux mouvements de gymnastique.');
  });

  it('pas d’erreur pour un mouvement de gymnastique, en kg ou sans exercice', () => {
    expect(strengthRowError(strengthRowsFromLines([RMU])[0])).toBeNull();
    expect(strengthRowError({ ...EMPTY_STRENGTH_ENTRY, name: 'Back Squat' })).toBeNull();
    expect(strengthRowError({ ...EMPTY_STRENGTH_ENTRY, name: '  ', pctOfMax: 15 })).toBeNull();
  });

  it('retour vers kg ou %1RM : reps d’avant, sinon 5', () => {
    let rows = updateStrengthRow([{ ...EMPTY_STRENGTH_ENTRY }], 0, { name: 'Pull-ups', reps: 8 });
    rows = changeStrengthUnit(rows, 0, 'pctOfMax');
    rows = changeStrengthUnit(rows, 0, 'kg');
    expect(rows[0]).toMatchObject({ reps: 8, unit: 'kg' });
    expect(rows[0].pctOfMax).toBeUndefined();
    expect(serializeStrengthRow(rows[0])).toBe('Pull-ups — 5 × 8');

    const reread = changeStrengthUnit(strengthRowsFromLines([RMU]), 0, '%1RM');
    expect(reread[0]).toMatchObject({ reps: 5, unit: '%1RM' });
    expect(serializeStrengthRow(reread[0])).toBe('Ring Muscle-up — 3 × 5 — repos 1:30');
  });

  it('une autre ligne de la séance qui change ne touche pas la ligne « % du max »', () => {
    const rows = strengthRowsFromLines(['Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1 — charge RPE 8', RMU]);
    const edited = updateStrengthRow(rows, 0, { sets: 4 });
    expect(composeMovements([], edited, [])[1]).toBe(RMU);
  });
});

describe('wod_json — ligne « % du max »', () => {
  it('va dans strength avec reps 0 et pctOfMax, jamais dans les mouvements crédités', () => {
    const j = buildWodJson({ description: `${RMU}\n21 Thruster (43 kg)`, wod_type: 'for-time', time_cap_seconds: null, rounds: null });
    expect(j.strength).toEqual([expect.objectContaining({ name: 'Ring Muscle-up', sets: 3, reps: 0, pctOfMax: 15, restSec: 90 })]);
    expect(j.movements.map(m => m.name)).toEqual(['Thruster']);
    expect(j.free_text).toEqual([]);
  });
});
