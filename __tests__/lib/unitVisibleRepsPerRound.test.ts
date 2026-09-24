// M6 : unité toujours visible sur une ligne du catalogue, et pas de somme
// automatique des « reps par tour » dès qu'une ligne est une distance.
//
// La base ne crédite un AMRAP qui contient des mètres que si `reps_per_round`
// est renseigné ET égal à la somme des lignes (athlex-app, migration
// 20270102000000_credit_tournois_serveur.sql) : l'éditeur ne doit donc jamais
// écrire lui-même cette somme quand le tour contient une distance.

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
  it('le WOD constaté (20 m Row, 20 Run, 20 Thruster) : pas de somme, rien en base', () => {
    const wod = ['20 m Row', '20 Run', '20 Thruster'];
    expect(hasDistanceLine(wod)).toBe(true);
    expect(repsPerRoundFromMovements(wod)).toBe(0);
    expect(savedWhenAuto(wod)).toBeNull();
  });

  it('une seule ligne en mètres suffit', () => {
    expect(savedWhenAuto(['15 Thruster', '200 m SkiErg'])).toBeNull();
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
