// Retour après connexion : seuls les chemins internes sont suivis.
import { safeLoginNext, loginThenReturnTo } from '@/lib/auth/loginNext';

describe('safeLoginNext', () => {
  it('garde un chemin interne', () => {
    expect(safeLoginNext('/rejoindre/abc123')).toBe('/rejoindre/abc123');
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/x'],
    ['//evil.example/x'],
    ['/\\evil.example/x'],
    ['javascript:alert(1)'],
    ['rejoindre/abc'],
  ])('refuse %p', (raw) => {
    expect(safeLoginNext(raw)).toBeNull();
  });
});

describe('loginThenReturnTo', () => {
  it('connexion athlète qui ramène sur l’invitation', () => {
    expect(loginThenReturnTo('/rejoindre/abc123')).toBe('/login/athlete?next=%2Frejoindre%2Fabc123');
  });

  it('une URL externe ne devient jamais un retour', () => {
    expect(loginThenReturnTo('//evil.example')).toBe('/login/athlete');
  });
});
