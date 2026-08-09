import { writeFailure } from '@/lib/writeGuard';

describe('writeFailure', () => {
  it('remonte le message quand Supabase renvoie une erreur', () => {
    expect(writeFailure({ message: 'permission denied' }, null)).toBe('permission denied');
  });

  it('remonte un refus quand aucune ligne n\'est touchée (RLS silencieuse)', () => {
    expect(writeFailure(null, [])).toMatch(/refus/i);
  });

  it('remonte un refus quand data est null sans erreur', () => {
    expect(writeFailure(null, null)).toMatch(/refus/i);
  });

  it('ne signale rien quand au moins une ligne est écrite', () => {
    expect(writeFailure(null, [{ id: 'row-1' }])).toBeNull();
  });
});
