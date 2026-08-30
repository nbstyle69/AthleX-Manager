import { libelleAssignation } from '@/lib/wodAssignment';

describe('libelleAssignation', () => {
  it('nomme les destinataires, pas seulement le nombre', () => {
    expect(
      libelleAssignation(12, { groupes: ['Muscu'], programmes: ['Force 6'] }, 'ajouter'),
    ).toBe('12 WODs assignés à Groupe : Muscu, Programme : Force 6.');
  });

  it('distingue le remplacement de l’ajout', () => {
    expect(libelleAssignation(3, { groupes: ['Muscu'], programmes: [] }, 'remplacer'))
      .toBe('3 WODs restreints à (remplacement) Groupe : Muscu.');
    expect(libelleAssignation(3, { groupes: ['Muscu'], programmes: [] }, 'ajouter'))
      .toBe('3 WODs assignés à Groupe : Muscu.');
  });

  it('dit la conséquence quand le remplacement ne vise rien', () => {
    expect(libelleAssignation(1, { groupes: [], programmes: [] }, 'remplacer'))
      .toBe('1 WOD sans restriction — visibles par toute la box.');
  });
});
