/**
 * Reps par tour d'un WOD de tournoi : en-têtes de format, distances en points,
 * durée → rien d'enregistré.
 *
 * `lib/__fixtures__/wod_header_cases.json` est la copie à l'identique de
 * `supabase/seed/wod_header_cases.json` d'athlex-app : même empreinte, même
 * normalisation que `src/__tests__/wodHeaderCases.test.ts`. Seuls les cas de
 * score sont rejoués ; les champs « credit » décrivent le crédit de l'app, le
 * Manager ne crédite rien (le serveur lit `movement_lines`).
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { isFormatHeaderLine, repsPerRoundFromMovements, repsPerRoundToSave } from '@/lib/movements';
import { buildMovementLines } from '@/lib/tournaments/movementLines';

interface CasLigne { ligne: string; header: boolean; reps_score: number }
interface CasWod { nom: string; lignes: string[]; reps_par_tour: number }

const BRUT = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', '__fixtures__', 'wod_header_cases.json'), 'utf8');
const CAS: { lignes: CasLigne[]; wods: CasWod[] } = JSON.parse(BRUT);

describe('wod_header_cases.json (parité avec l\'app)', () => {
  it('empreinte du JSON normalisé', () => {
    const empreinte = createHash('sha256').update(JSON.stringify(JSON.parse(BRUT))).digest('hex');
    expect(empreinte).toBe('70459c2d7ce9dec07489f4eadaa20d8b4baddb7ce8e7a281d0d806a1acd02a56');
  });

  it.each(CAS.lignes.map(c => [c.ligne, c] as const))('ligne « %s »', (_l, c) => {
    expect({ header: isFormatHeaderLine(c.ligne), reps_score: repsPerRoundFromMovements([c.ligne]) })
      .toEqual({ header: c.header, reps_score: c.reps_score });
  });

  it.each(CAS.wods.map(w => [w.nom, w] as const))('WOD « %s »', (_n, w) => {
    expect(repsPerRoundFromMovements(w.lignes)).toBe(w.reps_par_tour);
  });

  it('garde du crédit : un en-tête ne produit aucune ligne de movement_lines', () => {
    for (const c of CAS.lignes.filter(x => x.header)) expect([c.ligne, buildMovementLines([c.ligne])]).toEqual([c.ligne, null]);
  });
});

describe('en-têtes de format : un exemple par motif', () => {
  it.each([
    '5 rounds for time', '5 rds',          // N rounds / rds / tours / RFT
    '12 min AMRAP', "12' AMRAP",           // N min, N'
    '20 EMOM',                             // N AMRAP / EMOM / for time…
    '21-15-9',                             // échelle
    '2 blocs :',                           // deux-points final
    'AMRAP 12 min', 'Rest 1 min',          // mot-clé en tête de ligne
    '⟨ Équipe de 2 ⟩ 50 Wall balls',       // libellé d'équipe
  ])('« %s » : 0 rep', line => {
    expect(isFormatHeaderLine(line)).toBe(true);
    expect(repsPerRoundFromMovements([line, '10 Burpees'])).toBe(10);
  });
});

describe('distances et shuttle runs', () => {
  it('1 point par tranche complète de 100 m', () => {
    expect(repsPerRoundFromMovements(['250 m Row'])).toBe(2);
    expect(repsPerRoundFromMovements(['199 m Row'])).toBe(1);
    expect(repsPerRoundFromMovements(['50 m Sled push'])).toBe(0);
    expect(repsPerRoundFromMovements(['1 km Run'])).toBe(10);
  });

  it('shuttle run : 1 point par aller de 7,62 m, le nombre écrit sinon', () => {
    expect(repsPerRoundFromMovements(['30 m Shuttle run'])).toBe(3);
    expect(repsPerRoundFromMovements(['10 Shuttle runs'])).toBe(10);
  });
});

describe('WODs de référence', () => {
  it.each([
    [['5 rounds for time', '10 Thrusters', '12 Pull-ups', '15 Box jump'], 37],
    [['12 min AMRAP', '10 Thrusters', '12 Pull-ups', '15 Box jump'], 37],
    [['12 min AMRAP', '200m Row', '12 Burpees'], 14],
    [['15 min AMRAP', '1 km Run', '20 Wall balls'], 30],
    [['20 min AMRAP', '30 s Plank', '10 Burpees'], 0],
  ])('%j → %i', (lines, expected) => {
    expect(repsPerRoundFromMovements(lines)).toBe(expected);
  });
});

describe('reps_per_round enregistré par WODForm', () => {
  it('champ vide : la somme des lignes', () => {
    expect(repsPerRoundToSave('AMRAP', '', ['12 min AMRAP', '200m Row', '12 Burpees'])).toBe(14);
  });

  it('ligne en durée : NULL, jamais 0', () => {
    expect(repsPerRoundToSave('AMRAP', '', ['20 min AMRAP', '30 s Plank', '10 Burpees'])).toBeNull();
  });

  it('valeur saisie par le gérant : conservée', () => {
    expect(repsPerRoundToSave('AMRAP', '25', ['12 min AMRAP', '10 Thrusters'])).toBe(25);
    expect(repsPerRoundToSave('Max Reps', '7', ['20 min AMRAP', '30 s Plank'])).toBe(7);
  });

  it('hors AMRAP / Max Reps : NULL', () => {
    expect(repsPerRoundToSave('For Time', '25', ['10 Thrusters'])).toBeNull();
  });
});
