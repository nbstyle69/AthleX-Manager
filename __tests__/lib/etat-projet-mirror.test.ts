import fs from 'fs';
import path from 'path';

/**
 * `docs/ETAT_DU_PROJET.md` de ce dépôt est un renvoi vers la source unique
 * (`athlex-app`). Une copie, elle, diverge en silence : elle continue d'afficher
 * un avancement plausible et périmé. Le contrôle refuse donc qu'on recopie ici
 * les sections de l'état.
 */
const MIRROR = path.join(process.cwd(), 'docs', 'ETAT_DU_PROJET.md');
const CANONICAL =
  'https://github.com/nbstyle69/athlex-app/blob/master/docs/ETAT_DU_PROJET.md';

/** Titres de l'état canonique : leur présence ici signerait une copie. */
const STATE_SECTIONS = [
  'En production aujourd’hui',
  "En production aujourd'hui",
  'À venir, dans l’ordre',
  "À venir, dans l'ordre",
  'Backlog à déclencheur',
  'Résiduels connus et assumés',
];

describe('miroir de l’état du projet', () => {
  const body = fs.readFileSync(MIRROR, 'utf8');

  it('pointe sur la source unique', () => {
    expect(body).toContain(CANONICAL);
  });

  it('dit qu’il n’est pas l’état lui-même', () => {
    expect(body).toMatch(/n'est pas l'état du projet|n’est pas l’état du projet/);
  });

  it('ne recopie aucune section de l’état', () => {
    const copied = STATE_SECTIONS.filter((s) => new RegExp(`^#{1,3} .*${s}`, 'm').test(body));
    expect(copied).toEqual([]);
  });

  it('rappelle la règle de mise à jour', () => {
    expect(body).toContain('lot incomplet');
  });

  it('reste court — un renvoi ne s’étale pas', () => {
    expect(body.split('\n').length).toBeLessThan(60);
  });
});
