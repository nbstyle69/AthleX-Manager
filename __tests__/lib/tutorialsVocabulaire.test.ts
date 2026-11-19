import { readdirSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Vocabulaire visible de l'Aide : Functional / Hybrid / Musculation, jamais
 * les marques « CrossFit » ni « Hyrox » (#453). Tous les tutoriels, FR et EN.
 */
const ROOT = path.join(process.cwd(), 'content', 'tutorials');
const files = ['fr', 'en'].flatMap(l => readdirSync(path.join(ROOT, l)).filter(f => f.endsWith('.mdx')).map(f => path.join(l, f)));

describe('vocabulaire de l’Aide', () => {
  it('les tutoriels sont lus (FR et EN alignés)', () => {
    expect(files.length).toBeGreaterThan(80);
    const fr = files.filter(f => f.startsWith('fr')).map(f => path.basename(f)).sort();
    const en = files.filter(f => f.startsWith('en')).map(f => path.basename(f)).sort();
    expect(en).toEqual(fr);
  });

  it.each(files)('%s : ni « CrossFit » ni « Hyrox »', f => {
    const txt = readFileSync(path.join(ROOT, f), 'utf8');
    expect(txt.match(/cross\s*-?\s*fit|hyrox/gi)).toBeNull();
  });
});
