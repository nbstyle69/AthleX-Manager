import {
  cardioRowsFromLines,
  composeMovements,
  serializeStrengthRow,
  strengthRowsFromLines,
  updateCardioRow,
  updateStrengthRow,
} from '@/lib/wodEditorLines';
import { movementRowsFromLines, updateMovementRow } from '@/lib/wodMovementRows';
import { EMPTY_STRENGTH_ENTRY } from '@/lib/strengthBlock';

// Lignes Musculation réelles de la programmation automatique (AthleX Fitness,
// lues en lecture seule le 24/09/2026), dont certaines que la sérialisation
// actuelle ne réécrit pas à l'identique (RPE entre parenthèses, « ≈ », ordre
// charge / repos).
const MUSCULATION = [
  'Bench Press — 4 × 18 — RPE 7 (≈ 55 % du 1RM) — repos 40s',
  'Calf Raise (bodyweight) — 3 × 18 — charge poids du corps — repos 1:15',
  'Strict Pull-Ups — 3 × 5 — repos 1:30 — tempo 2-1-2-1 — charge strict, qualité avant quantité',
  'Front Squat — 5 × 3 @ 82 %1RM — repos 3:00 — tempo 2-1-X-1 — charge 80-85 %',
  'Power Snatch — 4 × 1 @ 65 %1RM — repos 3:00 — charge E3MOM · 60-70 %',
];
// Aucune ligne Cardio dans la programmation automatique réelle : lignes écrites
// selon la grammaire de `lib/cardioBlock.ts`, avec RPE, allure et parenthèses.
const CARDIO = [
  'Row ~ 4 × 500 m ~ 2:05 /500 m ~ repos 2:00 ~ RPE 7 (≈ 85 % FC max)',
  'Run ~ 3 × 800 m ~ 4:00 /km ~ repos 2:00',
  'Bike Erg ~ 5 × 20 cal ~ 250 W ~ repos 1:30',
];
const METCON = ['21 Thruster (43/30 kg)', '400 m Run'];
const SEANCE = [...MUSCULATION, ...CARDIO, ...METCON];

const ouvrir = (lines: string[]) => ({
  strength: strengthRowsFromLines(lines),
  cardio: cardioRowsFromLines(lines),
  wod: movementRowsFromLines(METCON.filter(l => lines.includes(l))),
});

describe('WodEditor — lignes Musculation et Cardio lues à l’ouverture', () => {
  it('reconnaît chaque ligne de musculation et de cardio', () => {
    const { strength, cardio } = ouvrir(SEANCE);
    expect(strength.map(r => r.raw)).toEqual(MUSCULATION);
    expect(cardio.map(r => r.raw)).toEqual(CARDIO);
  });

  it('une séance ouverte sans modification est réécrite à l’identique', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    expect(composeMovements(wod, strength, cardio)).toEqual(SEANCE);
  });
});

describe('WodEditor — une autre ligne modifiée, les lignes intactes le restent au caractère près', () => {
  it('modifier une ligne du metcon ne touche aucune ligne de musculation ni de cardio', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    const out = composeMovements(updateMovementRow(wod, 0, { reps: 15 }), strength, cardio);
    expect(out.slice(0, MUSCULATION.length)).toEqual(MUSCULATION);
    expect(out.slice(MUSCULATION.length, MUSCULATION.length + CARDIO.length)).toEqual(CARDIO);
    expect(out[MUSCULATION.length + CARDIO.length]).toBe('15 Thruster (43/30 kg)');
  });

  it('modifier une ligne de musculation ne touche que celle-là', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    const out = composeMovements(wod, updateStrengthRow(strength, 3, { sets: 6 }), cardio);
    expect(out[3]).toBe('Front Squat — 6 × 3 @ 82 %1RM — repos 3:00 — tempo 2-1-X-1 — charge 80-85 %');
    expect(out.filter((_, i) => i !== 3)).toEqual(SEANCE.filter((_, i) => i !== 3));
  });

  it('modifier une ligne de cardio ne touche que celle-là', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    const out = composeMovements(wod, strength, updateCardioRow(cardio, 2, { watts: 280 }));
    const i = MUSCULATION.length + 2;
    expect(out[i]).toBe('Bike Erg ~ 5 × 20 cal ~ 280 W ~ repos 1:30');
    expect(out.filter((_, k) => k !== i)).toEqual(SEANCE.filter((_, k) => k !== i));
  });

  it('retirer une ligne de musculation laisse les autres intactes', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    const out = composeMovements(wod, strength.filter((_, i) => i !== 1), cardio);
    expect(out).toEqual(SEANCE.filter(l => l !== MUSCULATION[1]));
  });

  it('ajouter une série laisse les lignes existantes intactes', () => {
    const { strength, cardio, wod } = ouvrir(SEANCE);
    const out = composeMovements(wod, [...strength, { ...EMPTY_STRENGTH_ENTRY, name: 'Back Squat', sets: 5, reps: 3 }], cardio);
    expect(out.slice(0, MUSCULATION.length)).toEqual(MUSCULATION);
    expect(out[MUSCULATION.length]).toBe('Back Squat — 5 × 3');
  });
});

describe('WodEditor — une ligne réellement modifiée est sérialisée comme avant', () => {
  it('perd ce que la sérialisation ne sait pas écrire (constat, non corrigé)', () => {
    const { strength } = ouvrir(SEANCE);
    const modifiee = updateStrengthRow(strength, 0, { reps: 20 })[0];
    expect(serializeStrengthRow(modifiee)).toBe('Bench Press — 4 × 20 — repos 40s');
  });
});
