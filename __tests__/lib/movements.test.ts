import {
  isWeightedMovement,
  serializeMovement,
  parseMovementRow,
  MOVEMENT_CATALOG,
  repsPerRoundFromMovements,
  amrapTotalToRoundsReps,
  roundsRepsToTotal,
  formatAmrapScore,
  isRepsScoredType,
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

  it('appends men/women loads as "H/F"', () => {
    expect(serializeMovement(21, 'Thruster', 43, 30)).toBe('21 Thruster (43/30 kg)');
  });

  it('keeps a single load when only women is set', () => {
    expect(serializeMovement(21, 'Thruster', null, 30)).toBe('21 Thruster (30 kg)');
  });

  it('omits load when null or zero', () => {
    expect(serializeMovement(15, 'Burpees', 0)).toBe('15 Burpees');
    expect(serializeMovement(15, 'Burpees', null)).toBe('15 Burpees');
    expect(serializeMovement(15, 'Burpees', 0, 0)).toBe('15 Burpees');
  });
});

describe('parseMovementRow', () => {
  it('round-trips the serialized format', () => {
    expect(parseMovementRow('21 Thruster (43 kg)')).toEqual({ reps: 21, name: 'Thruster', weightKg: 43, weightKgWomen: null });
    expect(parseMovementRow('12 Pull-ups')).toEqual({ reps: 12, name: 'Pull-ups', weightKg: null, weightKgWomen: null });
  });

  it('round-trips the men/women load format', () => {
    expect(parseMovementRow('21 Thruster (43/30 kg)')).toEqual({ reps: 21, name: 'Thruster', weightKg: 43, weightKgWomen: 30 });
  });

  it('tolerates legacy "N reps — Name @ kg" free-text and splits men/women', () => {
    expect(parseMovementRow('7 reps — Sumo Deadlift High Pull @ 42.5/30 kg')).toEqual({
      reps: 7,
      name: 'Sumo Deadlift High Pull',
      weightKg: 42.5,
      weightKgWomen: 30,
    });
  });

  it('returns null reps for a name-only line', () => {
    expect(parseMovementRow('Handstand Walk')).toEqual({ reps: null, name: 'Handstand Walk', weightKg: null, weightKgWomen: null });
  });
});

describe('AMRAP / Max Reps score helpers', () => {
  const wod = ['10 Thruster (43/30 kg)', '12 Pull-ups', '15 Box jump'];

  it('sums reps per round from movements', () => {
    expect(repsPerRoundFromMovements(wod)).toBe(37);
    expect(repsPerRoundFromMovements([])).toBe(0);
    expect(repsPerRoundFromMovements(null)).toBe(0);
  });

  it('converts total reps <-> rounds+reps consistently', () => {
    // 3 rounds + 12 reps of a 37-rep round = 123
    expect(roundsRepsToTotal(3, 12, 37)).toBe(123);
    expect(amrapTotalToRoundsReps(123, 37)).toEqual({ rounds: 3, reps: 12 });
    // 1 full round == 37 reps -> same stored total whichever way it was entered
    expect(roundsRepsToTotal(1, 0, 37)).toBe(37);
    expect(amrapTotalToRoundsReps(37, 37)).toEqual({ rounds: 1, reps: 0 });
  });

  it('falls back to raw total when reps-per-round is unknown', () => {
    expect(amrapTotalToRoundsReps(50, 0)).toEqual({ rounds: 0, reps: 50 });
    expect(formatAmrapScore(50, 0)).toBe('50 reps');
    expect(formatAmrapScore(50, null)).toBe('50 reps');
  });

  it('formats the recap label', () => {
    expect(formatAmrapScore(123, 37)).toBe('123 reps (3 tours + 12)');
    expect(formatAmrapScore(37, 37)).toBe('37 reps (1 tour)');
    expect(formatAmrapScore(74, 37)).toBe('74 reps (2 tours)');
  });

  it('detects reps-scored WOD types', () => {
    expect(isRepsScoredType('AMRAP')).toBe(true);
    expect(isRepsScoredType('Max Reps')).toBe(true);
    expect(isRepsScoredType('For Time')).toBe(false);
    expect(isRepsScoredType(null)).toBe(false);
  });
});
