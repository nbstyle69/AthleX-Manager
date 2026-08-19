import {
  isStrengthLine,
  parseStrengthLine,
  serializeStrength,
  splitStrengthLines,
} from '@/lib/strengthBlock';
import { parseMovementRow } from '@/lib/movements';

const base = {
  name: 'Back Squat', sets: 5, reps: 3, load: 80,
  unit: '%1RM' as const, restSec: 120, tempo: '30X1',
};

describe('serializeStrength', () => {
  it('écrit séries × reps × charge, repos et tempo', () => {
    expect(serializeStrength(base)).toBe('Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1');
  });

  it('omet la charge quand elle est laissée à l’athlète', () => {
    expect(serializeStrength({ ...base, load: null, restSec: null, tempo: null }))
      .toBe('Back Squat — 5 × 3');
  });

  it('refuse un chiffre en tête du nom — sinon la ligne serait créditée en badge', () => {
    expect(serializeStrength({ ...base, name: '5 Back Squat' }))
      .toBe('Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1');
  });

  it('fait un aller-retour intact', () => {
    expect(parseStrengthLine(serializeStrength(base))).toEqual(base);
  });
});

describe('parseStrengthLine', () => {
  it('tolère les notations d’un coach (tiret ASCII, 3x5, % nu, repos en secondes)', () => {
    expect(parseStrengthLine('Deadlift - 3x5 @ 90% - repos 180s')).toEqual({
      name: 'Deadlift', sets: 3, reps: 5, load: 90, unit: '%1RM', restSec: 180, tempo: null,
    });
  });

  it('rend null sur un mouvement de WOD (reps d’abord)', () => {
    expect(parseStrengthLine('21 Thruster (43 kg)')).toBeNull();
  });
});

describe('cohabitation dans la même description', () => {
  const lines = ['21 Thruster (43 kg)', serializeStrength(base), '15 Pull-ups'];

  it('sépare les deux formes', () => {
    expect(splitStrengthLines(lines)).toEqual({
      wod: ['21 Thruster (43 kg)', '15 Pull-ups'],
      strength: [serializeStrength(base)],
    });
  });

  it('un bloc de force n’est jamais lu comme une ligne reps + exercice', () => {
    const parsed = parseMovementRow(serializeStrength(base));
    expect(parsed.reps).toBeNull();
    expect(isStrengthLine('21 Thruster (43 kg)')).toBe(false);
  });
});
