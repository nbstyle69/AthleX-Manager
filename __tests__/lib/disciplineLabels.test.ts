import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(__dirname, '../../app/(dashboard)/programming/page.tsx'),
  'utf8',
);

describe('Programmation : libellés Functional / Hybrid, valeurs internes inchangées', () => {
  it('conserve les valeurs crossfit / hyrox / hybrid en base', () => {
    expect(SRC).toMatch(/const DISCIPLINES = \['crossfit', 'hyrox', 'hybrid', 'haltero', 'endurance'\]/);
    expect(SRC).toMatch(/discipline: 'crossfit'/);
  });

  it("affiche Functional pour crossfit et Hybrid pour hyrox, jamais la valeur brute", () => {
    expect(SRC).toMatch(/crossfit: 'Functional'/);
    expect(SRC).toMatch(/hyrox: 'Hybrid'/);
    expect(SRC).not.toMatch(/'CrossFit'|'Hyrox'/);
    expect(SRC).not.toMatch(/<option key=\{d\} value=\{d\}>\{d\}<\/option>/);
    expect(SRC).not.toMatch(/<Tag>\{p\.discipline\}<\/Tag>/);
    expect(SRC).not.toMatch(/\{o\.discipline\} ·/);
    expect((SRC.match(/disciplineLabel\(/g) ?? []).length).toBe(4);
  });
});
