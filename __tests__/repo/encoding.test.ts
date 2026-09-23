// Aucun texte mal encodé dans le code source.
//
// « DÃ©connexion » s'affichait dans la barre latérale du super-admin : de
// l'UTF-8 relu en Latin-1 puis réenregistré. Ce test parcourt app/,
// components/ et lib/ à la recherche de ce motif.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['app', 'components', 'lib'];
const TEXT = /\.(tsx?|jsx?|mdx?|json|css)$/;
// Ã suivi d'un octet de continuation relu en Latin-1, â€ (cp1252), Â + ponctuation, caractère de remplacement.
const MOJIBAKE = /Ã[\u0080-¿]|â€|â„¢|Â[ -¿]|�/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p);
    return TEXT.test(name) ? [p] : [];
  });
}

describe('encodage du code source', () => {
  it('aucun texte UTF-8 relu en Latin-1 (ex. « DÃ©connexion »)', () => {
    const found: string[] = [];
    for (const d of DIRS) {
      for (const f of files(join(ROOT, d))) {
        readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (MOJIBAKE.test(line)) found.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
      }
    }
    expect(found).toEqual([]);
  });

  it('le motif reconnaît bien le défaut qu’il doit attraper', () => {
    expect(MOJIBAKE.test('DÃ©connexion')).toBe(true);
    expect(MOJIBAKE.test('lâ€™app')).toBe(true);
    expect(MOJIBAKE.test('Déconnexion — l’app « ok »')).toBe(false);
  });
});
