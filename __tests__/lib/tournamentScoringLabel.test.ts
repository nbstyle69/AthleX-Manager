// Tests pour lib/tournaments/scoring.ts et le type des WODs générés (lib/wod/boAdapter.ts).
//
// En prod, un WOD de type AMRAP portait le libellé « For time » : le libellé
// était un texte libre, sans lien avec le type. Il est désormais dérivé du type.

import { scoringLabel, TOURNAMENT_WOD_TYPES } from '@/lib/tournaments/scoring';
import { boGenerateFunctional, boGenerateHybrid, hybridTypeFor } from '@/lib/wod/boAdapter';

describe('scoringLabel — un libellé par type', () => {
  const inputs = { durationMinutes: 12, capSeconds: 750 };

  it.each([
    ['For Time', 'Temps total (cap 12:30)'],
    ['AMRAP', 'Tours complets + reps en 12 min'],
    ['EMOM', 'Rounds complétés sur 12 min'],
    ['Tabata', 'Total de reps'],
    ['Max Reps', 'Total de reps (cap 12:30)'],
    ['Strength', 'Charge max'],
  ])('%s → « %s »', (type, label) => {
    expect(scoringLabel(type, inputs)).toBe(label);
  });

  it('couvre chaque type proposé par l’éditeur', () => {
    for (const t of TOURNAMENT_WOD_TYPES) expect(scoringLabel(t, inputs)).toEqual(expect.any(String));
  });

  it('le cas de prod : un AMRAP ne peut plus être libellé « For time »', () => {
    expect(scoringLabel('AMRAP', inputs)).not.toMatch(/for time|temps/i);
  });

  it('sans cap ni durée, le libellé reste juste', () => {
    const none = { durationMinutes: null, capSeconds: null };
    expect(scoringLabel('For Time', none)).toBe('Temps total');
    expect(scoringLabel('Max Reps', none)).toBe('Total de reps');
    expect(scoringLabel('AMRAP', none)).toBe('Tours complets + reps');
    expect(scoringLabel('EMOM', none)).toBe('Rounds complétés');
  });

  it('un type inconnu n’invente pas de libellé', () => {
    expect(scoringLabel('Chipper', inputs)).toBeNull();
  });
});

describe('type d’un WOD généré', () => {
  it.each([
    ['AMRAP', 'AMRAP'],
    ['EMOM', 'EMOM'],
    ['STRENGTH', 'Strength'],
    ['FOR TIME', 'For Time'],
    ['CHIPPER', 'For Time'],
    ['INTERVAL', 'For Time'],
  ])('structure hybride %s → type %s', (structure, type) => {
    expect(hybridTypeFor(structure)).toBe(type);
  });

  it('générateur fonctionnel : le type demandé', () => {
    const eq = ['Barbell', 'Haltères', 'Barre de traction', 'Erg', 'Corde à sauter'];
    for (const t of ['AMRAP', 'For Time', 'EMOM', 'Tabata', 'Max Reps']) {
      expect(boGenerateFunctional(t, 'rx', 12, eq)?.type).toBe(t);
    }
  });

  it('générateur hybride : le type suit la structure, plus jamais un For Time forcé', () => {
    // L'ancien défaut : environ un WOD hybride sur quatre était un AMRAP
    // enregistré comme For Time. Le libellé du moteur trahit la structure.
    const eq = ['SkiErg', 'Sled Push', 'Sled Pull', 'RowErg', 'Wall Balls', 'Tapis course', 'Haltères'];
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      for (const t of ['Race Simulation', 'Station Training', 'Cardio Force', 'Running Intervals']) {
        const w = boGenerateHybrid(t, 'Open', 'Solo', 30, eq);
        const amrap = /tours complets/i.test(w.scoring);
        expect(w.type).toBe(amrap ? 'AMRAP' : 'For Time');
        expect(w.timer_type).toBe(amrap ? 'stopwatch' : 'countdown');
        seen.add(w.type);
      }
    }
    // Les deux cas ont bien été rencontrés : le test ne passe pas à vide.
    expect([...seen].sort()).toEqual(['AMRAP', 'For Time']);
  });
});
