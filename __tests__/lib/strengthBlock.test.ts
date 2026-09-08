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

describe('strengthBlock — charge libre', () => {
  it('sérialise `charge …` après le tempo et le relit', () => {
    const e = { name: 'Back Squat', sets: 5, reps: 3, load: null, unit: 'kg' as const, restSec: 120, tempo: null, loadNote: 'RPE 9' };
    const line = serializeStrength(e);
    expect(line).toBe('Back Squat — 5 × 3 — repos 2:00 — charge RPE 9');
    expect(parseStrengthLine(line)).toMatchObject({ name: 'Back Squat', sets: 5, reps: 3, load: null, loadNote: 'RPE 9' });
  });

  it('une ligne sans load mais avec charge reste une ligne force, pas un mouvement metcon', () => {
    expect(isStrengthLine('Deadlift — 3 × 5 — charge RM du jour')).toBe(true);
    expect(parseStrengthLine('Deadlift — 3 × 5 — charge +2,5 kg')?.loadNote).toBe('+2,5 kg');
  });

  it('charge numérique et charge libre coexistent', () => {
    const line = serializeStrength({ name: 'Bench', sets: 4, reps: 6, load: 80, unit: '%1RM', restSec: null, tempo: '30X1', loadNote: 'ou RPE 8' });
    expect(line).toBe('Bench — 4 × 6 @ 80 %1RM — tempo 30X1 — charge ou RPE 8');
    expect(parseStrengthLine(line)).toMatchObject({ load: 80, unit: '%1RM', tempo: '30X1', loadNote: 'ou RPE 8' });
  });

  it('sans charge libre, la ligne parsée ne porte pas de clé loadNote', () => {
    expect(parseStrengthLine('Back Squat — 5 × 3 @ 80 %1RM')).not.toHaveProperty('loadNote');
  });
});
