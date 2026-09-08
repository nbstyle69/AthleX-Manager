import {
  EMPTY_MOVEMENT_ROW,
  movementRowShowsUnit,
  movementRowsFromLines,
  serializeMovementRows,
  updateMovementRow,
} from '@/lib/wodMovementRows';

describe('wodMovementRows — saisie des reps sur une ligne', () => {
  const rows = movementRowsFromLines(['21 Thruster (43/30 kg)', '']);

  it('la saisie « 12 » sur la ligne 2 ne touche que les reps de la ligne 2', () => {
    const next = updateMovementRow(rows, 1, { reps: 12 });
    expect(next[0]).toEqual(rows[0]);
    expect(next[1]).toEqual({ reps: 12, repsWomen: null, unit: 'reps', name: '', weightKg: null, weightKgWomen: null });
  });

  it('les reps restent dans leur colonne après un aller-retour vers `movements`', () => {
    // Avant : « 12 » seul se relisait reps 1 / nom « 2 » à chaque frappe.
    const typed = updateMovementRow(rows, 1, { reps: 1 });
    const typedMore = updateMovementRow(typed, 1, { reps: 12 });
    expect(typedMore[1].reps).toBe(12);
    expect(typedMore[1].name).toBe('');
    expect(serializeMovementRows(typedMore)).toEqual(['21 Thruster (43/30 kg)', '12']);
  });

  it('les reps sur une ligne nommée et chargée ne modifient ni le nom ni la charge', () => {
    const base = movementRowsFromLines(['21 Thruster (43/30 kg)', 'Front Squat (60/40 kg)']);
    const next = updateMovementRow(base, 1, { reps: 5 });
    expect(next[0]).toEqual(base[0]);
    expect(next[1]).toEqual({ reps: 5, repsWomen: null, unit: 'reps', name: 'Front Squat', weightKg: 60, weightKgWomen: 40 });
    expect(serializeMovementRows(next)[1]).toBe('5 Front Squat (60/40 kg)');
  });

  it('une ligne vide ajoutée se sérialise vide', () => {
    expect(serializeMovementRows([{ ...EMPTY_MOVEMENT_ROW }])).toEqual(['']);
  });

  it('choisir un exercice cardio bascule l’unité du catalogue, un exercice reps la ramène', () => {
    const base = movementRowsFromLines(['']);
    const row = updateMovementRow(base, 0, { name: 'Row' })[0];
    expect(row.unit).toBe('cal');
    expect(movementRowShowsUnit(row)).toBe(true);
    const run = updateMovementRow([row], 0, { name: 'Run' })[0];
    expect(run.unit).toBe('m');
    const thruster = updateMovementRow([run], 0, { name: 'Thruster' })[0];
    expect(thruster.unit).toBe('reps');
    expect(movementRowShowsUnit(thruster)).toBe(false);
  });

  it('une unité choisie par le coach survit à un changement de machine', () => {
    const base = movementRowsFromLines(['']);
    const row = updateMovementRow(updateMovementRow(base, 0, { name: 'Row' }), 0, { unit: 'm' })[0];
    expect(updateMovementRow([row], 0, { name: 'Bike Erg' })[0].unit).toBe('m');
  });

  it('sérialise « 20/15 cal Row » et relit le split', () => {
    const rows = movementRowsFromLines(['20/15 cal Row', '500 m Run']);
    expect(rows[0]).toMatchObject({ reps: 20, repsWomen: 15, unit: 'cal', name: 'Row' });
    expect(serializeMovementRows(rows)).toEqual(['20/15 cal Row', '500 m Run']);
    expect(serializeMovementRows(updateMovementRow(rows, 0, { repsWomen: null }))[0]).toBe('20 cal Row');
  });

  it('une ligne cardio sans quantité se sérialise sans « 0 »', () => {
    const rows = updateMovementRow(movementRowsFromLines(['']), 0, { name: 'Row' });
    expect(serializeMovementRows(rows)).toEqual(['Row']);
  });
});
