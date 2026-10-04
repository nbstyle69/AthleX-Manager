import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { isStrengthLine, parseStrengthLine, serializeStrength, type StrengthEntry } from '@/lib/strengthBlock';
import { gymPrLabel, GYM_PR_MOVEMENTS } from '@/lib/gymMovements';
import { parseMovementRow } from '@/lib/movements';

/**
 * Contrat de format partagé avec athlex-app : `lib/__fixtures__/strength-line-contract.json`
 * est la copie octet pour octet de `src/__tests__/fixtures/strength-line-contract.json`
 * côté app. Le même fichier fait passer les deux dépôts.
 */
const FILE = path.join(__dirname, '../../lib/__fixtures__/strength-line-contract.json');
const bytes = readFileSync(FILE);
const contract = JSON.parse(bytes.toString('utf8')) as {
  cases: Array<{ line: string; expected: Record<string, string | number> | null; serialize: boolean }>;
};
const FIELDS = ['name', 'sets', 'reps', 'pctOfMax', 'restSec'] as const;

/** Champs comparés ; absent = non défini ou null, et des reps à 0 comptent comme absentes. */
function pick(e: Partial<StrengthEntry>) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = e[f];
    if (v == null || (f === 'reps' && v === 0)) continue;
    out[f] = v;
  }
  return out;
}

describe('contrat de format des lignes de force (partagé avec l’app)', () => {
  it('le fichier est celui de l’app, octet pour octet', () => {
    expect(bytes.length).toBe(1320);
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('52b03e77b685ae11e108841902e5281775c4a6c98fdcf0fae18f9c5f7fdd7025');
  });

  it.each(contract.cases.map(c => [c.line, c] as const))('%s', (_line, c) => {
    const parsed = parseStrengthLine(c.line);
    if (c.expected == null) {
      expect(parsed).toBeNull();
      expect(isStrengthLine(c.line)).toBe(false);
      return;
    }
    expect(parsed).not.toBeNull();
    expect(pick(parsed!)).toEqual(c.expected);
    if (c.serialize) {
      const x = c.expected;
      expect(serializeStrength({
        name: String(x.name),
        sets: Number(x.sets),
        reps: x.reps != null ? Number(x.reps) : 0,
        load: null,
        unit: 'kg',
        restSec: x.restSec != null ? Number(x.restSec) : null,
        tempo: null,
        ...(x.pctOfMax != null ? { pctOfMax: Number(x.pctOfMax) } : {}),
      })).toBe(c.line);
    }
  });
});

describe('« % du max » (mouvements de gymnastique)', () => {
  it('une ligne « % du max » est une ligne de force, jamais du metcon', () => {
    expect(isStrengthLine('Ring Muscle-up — 3 × 15 % du max — repos 1:30')).toBe(true);
    expect(isStrengthLine('Toes To Bar — 2 × 60 % du max')).toBe(true);
    // Le parseur du metcon (crédit des reps) ne lui trouve aucune rep.
    expect(parseMovementRow('Ring Muscle-up — 3 × 15 % du max — repos 1:30').reps).toBeNull();
  });

  it('« S × P % » sans « du max » se lit comme un % du max, et s’écrit avec', () => {
    const e = parseStrengthLine('T2B — 4 × 50 %');
    expect(e).toMatchObject({ name: 'T2B', sets: 4, reps: 0, pctOfMax: 50, load: null });
    expect(serializeStrength(e!)).toBe('T2B — 4 × 50 % du max');
  });

  it('accepte une virgule décimale', () => {
    expect(parseStrengthLine('Dips — 3 × 12,5 % du max')?.pctOfMax).toBe(12.5);
  });

  it('réservé aux 11 mouvements : « % » nu sur un mouvement chargé n’est pas reconnu', () => {
    expect(parseStrengthLine('Back Squat — 3 × 15 %')).toBeNull();
    expect(parseStrengthLine('Strict Pull-Ups — 3 × 15 % du max')).toBeNull();
  });

  it('la forme « reps @ % » garde ses reps (pas de % du max)', () => {
    expect(parseStrengthLine('Pull-ups — 3 × 5 @ 60 %')).toMatchObject({ reps: 5, load: 60, unit: '%1RM' });
    expect(parseStrengthLine('Pull-ups — 3 × 5 @ 60 %')).not.toHaveProperty('pctOfMax');
  });

  it('écrit charge, repos puis tempo ; jamais de reps ni de « @ »', () => {
    expect(serializeStrength({
      name: 'Ring Muscle-up', sets: 3, reps: 4, load: 80, unit: '%1RM',
      restSec: 90, tempo: '20X0', loadNote: 'gilet', pctOfMax: 15,
    })).toBe('Ring Muscle-up — 3 × 15 % du max — charge gilet — repos 1:30 — tempo 20X0');
  });

  it('aller-retour intact', () => {
    const line = 'Bar Muscle-up — 5 × 40 % du max — repos 2:00 — tempo 10X0';
    expect(serializeStrength(parseStrengthLine(line)!)).toBe(line);
  });
});

describe('gymPrLabel (miroir de gymZones.ts, athlex-app)', () => {
  it('reconnaît les 11 libellés', () => {
    expect(GYM_PR_MOVEMENTS).toHaveLength(11);
    for (const m of GYM_PR_MOVEMENTS) expect(gymPrLabel(m)).toBe(m);
  });

  it('ignore casse, tirets, espaces et pluriel', () => {
    expect(gymPrLabel('ring muscle-ups')).toBe('Ring Muscle-up');
    expect(gymPrLabel('Toes-to-bar')).toBe('Toes To Bar');
    expect(gymPrLabel('PULL UPS')).toBe('Pull-ups');
    expect(gymPrLabel('Handstand Push-ups')).toBe('Hand Stand Push Up');
  });

  it('ne retire aucun mot', () => {
    expect(gymPrLabel('Strict Pull-Ups')).toBeNull();
    expect(gymPrLabel('Strict Dips')).toBe('Strict Dips');
  });

  it('abréviations sans ambiguïté seulement', () => {
    expect(gymPrLabel('T2B')).toBe('Toes To Bar');
    expect(gymPrLabel('ttb')).toBe('Toes To Bar');
    expect(gymPrLabel('C2B')).toBe('Chest To Bar');
    expect(gymPrLabel('CTB')).toBe('Chest To Bar');
    expect(gymPrLabel('RMU')).toBe('Ring Muscle-up');
    expect(gymPrLabel('BMU')).toBe('Bar Muscle-up');
    expect(gymPrLabel('Strict HSPU')).toBe('Strict Hand Stand Push Up');
    expect(gymPrLabel('Wall Facing HSPU')).toBe('Wall Facing Hand Stand Push Up');
    expect(gymPrLabel('MU')).toBeNull();
    expect(gymPrLabel('HSPU')).toBeNull();
    expect(gymPrLabel('Back Squat')).toBeNull();
    expect(gymPrLabel('')).toBeNull();
  });
});
