import { messageErreur } from '@/lib/erreurs';

describe('messageErreur', () => {
  it('lit le message d\'une Error', () => {
    expect(messageErreur(new Error('boom'))).toBe('boom');
  });

  it('rend le message, les détails et le code d\'une erreur PostgREST (objet nu, pas une Error)', () => {
    const e = { message: 'new row violates check constraint "box_wods_ancrage_check"', details: null, hint: null, code: '23514' };
    expect(messageErreur(e)).toBe('new row violates check constraint "box_wods_ancrage_check" (23514)');
    expect(messageErreur({ message: 'permission denied for table box_wods', hint: 'RLS', code: '42501' }))
      .toBe('permission denied for table box_wods — RLS (42501)');
  });

  it('ne rend jamais « [object Object] »', () => {
    expect(messageErreur({ foo: 1 })).toBe('{"foo":1}');
    expect(messageErreur('texte')).toBe('texte');
    expect(messageErreur(42)).toBe('42');
  });
});
