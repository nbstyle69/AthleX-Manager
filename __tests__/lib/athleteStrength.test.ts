import {
  groupStrengthSessions,
  readGymRecords,
  readWeightliftingRecords,
  recordDate,
  repsLabel,
  sessionBlocks,
  setPerformance,
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

describe('readGymRecords (gymnastique, en reps)', () => {
  it('lit la valeur, la date et la provenance d’une série confirmée', () => {
    expect(readGymRecords({
      'gymnastics_Ring Muscle-up': '20',
      'gymnastics_Ring Muscle-up_date': '2026-09-10',
      'gymnastics_Ring Muscle-up_src': 'set-1',
    })).toEqual([{ movement: 'Ring Muscle-up', reps: 20, date: '2026-09-10', sourceId: 'set-1' }]);
  });

  it('sans _src : saisi à la main', () => {
    expect(readGymRecords({ 'gymnastics_Pull-ups': 30, 'gymnastics_Pull-ups_date': '12/08/2026' }))
      .toEqual([{ movement: 'Pull-ups', reps: 30, date: '12/08/2026', sourceId: null }]);
  });

  it('lit la clé historique « Gymnastics_ », la clé moderne gagne', () => {
    expect(readGymRecords({ 'Gymnastics_Dips': '15', 'Gymnastics_Dips_date': '01/02/2026' }))
      .toEqual([{ movement: 'Dips', reps: 15, date: '01/02/2026', sourceId: null }]);
    expect(readGymRecords({ 'Gymnastics_Dips': '15', 'gymnastics_Dips': '18' })[0].reps).toBe(18);
  });

  it('ordre de la page Records, aucun record = liste vide (section absente)', () => {
    expect(readGymRecords({ 'gymnastics_Pull Over': '5', 'gymnastics_Toes To Bar': '24' }).map(r => r.movement))
      .toEqual(['Toes To Bar', 'Pull Over']);
    expect(readGymRecords({ 'weightlifting_Back Squat': '150' })).toEqual([]);
    expect(readGymRecords(null)).toEqual([]);
  });

  it('ignore les valeurs illisibles ou nulles, et les noms hors des 11 libellés', () => {
    expect(readGymRecords({
      'gymnastics_Pull-ups': 'abc', 'gymnastics_Dips': '0', 'gymnastics_Strict Pull-Ups': '12',
      'gymnastics_Bar Muscle-up': '7,8',
    })).toEqual([{ movement: 'Bar Muscle-up', reps: 7, date: null, sourceId: null }]);
  });

  it('ne lit pas les records d’haltérophilie comme de la gymnastique, et inversement', () => {
    expect(readWeightliftingRecords({ 'gymnastics_Pull-ups': '30' })).toEqual([]);
  });
});

describe('recordDate', () => {
  it('écrit la date serveur à la française, laisse les autres formes', () => {
    expect(recordDate('2026-10-05')).toBe('05/10/2026');
    expect(recordDate('12/08/2026')).toBe('12/08/2026');
  });
});

describe('séries sans charge', () => {
  const gym = (over: Partial<StrengthSet>) => set({
    movement: 'Ring Muscle-up', movement_label: 'Ring Muscle-up', load_kg: null, prescribed_load_kg: null,
    prescribed_reps: 3, reps: 3, is_added: false, ...over,
  });

  it('« N reps », « 1 rep » au singulier ; une série chargée reste « reps × kg »', () => {
    expect(setPerformance(gym({ reps: 3 }))).toBe('3 reps');
    expect(setPerformance(gym({ reps: 1 }))).toBe('1 rep');
    expect(setPerformance(set({ reps: 5, load_kg: 100 }))).toBe('5 × 100 kg');
    expect(setPerformance(set({ reps: 5, load_kg: 0 }))).toBe('5 × 0 kg');
  });

  it('totaux par mouvement et de la séance (séries sans charge seulement)', () => {
    const { blocks, unloadedTotal } = sessionBlocks([
      gym({ id: 'a1', set_index: 1, reps: 3 }),
      gym({ id: 'a2', set_index: 2, reps: 3 }),
      gym({ id: 'a3', set_index: 3, reps: 2 }),
      gym({ id: 'a4', set_index: 4, reps: 1, prescribed_reps: null, is_added: true }),
      gym({ id: 't1', movement: 'Toes To Bar', movement_label: 'Toes to Bar', set_index: 1, reps: 12 }),
      gym({ id: 't2', movement: 'Toes To Bar', movement_label: 'Toes to Bar', set_index: 2, reps: 10 }),
      set({ id: 'b1', set_index: 1, reps: 5, load_kg: 100 }),
    ]);
    expect(blocks.map(b => [b.label, b.sets.length, b.unloadedTotal])).toEqual([
      ['Ring Muscle-up', 4, 9], ['Toes to Bar', 2, 22], ['Back Squat', 1, null],
    ]);
    expect(unloadedTotal).toBe(31);
  });

  it('séance toute chargée : aucune ligne de total', () => {
    const { blocks, unloadedTotal } = sessionBlocks([set({ id: 'b1' }), set({ id: 'b2', set_index: 2 })]);
    expect(blocks[0].unloadedTotal).toBeNull();
    expect(unloadedTotal).toBeNull();
  });

  it('regroupe un mouvement entrecoupé et range ses séries par numéro', () => {
    const { blocks } = sessionBlocks([
      gym({ id: 'x2', set_index: 2 }), set({ id: 'b1' }), gym({ id: 'x1', set_index: 1 }),
    ]);
    expect(blocks.map(b => b.sets.map(s => s.id))).toEqual([['x1', 'x2'], ['b1']]);
  });

  it('total au singulier', () => {
    expect(repsLabel(sessionBlocks([gym({ reps: 1 })]).unloadedTotal!)).toBe('1 rep');
  });
});
