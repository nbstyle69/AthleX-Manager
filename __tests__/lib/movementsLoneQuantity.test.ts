// parseMovementRow — une quantité seule, sans nom de mouvement.
//
// Le défaut corrigé : dans l'éditeur de WOD de tournoi, taper les reps avant le
// nom sur une ligne vide écrivait la ligne « 40 », relue « 4 reps d'un
// mouvement nommé 0 » — et « 4 » seul devenait un nom : le chiffre passait dans
// le champ du nom.

import { parseMovementRow, serializeMovement } from '@/lib/movements';

describe('parseMovementRow — quantité seule', () => {
  it.each([
    ['4', 4, null],
    ['40', 40, null],
    ['400', 400, null],
    ['20/15', 20, 15],
    ['  12  ', 12, null],
  ])('« %s » : reps %d, pas de nom', (line, reps, repsWomen) => {
    expect(parseMovementRow(line)).toEqual({ reps, repsWomen, unit: 'reps', name: '', weightKg: null, weightKgWomen: null });
  });

  it('saisie des reps avant le nom, frappe par frappe, puis le nom', () => {
    // L'éditeur réécrit la ligne à chaque frappe à partir de ce qu'il relit.
    let line = '';
    for (const typed of ['4', '40', '400']) {
      const { name } = parseMovementRow(line);
      line = serializeMovement(Number(typed), name);
      expect(parseMovementRow(line)).toMatchObject({ reps: Number(typed), name: '' });
    }
    const { reps } = parseMovementRow(line);
    line = serializeMovement(reps!, 'Run');
    expect(parseMovementRow(line)).toMatchObject({ reps: 400, name: 'Run', unit: 'm' });
  });

  it('une ligne avec un nom n’est pas concernée', () => {
    expect(parseMovementRow('40 Run')).toMatchObject({ reps: 40, name: 'Run' });
    expect(parseMovementRow('21 Thruster (43/30 kg)')).toMatchObject({ reps: 21, name: 'Thruster', weightKg: 43, weightKgWomen: 30 });
    expect(parseMovementRow('5 rounds for time')).toMatchObject({ reps: 5, name: 'rounds for time' });
  });
});
