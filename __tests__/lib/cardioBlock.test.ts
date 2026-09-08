import {
  parseCardioLine,
  serializeCardio,
  isCardioLine,
  splitCardioLines,
  formatCardioPrescription,
  type CardioEntry,
} from '@/lib/cardioBlock';
import { parseMovementRow } from '@/lib/movements';
import { isStrengthLine, parseStrengthLine, splitStrengthLines } from '@/lib/strengthBlock';

const base: CardioEntry = {
  name: 'Row', sets: 2, quantity: 500, unit: 'm', watts: 250, pace: null, restSec: 120, rpe: null,
};

describe('sérialisation du bloc cardio', () => {
  it('écrit la grammaire de la spec', () => {
    expect(serializeCardio(base)).toBe('Row ~ 2 × 500 m ~ 250 W ~ repos 2:00');
    expect(serializeCardio({ ...base, name: 'SkiErg', sets: 4, quantity: 20, unit: 'cal', watts: null, restSec: null, rpe: '6' }))
      .toBe('SkiErg ~ 4 × 20 cal ~ RPE 6');
    expect(serializeCardio({ ...base, name: 'Run', sets: 3, quantity: 800, watts: null, pace: { mmss: '4:00', per: 'km' } }))
      .toBe('Run ~ 3 × 800 m ~ 4:00/km ~ repos 2:00');
  });

  it('fait l’aller-retour à l’identique', () => {
    for (const e of [
      base,
      { ...base, watts: null, pace: { mmss: '1:45', per: '500 m' as const } },
      { ...base, watts: null, restSec: null, rpe: '7-8' },
    ]) {
      expect(parseCardioLine(serializeCardio(e))).toEqual(e);
    }
  });

  it('un nom qui commence par un chiffre ou contient ~ est assaini', () => {
    expect(serializeCardio({ ...base, name: '2 × Row ~ test' })).toMatch(/^Row test ~ /);
  });
});

describe('reconnaissance des lignes cardio', () => {
  it('parse les trois exemples de la spec', () => {
    expect(parseCardioLine('Row ~ 2 × 500 m ~ 250 W ~ repos 2:00')).toEqual(base);
    expect(parseCardioLine('SkiErg ~ 4 × 20 cal ~ RPE 6')).toEqual({
      name: 'SkiErg', sets: 4, quantity: 20, unit: 'cal', watts: null, pace: null, restSec: null, rpe: '6',
    });
    expect(parseCardioLine('Run ~ 3 × 800 m ~ 4:00/km ~ repos 2:00')).toEqual({
      name: 'Run', sets: 3, quantity: 800, unit: 'm', watts: null, pace: { mmss: '4:00', per: 'km' }, restSec: 120, rpe: null,
    });
  });

  it('tolère x, cals, kcal et repos en secondes', () => {
    expect(parseCardioLine('Bike Erg ~ 3 x 15 cals ~ repos 90s')).toMatchObject({ sets: 3, quantity: 15, unit: 'cal', restSec: 90 });
    expect(parseCardioLine('Bike Erg ~ 3 x 15 kcal ~ repos 90s')).toMatchObject({ sets: 3, quantity: 15, unit: 'cal', restSec: 90 });
  });

  it('ne confond ni une ligne force, ni une ligne metcon, ni du texte', () => {
    expect(isCardioLine('Back Squat — 5 × 3 @ 80 %1RM')).toBe(false);
    expect(isCardioLine('20 cal Row')).toBe(false);
    expect(isCardioLine('Row ~ 2 × 500 reps')).toBe(false);
    expect(isCardioLine('Row ~ pas de chiffre')).toBe(false);
    expect(isCardioLine('3 Rounds For Time :')).toBe(false);
    expect(parseStrengthLine('Row ~ 2 × 500 m ~ 250 W')).toBeNull();
    expect(isStrengthLine('Row ~ 2 × 500 m ~ 250 W')).toBe(false);
    // Une ligne cardio n'a pas de quantité en tête : le metcon la relit nom seul.
    expect(parseMovementRow('Row ~ 2 × 500 m ~ 250 W').reps).toBeNull();
  });

  it('formate la prescription pour l’écran', () => {
    expect(formatCardioPrescription(base)).toBe('2 × 500 m @ 250 W · repos 2:00');
    expect(formatCardioPrescription({ ...base, watts: null, pace: { mmss: '4:00', per: 'km' }, restSec: null, rpe: '6' }))
      .toBe('2 × 500 m @ 4:00/km · RPE 6');
  });
});

describe('répartition des trois blocs d’une description', () => {
  it('sépare force (—), cardio (~) et metcon (quantité d’abord)', () => {
    const lines = [
      'Back Squat — 5 × 3 @ 80 %1RM',
      'Row ~ 2 × 500 m ~ 250 W ~ repos 2:00',
      '20/15 cal Row',
      '12 Pull-ups',
    ];
    const { cardio, rest } = splitCardioLines(lines);
    expect(cardio).toEqual(['Row ~ 2 × 500 m ~ 250 W ~ repos 2:00']);
    const { strength, wod } = splitStrengthLines(rest);
    expect(strength).toEqual(['Back Squat — 5 × 3 @ 80 %1RM']);
    expect(wod).toEqual(['20/15 cal Row', '12 Pull-ups']);
  });
});
