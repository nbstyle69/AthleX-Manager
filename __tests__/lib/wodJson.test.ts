import {
  buildWodJson, isMissingWodJsonColumn, stripWodJson, withWodJson, writeWithWodJsonFallback,
} from '@/lib/wodJson';
import { serializeMovement } from '@/lib/movements';
import { serializeStrength } from '@/lib/strengthBlock';
import { serializeCardio } from '@/lib/cardioBlock';

describe('buildWodJson', () => {
  it('structure les lignes de description sans la remplacer', () => {
    const description = [
      serializeMovement(21, 'Thruster', 43, 30),
      serializeMovement(20, 'Row', null, null, 'cal', 15),
      serializeMovement(15, 'Zercher Squat', 60),
      serializeStrength({ name: 'Back Squat', sets: 5, reps: 3, load: 80, unit: '%1RM', restSec: 120, tempo: null }),
      serializeCardio({ name: 'Run', sets: 3, quantity: 800, unit: 'm', watts: null, pace: null, restSec: 120, rpe: null }),
      'Repos 1 min entre les rounds',
    ].join('\n');
    const json = buildWodJson({
      description, wod_type: 'emom', time_cap_seconds: 900, rounds: 3, emom_interval_minutes: 2,
    });
    expect(json.version).toBe(1);
    expect(json.source).toBe('manager');
    expect(json.format).toBe('emom');
    expect(json.time_cap_s).toBe(900);
    expect(json.rounds).toBe(3);
    expect(json.emom_interval_s).toBe(120);
    expect(json.tabata).toBeNull();
    expect(json.movements).toEqual([
      { reps: 21, repsWomen: null, unit: 'reps', name: 'Thruster', catalogId: 'thruster', weightKg: 43, weightKgWomen: 30 },
      { reps: 20, repsWomen: 15, unit: 'cal', name: 'Row', catalogId: 'row', weightKg: null, weightKgWomen: null },
      { reps: 15, repsWomen: null, unit: 'reps', name: 'Zercher Squat', catalogId: expect.any(String), weightKg: 60, weightKgWomen: null },
    ]);
    expect(json.strength).toHaveLength(1);
    expect(json.strength[0].name).toBe('Back Squat');
    expect(json.cardio).toHaveLength(1);
    expect(json.cardio[0].quantity).toBe(800);
    expect(json.free_text).toEqual(['Repos 1 min entre les rounds']);
  });

  it('tabata et description vide', () => {
    const json = buildWodJson({
      description: null, wod_type: 'tabata', time_cap_seconds: null, rounds: 8, tabata_work_seconds: 20, tabata_rest_seconds: 10,
    });
    expect(json.tabata).toEqual({ work_s: 20, rest_s: 10 });
    expect(json.movements).toEqual([]);
    expect(json.free_text).toEqual([]);
  });

  it('un mouvement hors catalogue garde catalogId null', () => {
    const json = buildWodJson({ description: '10 Mouvement Inconnu', wod_type: 'for_time', time_cap_seconds: null, rounds: null });
    expect(json.movements[0]).toMatchObject({ name: 'Mouvement Inconnu', catalogId: null });
  });

  it('withWodJson / stripWodJson', () => {
    const p = withWodJson({ title: 'x', description: '10 Burpees', wod_type: 'amrap', time_cap_seconds: 600, rounds: null });
    expect(p.wod_json.movements[0].name).toBe('Burpees');
    expect(p.title).toBe('x');
    expect('wod_json' in stripWodJson(p)).toBe(false);
    expect(stripWodJson([p, p]).every(r => !('wod_json' in r))).toBe(true);
  });
});

describe('garde wod_json (colonne absente)', () => {
  it('reconnaît 42703 et PGRST204 seulement', () => {
    expect(isMissingWodJsonColumn({ code: '42703', message: 'column "wod_json" does not exist' })).toBe(true);
    expect(isMissingWodJsonColumn({ code: 'PGRST204', message: "Could not find the 'wod_json' column" })).toBe(true);
    expect(isMissingWodJsonColumn({ code: '23505', message: 'duplicate' })).toBe(false);
    expect(isMissingWodJsonColumn(null)).toBe(false);
  });

  it('rejoue sans la colonne sur PGRST204, pas sur une autre erreur', async () => {
    const calls: boolean[] = [];
    const r = await writeWithWodJsonFallback(async inc => {
      calls.push(inc);
      return inc ? { error: { code: 'PGRST204', message: 'no wod_json' } } : { error: null };
    });
    expect(calls).toEqual([true, false]);
    expect(r.error).toBeNull();

    const calls2: boolean[] = [];
    const r2 = await writeWithWodJsonFallback(async inc => {
      calls2.push(inc);
      return { error: { code: '42501', message: 'rls' } };
    });
    expect(calls2).toEqual([true]);
    expect(r2.error?.code).toBe('42501');

    const calls3: boolean[] = [];
    await writeWithWodJsonFallback(async inc => { calls3.push(inc); return { error: null }; });
    expect(calls3).toEqual([true]);
  });
});
