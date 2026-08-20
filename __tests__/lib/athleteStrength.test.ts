import {
  groupStrengthSessions,
  readWeightliftingRecords,
  type StrengthSet,
} from '@/lib/athleteStrength';

function set(over: Partial<StrengthSet>): StrengthSet {
  return {
    id: 's1',
    source_type: 'whiteboard',
    source_id: 'w1',
    source_title: 'Force du lundi',
    movement: 'Back Squat',
    movement_label: 'Back Squat',
    set_index: 1,
    reps: 3,
    load_kg: 120,
    prescribed_reps: 3,
    prescribed_load_kg: 120,
    performed_at: '2026-06-09T10:00:00.000Z',
    ...over,
  };
}

describe('readWeightliftingRecords', () => {
  it('lit la charge, sa date et sa provenance', () => {
    const recs = readWeightliftingRecords({
      'weightlifting_Back Squat': '150',
      'weightlifting_Back Squat_date': '09/06/2026',
      'weightlifting_Back Squat_src': 'abc-123',
    });
    expect(recs).toEqual([
      { movement: 'Back Squat', value: '150', date: '09/06/2026', sourceId: 'abc-123' },
    ]);
  });

  it("n'affiche jamais un uuid de provenance comme une charge", () => {
    // Le bug évité : `_src` traité comme une valeur afficherait « abc-123 kg ».
    const recs = readWeightliftingRecords({
      'weightlifting_Deadlift': '200',
      'weightlifting_Deadlift_src': 'abc-123',
    });
    expect(recs.map(r => r.movement)).toEqual(['Deadlift']);
    expect(recs[0].value).toBe('200');
  });

  it('distingue un record tracé d’un record saisi à la main', () => {
    const recs = readWeightliftingRecords({
      'weightlifting_Deadlift': '200',
      'weightlifting_Thruster': '90',
      'weightlifting_Thruster_src': 'log-9',
    });
    const byMovement = Object.fromEntries(recs.map(r => [r.movement, r.sourceId]));
    expect(byMovement['Deadlift']).toBeNull();
    expect(byMovement['Thruster']).toBe('log-9');
  });

  it('tolère les clés héritées et les valeurs numériques', () => {
    const recs = readWeightliftingRecords({
      'Haltérophilie_Front Squat': 130,
      'gymnastics_Pull Up': '25',
      _featured_badges: ['x'],
    });
    expect(recs).toEqual([
      { movement: 'Front Squat', value: '130', date: null, sourceId: null },
    ]);
  });

  it('rend une liste vide sans records', () => {
    expect(readWeightliftingRecords(null)).toEqual([]);
  });
});

describe('groupStrengthSessions', () => {
  it('regroupe par jour et par source, la plus récente d’abord', () => {
    const sessions = groupStrengthSessions([
      set({ id: 'a', set_index: 1, performed_at: '2026-06-01T10:00:00.000Z' }),
      set({ id: 'b', set_index: 2, performed_at: '2026-06-01T10:01:00.000Z' }),
      set({ id: 'c', source_id: 'p1', source_type: 'program', source_title: 'Semaine 3', performed_at: '2026-06-08T09:00:00.000Z' }),
    ]);
    expect(sessions.map(s => s.title)).toEqual(['Semaine 3', 'Force du lundi']);
    expect(sessions[1].sets.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('ne mélange pas deux sources du même jour', () => {
    const sessions = groupStrengthSessions([
      set({ id: 'a', source_id: 'w1' }),
      set({ id: 'b', source_id: 'w2', source_title: 'Autre bloc' }),
    ]);
    expect(sessions).toHaveLength(2);
  });

  it('nomme une séance sans titre plutôt que d’afficher un vide', () => {
    const sessions = groupStrengthSessions([set({ source_title: null })]);
    expect(sessions[0].title).toBe('Séance sans titre');
  });
});
