/**
 * Accords des nombres connus dans les textes affichés (règle S4) : jamais de
 * « (s) », le singulier pour 0 et 1, le pluriel au-delà.
 */

/** « 1 membre » / « 3 membres » (0 et 1 au singulier). */
export const countOf = (n: number, one: string, many: string) => `${n} ${n <= 1 ? one : many}`;

/** Après « de » : « d’1 abonnement » / « de 3 abonnements » (élision devant 1). */
export const deCount = (n: number, one: string, many: string) => (n === 1 ? `d’1 ${one}` : `de ${n} ${n <= 1 ? one : many}`);
