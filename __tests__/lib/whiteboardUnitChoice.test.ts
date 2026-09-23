// Sélecteur d'unité dans l'éditeur du Whiteboard (M5b) : la ligne écrite dans
// la description, le wod_json qui en dérive, et le format que l'app lit pour
// créditer les cumuls.
//
// L'app crédite un WOD du Whiteboard à partir des lignes de sa DESCRIPTION
// (athlex-app, src/screens/whiteboard/*Screen.tsx → computeCompletedMovements →
// parseMovementLine, src/utils/movementParser.ts) ; le wod_json ne sert pas au
// crédit. Un rameur saisi en mètres doit donc être écrit « 500 m Row ».

import { unitChoicesFor } from '@/lib/movements';
import { movementRowsFromLines, serializeMovementRows, updateMovementRow } from '@/lib/wodMovementRows';
import { buildWodJson } from '@/lib/wodJson';

/**
 * Expression de l'app pour une ligne cardio, reprise telle quelle de
 * athlex-app src/utils/movementParser.ts (parseMovementLine) : si le Manager
 * écrit un autre format, ce contrat casse ici plutôt qu'en crédit faux.
 */
const APP_CARDIO_LINE = /^(\d+)(?:\s*\/\s*(\d+))?\s*(m|cals?|kcal)\b\.?\s+(.+)$/i;
const appUnit = (tok: string) => (tok.toLowerCase() === 'm' ? 'm' : 'cal');

/** L'éditeur du Whiteboard : nom, puis reps, puis unité choisie. */
function editRow(name: string, reps: number, unit?: 'm' | 'cal') {
  let rows = updateMovementRow(movementRowsFromLines(['']), 0, { name });
  rows = updateMovementRow(rows, 0, { reps });
  if (unit) rows = updateMovementRow(rows, 0, { unit });
  return rows;
}

describe('Whiteboard : unité choisie → description', () => {
  it.each([
    ['Row', 500, 'm', '500 m Row'],
    ['Row', 20, 'cal', '20 cal Row'],
    ['SkiErg', 1000, 'm', '1000 m SkiErg'],
    ['Bike Erg', 15, 'cal', '15 cal Bike Erg'],
  ] as const)('%s %d en %s → « %s »', (name, reps, unit, line) => {
    expect(serializeMovementRows(editRow(name, reps, unit))).toEqual([line]);
  });

  it('présélection : l’unité par défaut du catalogue', () => {
    expect(editRow('Row', 20)[0].unit).toBe('cal');
    expect(editRow('Run', 400)[0].unit).toBe('m');
  });

  it('changement d’unité sur une ligne existante', () => {
    let rows = movementRowsFromLines(['500 cal Row']);
    rows = updateMovementRow(rows, 0, { unit: 'm' });
    expect(serializeMovementRows(rows)).toEqual(['500 m Row']);
  });

  it('mouvement à unité unique : pas de choix proposé, l’unité du catalogue reste', () => {
    expect(unitChoicesFor('Run')).toEqual([]);
    expect(unitChoicesFor('Echo Bike')).toEqual([]);
    expect(serializeMovementRows(editRow('Run', 400))).toEqual(['400 m Run']);
  });

  it('renommer vers une machine qui ne permet pas l’unité : retour à son unité par défaut', () => {
    const rowInMeters = editRow('Row', 500, 'm');
    expect(updateMovementRow(rowInMeters, 0, { name: 'Echo Bike' })[0].unit).toBe('cal');
    // Une machine qui la permet la garde (acquis existant).
    expect(updateMovementRow(rowInMeters, 0, { name: 'Bike Erg' })[0].unit).toBe('m');
  });
});

describe('Whiteboard : wod_json et lecture par l’app', () => {
  it('le wod_json porte l’unité choisie et le mouvement du catalogue', () => {
    const description = serializeMovementRows([...editRow('Row', 500, 'm'), ...editRow('SkiErg', 20, 'cal')]).join('\n');
    const json = buildWodJson({ description, wod_type: 'for-time', time_cap_seconds: null, rounds: null });
    const credited = [...json.movements, ...json.cardio].map((m: any) => ({ name: m.name, unit: m.unit, qty: m.reps ?? m.quantity, id: m.catalogId ?? null }));
    expect(credited).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Row', unit: 'm', qty: 500 }),
      expect.objectContaining({ name: 'SkiErg', unit: 'cal', qty: 20 }),
    ]));
  });

  it.each([
    ['Row', 500, 'm'],
    ['Row', 20, 'cal'],
    ['SkiErg', 1000, 'm'],
    ['Bike Erg', 15, 'cal'],
  ] as const)('l’app lit %s %d %s avec la bonne unité', (name, reps, unit) => {
    const [line] = serializeMovementRows(editRow(name, reps, unit));
    const m = line.match(APP_CARDIO_LINE);
    expect(m).not.toBeNull();
    expect({ reps: Number(m![1]), unit: appUnit(m![3]), name: m![4].trim() }).toEqual({ reps, unit, name });
  });

  it('un split ♀ existant reste lisible par l’app après changement d’unité', () => {
    const rows = updateMovementRow(movementRowsFromLines(['20/15 cal Row']), 0, { unit: 'm' });
    const [line] = serializeMovementRows(rows);
    expect(line).toBe('20/15 m Row');
    const m = line.match(APP_CARDIO_LINE)!;
    expect([m[1], m[2], appUnit(m[3]), m[4]]).toEqual(['20', '15', 'm', 'Row']);
  });
});
