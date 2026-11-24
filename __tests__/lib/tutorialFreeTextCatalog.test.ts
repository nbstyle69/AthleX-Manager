// « Les mouvements lus en texte libre » (Mouvements et badges, #453 PR 2d) : la liste
// de l'Aide est exactement celle que lit le texte libre, FR et EN.
import { readFileSync } from 'fs';
import path from 'path';
import { FREE_TEXT_MOVEMENTS, catalogName, freeTextPreview, readFreeText } from '@/lib/freeTextWod';

const mdx = (l: string) => readFileSync(path.join(process.cwd(), 'content', 'tutorials', l, 'mouvements-et-badges.mdx'), 'utf8').replace(/\r\n/g, '\n');

const UNIT_NOTE = { fr: { cal: ' (en calories par défaut)', m: ' (en mètres par défaut)' }, en: { cal: ' (in calories by default)', m: ' (in metres by default)' } };

function section(locale: 'fr' | 'en') {
  const src = mdx(locale);
  const start = src.indexOf(locale === 'fr' ? '### Les mouvements lus en texte libre' : '### Movements read in free text');
  expect(start).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n## ', start));
  const families = [...body.matchAll(/^- \*\*[^*]+\*\* (.+)$/gm)].map(m => m[1].split(', '));
  const abbreviations = body.match(/(?:abréviations courantes|common abbreviations) ?: ([^.]+)\./)![1].split(', ');
  return { families, abbreviations };
}

describe('liste des mouvements lus en texte libre (Aide)', () => {
  const all = FREE_TEXT_MOVEMENTS.map(m => m.name);

  it.each(['fr', 'en'] as const)('%s : exactement FREE_TEXT_MOVEMENTS, 74 noms, sans doublon', locale => {
    const notes = Object.values(UNIT_NOTE[locale]);
    const listed = section(locale).families.flat().map(n => notes.reduce((s, x) => s.replace(x, ''), n));
    expect(listed).toHaveLength(74);
    expect(new Set(listed).size).toBe(74);
    expect([...listed].sort()).toEqual([...all].sort());
  });

  it.each(['fr', 'en'] as const)('%s : unités dites = unités lues', locale => {
    const cardio = section(locale).families.find(f => f.some(n => n.includes(UNIT_NOTE[locale].cal)))!;
    // Les noms jusqu'à la mention des calories sont en cal, ceux d'après jusqu'aux mètres en m.
    const iCal = cardio.findIndex(n => n.endsWith(UNIT_NOTE[locale].cal));
    const iM = cardio.findIndex(n => n.endsWith(UNIT_NOTE[locale].m));
    const strip = (n: string) => n.replace(UNIT_NOTE[locale].cal, '').replace(UNIT_NOTE[locale].m, '');
    const expected = [...cardio.slice(0, iCal + 1).map(n => [strip(n), 'cal']), ...cardio.slice(iCal + 1, iM + 1).map(n => [strip(n), 'm'])];
    expect(expected).toEqual(FREE_TEXT_MOVEMENTS.filter(m => m.unit && m.unit !== 'reps').map(m => [m.name, m.unit]));
    for (const [name, unit] of expected) expect(readFreeText(`15 ${name}`).recognized[0].unit).toBe(unit);
  });

  it('abréviations identiques en FR et en EN, chacune lue vers un nom de la liste', () => {
    const { abbreviations } = section('fr');
    expect(section('en').abbreviations).toEqual(abbreviations);
    expect([...abbreviations].sort()).toEqual(abbreviations);
    for (const a of abbreviations) {
      expect(a).toBe(a.toUpperCase());
      const name = catalogName(a);
      expect(all).toContain(name);
      expect(readFreeText(`10 ${a}`).recognized.map(m => m.name)).toEqual([name]);
    }
  });

  it('« pow clean », « jerk » et « k2e » restent à corriger', () => {
    for (const w of ['1 pow clean', '3 jerk', '10 k2e']) {
      expect(readFreeText(w)).toMatchObject({ recognized: [], toFix: [w] });
    }
  });

  it('le message cité au point 2 est celui de l’aperçu pour « 1 pow clean »', () => {
    const message = freeTextPreview('1 pow clean').groups[0].items[0].text;
    expect(message).toBe('« pow clean » n’est pas dans la liste officielle : écris « Power Clean » pour compter 1 rep');
    for (const l of ['fr', 'en']) expect(mdx(l)).toContain(`« ${message} »`);
  });
});
