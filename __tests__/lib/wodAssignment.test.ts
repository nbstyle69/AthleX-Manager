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

  it('accorde au singulier pour un seul WOD', () => {
    expect(libelleAssignation(1, { groupes: ['Intra-Box'], programmes: [] }, 'remplacer'))
      .toBe('1 WOD restreint à (remplacement) Groupe : Intra-Box.');
    expect(libelleAssignation(1, { groupes: ['Intra-Box'], programmes: [] }, 'ajouter'))
      .toBe('1 WOD assigné à Groupe : Intra-Box.');
  });

  it('dit la conséquence quand le remplacement ne vise rien', () => {
    expect(libelleAssignation(1, { groupes: [], programmes: [] }, 'remplacer'))
      .toBe('1 WOD sans restriction — visible par toute la box.');
  });
});
