/**
 * Prix affichés aux membres. Prix mensuel (validé par Nab le 14/10/2026) :
 * « 49 € / mois » — montant, espace insécable, « / mois », une seule fois.
 * Seule source de ce format ; `unit` ne sert qu'à la page publique traduite
 * (« month »).
 */

/** « 35 € », « 39,90 € ». */
export function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/** « \u00a0/ mois » : ce qui suit le montant d'un prix mensuel. */
export const perMonthSuffix = (unit = 'mois') => `\u00a0/ ${unit}`;

/** « 49 € / mois ». */
export const monthlyPrice = (cents: number, unit = 'mois') => `${euros(cents)}${perMonthSuffix(unit)}`;
