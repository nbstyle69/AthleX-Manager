import {
  MOVEMENT_CATALOG_SNAPSHOT,
  findCatalogMovement,
  getMovementCatalog,
  getMovementCatalogSource,
  loadMovementCatalog,
  resetMovementCatalog,
  setMovementCatalog,
  type MovementCatalogRow,
} from '@/lib/movementCatalog';
import { defaultUnitFor, isCardioMovement, isWeightedMovement, parseMovementRow, serializeMovement } from '@/lib/movements';
import { resolveMovementName } from '@/lib/pdfImport/movements';

const fakeRow = (over: Partial<MovementCatalogRow>): MovementCatalogRow => ({
  id: 'x', name: 'X', family: 'other', pattern: [], modality: 'M', unit_default: 'reps', units_allowed: ['reps'],
  load_unit: null, weight_functional: 1, weight_hybrid: 0, badge_key: null, active: true, version: 1, ...over,
});

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({ select: () => ({ order: async () => result }) }),
  };
}

describe('movementCatalog (snapshot + Supabase)', () => {
  afterEach(() => resetMovementCatalog());

  it('démarre sur le snapshot embarqué, inactifs compris', () => {
    expect(getMovementCatalogSource()).toBe('snapshot');
    expect(MOVEMENT_CATALOG_SNAPSHOT.length).toBeGreaterThanOrEqual(109);
    const inactive = getMovementCatalog().filter(m => !m.active);
    expect(inactive.length).toBe(14);
    expect(findCatalogMovement('Zercher Squat')?.active).toBe(false);
    expect(isWeightedMovement('Zercher Squat')).toBe(true);
  });

  it('dérive weighted / cardio / unité par défaut des colonnes Supabase', () => {
    expect(isWeightedMovement('Thruster')).toBe(true);
    expect(isWeightedMovement('Box Jumps')).toBe(false); // load_unit = cm : hauteur, pas charge
    expect(isCardioMovement('Row')).toBe(true);
    expect(defaultUnitFor('Row')).toBe('cal');
    expect(defaultUnitFor('Run')).toBe('m');
    expect(isCardioMovement('Handstand Walk')).toBe(true);
    expect(defaultUnitFor('Plank Hold')).toBe('s');
    expect(isCardioMovement('Plank Hold')).toBe(false);
  });

  it('secondes et hauteur en cm (E1/E2)', () => {
    expect(parseMovementRow('30 s Plank Hold')).toMatchObject({ reps: 30, unit: 's', name: 'Plank Hold', weightKg: null });
    expect(parseMovementRow('45/30 sec Plank Hold')).toMatchObject({ reps: 45, repsWomen: 30, unit: 's' });
    expect(parseMovementRow('30 Plank Hold').unit).toBe('s');
    expect(serializeMovement(30, 'Plank Hold', null, null, 's')).toBe('30 s Plank Hold');
    expect(parseMovementRow('20 Box Jumps (60/50 cm)')).toMatchObject({ reps: 20, name: 'Box Jumps', unit: 'reps', weightKg: null, weightKgWomen: null });
    expect(parseMovementRow('10 Sit-ups')).toMatchObject({ reps: 10, name: 'Sit-ups', unit: 'reps' });
  });

  it('remplace le snapshot par Supabase et le parseur suit', async () => {
    const src = await loadMovementCatalog(fakeClient({
      data: [fakeRow({ id: 'zz', name: 'ZZ Test Move', load_unit: 'kg' }), fakeRow({ id: 'run', name: 'Run', unit_default: 'm', units_allowed: ['m'] })],
      error: null,
    }));
    expect(src).toBe('supabase');
    expect(getMovementCatalog()).toHaveLength(2);
    expect(isWeightedMovement('ZZ Test Move')).toBe(true);
    expect(isWeightedMovement('Thruster')).toBe(false);
    expect(parseMovementRow('500 m Run').unit).toBe('m');
    expect(resolveMovementName('zz test moves')).toEqual({ name: 'ZZ Test Move', resolved: true });
  });

  it('garde le snapshot si Supabase échoue ou ne renvoie rien', async () => {
    expect(await loadMovementCatalog(fakeClient({ data: null, error: { message: 'boom' } }))).toBe('snapshot');
    expect(await loadMovementCatalog(fakeClient({ data: [], error: null }))).toBe('snapshot');
    expect(setMovementCatalog([], 'supabase')).toBe(false);
    expect(isWeightedMovement('Thruster')).toBe(true);
  });
});
