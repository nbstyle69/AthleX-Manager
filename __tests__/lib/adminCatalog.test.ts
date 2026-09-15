import { emptyLoadTable, validateLoadTable, validateMovementPatch, validateVolumeCapPatch } from '@/lib/adminCatalog';

const full = {
  id: 'zz_test', name: 'ZZ Test', family: 'dumbbell', pattern: ['squat'], modality: 'W',
  unit_default: 'reps', units_allowed: ['reps'], load_unit: 'kg', weight_functional: 3, weight_hybrid: 0, active: true,
};

describe('validateMovementPatch', () => {
  it('accepte une création complète', () => {
    const { errors, patch } = validateMovementPatch(full, true);
    expect(errors).toEqual([]);
    expect(patch).toMatchObject({ id: 'zz_test', name: 'ZZ Test', load_unit: 'kg' });
  });

  it('refuse un id hors snake_case, une famille inconnue, un poids > 10', () => {
    const { errors } = validateMovementPatch({ ...full, id: 'ZZ Test', family: 'nope', weight_hybrid: 11 }, true);
    expect(errors.join(' ')).toMatch(/id/);
    expect(errors.join(' ')).toMatch(/famille/);
    expect(errors.join(' ')).toMatch(/weight_hybrid/);
  });

  it('exige que l’unité par défaut soit autorisée', () => {
    const { errors } = validateMovementPatch({ ...full, unit_default: 'cal' }, true);
    expect(errors.join(' ')).toMatch(/par défaut/);
  });

  it('un patch partiel ne réclame pas les champs absents', () => {
    const { errors, patch } = validateMovementPatch({ active: false }, false);
    expect(errors).toEqual([]);
    expect(patch).toEqual({ active: false });
  });

  it('load_unit vide → null ; bandes valides ou refusées', () => {
    expect(validateMovementPatch({ load_unit: '' }, false).patch.load_unit).toBeNull();
    expect(validateLoadTable(emptyLoadTable())).toBe(true);
    expect(validateLoadTable({ rx: { heavy: [1, 2] } })).toBe(false);
    const bad = emptyLoadTable();
    (bad.rx.heavy as number[])[0] = -1;
    expect(validateMovementPatch({ loads: bad }, false).errors.join(' ')).toMatch(/bandes/);
  });
});

describe('validateVolumeCapPatch', () => {
  it('accepte total / actif / unité, refuse le vide et un total ≤ 0', () => {
    expect(validateVolumeCapPatch({ rx_total: 40, active: true, unit: 'reps' })).toEqual({ errors: [], patch: { rx_total: 40, active: true, unit: 'reps' } });
    expect(validateVolumeCapPatch({}).errors).toEqual(['rien à modifier']);
    expect(validateVolumeCapPatch({ rx_total: 0 }).errors.join(' ')).toMatch(/rx_total/);
    expect(validateVolumeCapPatch({ unit: 'km' }).errors.join(' ')).toMatch(/unité/);
  });
});
