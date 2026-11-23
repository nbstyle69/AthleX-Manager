// Séances d'exemple de « Le format en texte libre » (#453, PR 2d) : identiques en
// FR et en EN, et lues par l'aperçu exactement comme l'Aide le dit.
import { readFileSync } from 'fs';
import path from 'path';
import { freeTextPreview, readFreeText } from '@/lib/freeTextWod';

const mdx = (l: string) => readFileSync(path.join(process.cwd(), 'content', 'tutorials', l, 'editeur-wod-formats-et-publication.mdx'), 'utf8').replace(/\r\n/g, '\n');

function examples(locale: string, heading: string): string[] {
  const src = mdx(locale);
  const start = src.indexOf(`## ${heading}\n`);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\n## ', start + 1);
  return [...src.slice(start, end).matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]);
}

const fr = examples('fr', 'Le format en texte libre');
const en = examples('en', 'The free text format');
const names = (t: string) => readFreeText(t).recognized.map(m => m.name);

describe('séances d’exemple du format en texte libre', () => {
  it('six séances, identiques en FR et en EN', () => {
    expect(fr).toHaveLength(6);
    expect(en).toEqual(fr);
  });

  it('For Time : 6 reconnus, 0 à corriger, « For time » et « TC 10\' » ignorés', () => {
    const r = readFreeText(fr[0]);
    expect(r.recognized).toHaveLength(6);
    expect(r.toFix).toEqual([]);
    expect(r.ignored).toEqual(['For time', "TC 10'"]);
    expect([freeTextPreview(fr[0]).okCount, freeTextPreview(fr[0]).fixCount]).toEqual([6, 0]);
  });

  it('AMRAP : Wall Balls, SkiErg, Burpees, 0 à corriger', () => {
    expect(names(fr[1])).toEqual(['Wall Balls', 'SkiErg', 'Burpees']);
    expect(readFreeText(fr[1]).toFix).toEqual([]);
  });

  it('EMOM : Row, KB Swing, 0 à corriger, « E2MOM 16\' » ignoré', () => {
    const r = readFreeText(fr[2]);
    expect(names(fr[2])).toEqual(['Row', 'KB Swing']);
    expect(r.toFix).toEqual([]);
    expect(r.ignored).toEqual(["E2MOM 16'"]);
  });

  it('Tabata : 0 reconnu, Air squats et Push-ups à corriger', () => {
    const r = readFreeText(fr[3]);
    expect(r.recognized).toEqual([]);
    expect(r.toFix).toEqual(['Air squats', 'Push-ups']);
    expect(freeTextPreview(fr[3]).fixCount).toBe(2);
  });

  it('Complexe en metcon : Power Clean, Front Squat, Push Jerk, chacun 70 ♂ / 45 ♀, « E2MOM 10\' » ignoré', () => {
    const r = readFreeText(fr[4]);
    expect(r.recognized.map(m => [m.name, m.loadKg])).toEqual(
      ['Power Clean', 'Front Squat', 'Push Jerk'].map(n => [n, { male: 70, female: 45 }]),
    );
    expect(r.toFix).toEqual([]);
    expect(r.ignored).toEqual(["E2MOM 10'"]);
  });

  it('Musculation puis metcon : 1 ligne de bloc en tête, Burpees et Run, 0 à corriger', () => {
    const r = readFreeText(fr[5]);
    expect(r.blocks).toEqual(['Back Squat — 5 × 3 @ 80 %1RM — repos 2:00']);
    expect(names(fr[5])).toEqual(['Burpees', 'Run']);
    expect(r.toFix).toEqual([]);
    const p = freeTextPreview(fr[5]);
    expect([p.strength.length, p.okCount, p.fixCount]).toEqual([1, 2, 0]);
  });
});
