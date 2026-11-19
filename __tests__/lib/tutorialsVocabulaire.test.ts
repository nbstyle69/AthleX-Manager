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

  it('Musculation et Cardio en texte libre : lus par l’app comme leurs blocs (FR et EN)', () => {
    const fr = readFileSync(path.join(ROOT, 'fr', 'blocs-force-musculation-cardio.mdx'), 'utf8');
    const en = readFileSync(path.join(ROOT, 'en', 'blocs-force-musculation-cardio.mdx'), 'utf8');
    expect(fr).toContain("l'app les lit comme en **Mouvements** : séance de force guidée (grille de séries)");
    expect(en).toContain('the app reads them as with **Mouvements**: guided strength session (set grid)');
    for (const t of [fr, en]) expect(t).not.toMatch(/ne les lit pas|does not read them/);
  });
});
