// Durée d'un WOD hybride généré (lib/wod/boAdapter.ts).
//
// Le défaut corrigé : le moteur fait tenir un AMRAP dans 80 % de la séance
// (« AMRAP 24 min » pour 30 min), un EMOM dans 70 % ; le formulaire gardait la
// durée de la séance (30), pour le minuteur et le libellé de score.

import { boGenerateHybrid, hybridScoredMinutes } from '@/lib/wod/boAdapter';

const EQ = ['SkiErg', 'Sled Push', 'Sled Pull', 'RowErg', 'Burpee BJ', 'Farmers Carry', 'Sandbag Lunge', 'Wall Balls', 'Tapis course', 'Haltères'];
const TYPES = ['Race Simulation', 'Station Training', 'Cardio Force', 'Running Intervals'];

/** La durée écrite dans le WOD lui-même : « AMRAP 24 min », « 24 min AMRAP », « EMOM 21 ». */
function writtenMinutes(movements: string[], type: string): number | null {
  const re = type === 'EMOM' ? /EMOM\s+(\d+)/i : /(?:AMRAP\s+(\d+)\s*min|(\d+)\s*min\s+AMRAP)/i;
  for (const l of movements) {
    const m = l.match(re);
    if (m) return Number(m[1] ?? m[2]);
  }
  return null;
}

describe('durée d’un WOD hybride généré', () => {
  it('AMRAP : la durée du formulaire est celle écrite dans le WOD, pour chaque durée de séance', () => {
    const seen = new Set<number>();
    for (const duration of [20, 30, 45, 60]) {
      for (let i = 0; i < 60; i++) {
        for (const t of TYPES) {
          const w = boGenerateHybrid(t, 'Open', 'Solo', duration, EQ);
          if (w.type !== 'AMRAP') continue;
          const written = writtenMinutes(w.movements, 'AMRAP');
          expect(written).not.toBeNull();
          expect(w.duration_minutes).toBe(written);
          expect(w.duration_minutes).toBe(Math.round(duration * 0.8));
          expect(w.time_cap_seconds).toBe(written! * 60);
          seen.add(duration);
        }
      }
    }
    // Des AMRAP ont bien été générés pour chaque durée : le test ne passe pas à vide.
    expect([...seen].sort((a, b) => a - b)).toEqual([20, 30, 45, 60]);
  });

  it('le cas signalé : séance de 30 min, AMRAP de 24 min', () => {
    let amrap;
    for (let i = 0; i < 200 && !amrap; i++) {
      const w = boGenerateHybrid('Station Training', 'Open', 'Solo', 30, EQ);
      if (w.type === 'AMRAP') amrap = w;
    }
    expect(amrap?.duration_minutes).toBe(24);
  });

  it('For Time : la durée de la séance est conservée', () => {
    for (let i = 0; i < 40; i++) {
      const w = boGenerateHybrid('Race Simulation', 'Open', 'Solo', 45, EQ);
      if (w.type === 'For Time') expect(w.duration_minutes).toBe(45);
    }
  });

  it('formats en équipe : la durée reste celle du WOD écrit', () => {
    for (const format of ['Doubles', 'Relais', 'Mixed Relais']) {
      for (let i = 0; i < 40; i++) {
        const w = boGenerateHybrid('Cardio Force', 'Open', format, 30, EQ);
        if (w.type === 'AMRAP') expect(w.duration_minutes).toBe(writtenMinutes(w.movements, 'AMRAP'));
      }
    }
  });
});

describe('hybridScoredMinutes', () => {
  const wod = (structure: string, scheme: string) => ({ structure, blocks: [{ label: null, structure, scheme, movements: [], rest: null }] });

  it.each([
    ['AMRAP', 'AMRAP 24 min', 'AMRAP', 24],
    ['AMRAP', '36 min AMRAP', 'AMRAP', 36],
    ['EMOM', 'EMOM 21', 'EMOM', 21],
    ['FOR TIME', '5 rounds for time', 'For Time', null],
    ['AMRAP', 'AMRAP sans durée', 'AMRAP', null],
  ])('%s « %s » → %s', (structure, scheme, type, expected) => {
    expect(hybridScoredMinutes(wod(structure, scheme) as any, type)).toBe(expected);
  });
});
