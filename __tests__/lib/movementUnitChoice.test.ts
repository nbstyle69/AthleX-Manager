// Sélecteur d'unité par ligne (M5a) : unitChoicesFor et editMovementLine avec
// une unité choisie (lib/movements.ts), puis movement_lines qui en découle.
// Catalogue : le snapshot embarqué, dont les mouvements à plusieurs unités sont
// les mêmes qu'en ligne (Row, SkiErg, Bike Erg — vérifié en prod, lecture seule).

import { editMovementLine, parseMovementRow, unitChoicesFor, type MovementUnit } from '@/lib/movements';
import { buildMovementLines } from '@/lib/tournaments/movementLines';

/** Choisit `unit` dans le sélecteur de la ligne, sans toucher au reste. */
function choose(line: string, unit: MovementUnit): string {
  const p = parseMovementRow(line);
  return editMovementLine(line, { reps: p.reps, name: p.name, weightKg: p.weightKg, weightKgWomen: p.weightKgWomen, unit });
}

describe('unitChoicesFor — unités proposées', () => {
  it.each([
    ['Row', ['cal', 'm']],
    ['SkiErg', ['cal', 'm']],
    ['Bike Erg', ['cal', 'm']],
  ])('%s : sélecteur avec %j', (name, units) => {
    expect(unitChoicesFor(name)).toEqual(units);
  });

  it.each([
    ['Run', 'une seule unité (m)'],
    ['Echo Bike', 'une seule unité (cal)'],
    ['Plank Hold', 'une seule unité (s)'],
    ['Thruster', 'une seule unité (reps)'],
    ['Pompes du coach', 'hors catalogue'],
    ['', 'sans nom'],
  ])('%s : pas de sélecteur (%s)', (name) => {
    expect(unitChoicesFor(name)).toEqual([]);
  });
});

describe('choix de l’unité : ligne et movement_lines', () => {
  it('présélection : l’unité par défaut du catalogue (Row en cal, Run en m)', () => {
    expect(parseMovementRow('20 Row').unit).toBe('cal');
    expect(parseMovementRow('400 Run').unit).toBe('m');
  });

  it.each([
    ['20 Row', 'm', '20 m Row', { movement: 'row', unit: 'm', qty_male: 20 }],
    ['20 Row', 'cal', '20 cal Row', { movement: 'row', unit: 'cal', qty_male: 20 }],
    ['1000 SkiErg', 'm', '1000 m SkiErg', { movement: 'ski_erg', unit: 'm', qty_male: 1000 }],
    ['15 Bike Erg', 'cal', '15 cal Bike Erg', { movement: 'bike_erg', unit: 'cal', qty_male: 15 }],
  ] as const)('« %s » → %s : « %s »', (line, unit, expected, ml) => {
    const out = choose(line, unit);
    expect(out).toBe(expected);
    expect(buildMovementLines([out])).toEqual([ml]);
  });

  it('changement d’unité sur une ligne existante, dans les deux sens', () => {
    let line = '500 m Row';
    line = choose(line, 'cal');
    expect(line).toBe('500 cal Row');
    expect(buildMovementLines([line])).toEqual([{ movement: 'row', unit: 'cal', qty_male: 500 }]);
    line = choose(line, 'm');
    expect(line).toBe('500 m Row');
    expect(buildMovementLines([line])).toEqual([{ movement: 'row', unit: 'm', qty_male: 500 }]);
  });

  it('l’unité choisie est conservée quand on modifie ensuite les reps', () => {
    const line = choose('20 Row', 'm');
    const p = parseMovementRow(line);
    const edited = editMovementLine(line, { reps: 250, name: p.name, weightKg: null, weightKgWomen: null });
    expect(edited).toBe('250 m Row');
  });

  it('le split ♀ d’une ligne existante survit au changement d’unité', () => {
    expect(choose('20/15 cal Row', 'm')).toBe('20/15 m Row');
  });

  it('mouvement à unité unique : une unité non permise est ignorée', () => {
    expect(choose('400 Run', 'cal')).toBe('400 m Run');
    expect(choose('21 Thruster', 'm')).toBe('21 Thruster');
    expect(buildMovementLines([choose('400 Run', 'cal')])).toEqual([{ movement: 'run', unit: 'm', qty_male: 400 }]);
  });

  it('sans quantité, la ligne ne porte pas d’unité (le sélecteur est désactivé)', () => {
    expect(editMovementLine('Row', { reps: null, name: 'Row', weightKg: null, weightKgWomen: null, unit: 'm' })).toBe('Row');
  });
});
