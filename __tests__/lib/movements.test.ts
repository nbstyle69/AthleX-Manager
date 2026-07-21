import {
  isWeightedMovement,
  serializeMovement,
  parseMovementRow,
  MOVEMENT_CATALOG,
} from '@/lib/movements';

describe('movements catalog', () => {
  it('flags loaded movements as weighted', () => {
    expect(isWeightedMovement('Thruster')).toBe(true);
    expect(isWeightedMovement('deadlift')).toBe(true);
    expect(isWeightedMovement('KB Swing')).toBe(true);
  });

  it('flags bodyweight movements as not weighted', () => {
    expect(isWeightedMovement('Pull-ups')).toBe(false);
    expect(isWeightedMovement('Burpees')).toBe(false);
    expect(isWeightedMovement('Run')).toBe(false);
  });

  it('has no duplicate movement names', () => {
    const names = MOVEMENT_CATALOG.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('serializeMovement', () => {
  it('serializes reps + name', () => {
    expect(serializeMovement(12, 'Pull-ups')).toBe('12 Pull-ups');
  });

  it('appends load when provided', () => {
    expect(serializeMovement(21, 'Thruster', 43)).toBe('21 Thruster (43 kg)');
  });

  it('omits load when null or zero', () => {
    expect(serializeMovement(15, 'Burpees', 0)).toBe('15 Burpees');
    expect(serializeMovement(15, 'Burpees', null)).toBe('15 Burpees');
  });
});

describe('parseMovementRow', () => {
  it('round-trips the serialized format', () => {
    expect(parseMovementRow('21 Thruster (43 kg)')).toEqual({ reps: 21, name: 'Thruster', weightKg: 43 });
    expect(parseMovementRow('12 Pull-ups')).toEqual({ reps: 12, name: 'Pull-ups', weightKg: null });
  });

  it('tolerates legacy "N reps — Name @ kg" free-text', () => {
    expect(parseMovementRow('7 reps — Sumo Deadlift High Pull @ 42.5/30 kg')).toEqual({
      reps: 7,
      name: 'Sumo Deadlift High Pull',
      weightKg: 42.5,
    });
  });

  it('returns null reps for a name-only line', () => {
    expect(parseMovementRow('Handstand Walk')).toEqual({ reps: null, name: 'Handstand Walk', weightKg: null });
  });
});
