// M6 : unité toujours visible sur une ligne du catalogue ; une distance compte
// en points dans les « reps par tour » (1 par tranche complète de 100 m).
//
// La base ne crédite un AMRAP qui contient des mètres que si `reps_per_round`
// est égal à la somme des lignes en mètres (athlex-app, migration
// 20270102000000_credit_tournois_serveur.sql) : en points, ce n'est jamais le
// cas, donc aucun crédit — voulu.

import { fixedUnitFor, hasDistanceLine, repsPerRoundFromMovements, unitChoicesFor } from '@/lib/movements';

/** Ce que WODForm écrit dans `reps_per_round` quand le champ est laissé vide. */
const savedWhenAuto = (movements: string[]) => repsPerRoundFromMovements(movements) || null;

describe('unité fixe affichée en texte', () => {
  it.each([
    ['Run', 'm'],
    ['Thruster', 'reps'],
    ['Echo Bike', 'cal'],
  ] as const)('%s → « %s »', (name, unit) => {
    expect(unitChoicesFor(name)).toEqual([]);
    expect(fixedUnitFor(name)).toBe(unit);
  });

  it('un mouvement à plusieurs unités a son sélecteur, pas de texte', () => {
    expect(unitChoicesFor('Row')).toEqual(expect.arrayContaining(['cal', 'm']));
    expect(fixedUnitFor('Row')).toBeNull();
  });

  it('hors catalogue ou sans nom : rien', () => {
    expect(fixedUnitFor('Mouvement inventé')).toBeNull();
    expect(fixedUnitFor('')).toBeNull();
  });
});

describe('reps par tour : somme automatique', () => {
  it('le WOD constaté (20 m Row, 20 Run, 20 Thruster) : les distances valent 0 point', () => {
    const wod = ['20 m Row', '20 Run', '20 Thruster'];
    expect(hasDistanceLine(wod)).toBe(true);
    expect(repsPerRoundFromMovements(wod)).toBe(20);
    expect(savedWhenAuto(wod)).toBe(20);
  });

  it('une ligne en mètres compte en points', () => {
    expect(savedWhenAuto(['15 Thruster', '200 m SkiErg'])).toBe(17);
  });

  it('reps et calories : la somme reste, les calories comptent comme des reps', () => {
    const wod = ['20 cal Row', '15 Thruster', '10 cal Echo Bike'];
    expect(hasDistanceLine(wod)).toBe(false);
    expect(repsPerRoundFromMovements(wod)).toBe(45);
    expect(savedWhenAuto(wod)).toBe(45);
  });

  it('une ligne de distance sans quantité ne bloque pas la somme', () => {
    expect(repsPerRoundFromMovements(['Run', '10 Burpees'])).toBe(10);
  });
});
