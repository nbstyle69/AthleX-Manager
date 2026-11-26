import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { translations } from '@/data/landing';

/** Landing : jamais « CrossFit » ni « Hyrox », et une version anglaise sans français. */
const DIR = 'components/landing-gym';
const FICHIERS = [
  'data/landing.ts',
  'app/landing/page.tsx',
  'app/athletes/page.tsx',
  'app/landing/landing.css',
  ...readdirSync(join(process.cwd(), DIR)).map((f) => `${DIR}/${f}`),
];

describe('vocabulaire de la landing', () => {
  it.each(FICHIERS)('%s : jamais « CrossFit » ni « Hyrox »', (f) => {
    expect(readFileSync(join(process.cwd(), f), 'utf8')).not.toMatch(/crossfit|hyrox/i);
  });

  it('les deux langues ont les mêmes clés', () => {
    const shape = (o: unknown): unknown =>
      Array.isArray(o) ? o.length : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]))
        : typeof o;
    expect(shape(translations.en)).toEqual(shape(translations.fr));
  });

  it('aucun texte anglais ne contient de lettre accentuée française', () => {
    const texts: string[] = [];
    const walk = (o: unknown) => {
      if (typeof o === 'string') texts.push(o);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(translations.en);
    expect(texts.filter((s) => /[àâçéèêëîïôûùü]/i.test(s))).toEqual([]);
  });
});
