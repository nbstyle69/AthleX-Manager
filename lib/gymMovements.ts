/**
 * Mouvements de gymnastique dont l'athlète a un record en reps (section
 * Gymnastique de la page Records de l'app). Un « % du max » ne s'applique qu'à
 * eux. Miroir de gymZones.ts (athlex-app) : libellés, rapprochement et
 * abréviations identiques, à modifier des deux côtés.
 */
export const GYM_PR_MOVEMENTS = [
  'Toes To Bar', 'Pull-ups', 'Chest To Bar', 'Hand Stand Push Up', 'Strict Hand Stand Push Up', 'Wall Facing Hand Stand Push Up',
  'Ring Muscle-up', 'Bar Muscle-up', 'Dips', 'Strict Dips', 'Pull Over',
] as const;

export type GymPrMovement = (typeof GYM_PR_MOVEMENTS)[number];

/**
 * Clé de rapprochement d'un nom de mouvement : casse, tirets, espaces et pluriel
 * ne comptent pas (« Ring Muscle-ups » = « Ring Muscle-up », « Toes-to-bar » =
 * « Toes To Bar »). Les mots ne sont jamais retirés : « Strict Pull-Ups » reste
 * distinct de « Pull-ups ».
 */
function gymKey(name: string): string {
  return name.toLowerCase().split(/[\s_-]+/).filter(Boolean).map(w => w.replace(/s$/, '')).join('');
}

/**
 * Abréviations rapprochées : seulement celles qui désignent un seul des 11
 * libellés. « HSPU » (kipping, strict ou face au mur ?) et « MU » (anneaux ou
 * barre ?) n'y sont pas : en cas de doute, aucun rapprochement.
 */
const GYM_ABBREVIATIONS: Record<string, GymPrMovement> = {
  t2b: 'Toes To Bar',
  ttb: 'Toes To Bar',
  c2b: 'Chest To Bar',
  ctb: 'Chest To Bar',
  rmu: 'Ring Muscle-up',
  bmu: 'Bar Muscle-up',
  stricthspu: 'Strict Hand Stand Push Up',
  wallfacinghspu: 'Wall Facing Hand Stand Push Up',
};

const GYM_BY_KEY: ReadonlyMap<string, GymPrMovement> = new Map<string, GymPrMovement>([
  ...GYM_PR_MOVEMENTS.map(m => [gymKey(m), m] as [string, GymPrMovement]),
  ...Object.entries(GYM_ABBREVIATIONS),
]);

/** Libellé de la page Records (section Gymnastique) d'un nom de mouvement, sinon `null`. */
export function gymPrLabel(name: string): GymPrMovement | null {
  return GYM_BY_KEY.get(gymKey(name ?? '')) ?? null;
}
