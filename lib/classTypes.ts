/**
 * Types de cours proposés par les éditeurs de créneau et de créneau type.
 *
 * Liste unique : /schedules, /templates et le panneau « Créneaux types »
 * écrivent tous la même valeur dans `title`. Le panneau écrivait
 * « Halterophilie » sans accent ; l'ancienne orthographe reste reconnue à la
 * lecture, sans réécriture en base : elle n'est corrigée que lorsqu'un
 * utilisateur enregistre.
 */
export const CLASS_TYPES = [
  'WOD', 'Haltérophilie', 'Cardio', 'Open Gym',
  'Strength', 'Mobility', 'Kids', 'Teens', 'Autre',
];

export const OTHER_CLASS_TYPE = 'Autre';

const LEGACY_CLASS_TYPES: Record<string, string> = {
  Halterophilie: 'Haltérophilie',
};

/** Ramène une ancienne orthographe à la valeur canonique ; le reste passe tel quel. */
export function normalizeClassType(title: string): string {
  return LEGACY_CLASS_TYPES[title] ?? title;
}

/**
 * État d'un éditeur ouvert sur un titre enregistré : type prédéfini, ou
 * « Autre » avec le nom réel conservé tel quel.
 */
export function classTypeFormFromTitle(title: string): { title: string; customTitle: string } {
  const normalized = normalizeClassType(title);
  const isPreset = normalized !== OTHER_CLASS_TYPE && CLASS_TYPES.includes(normalized);
  return isPreset ? { title: normalized, customTitle: '' } : { title: OTHER_CLASS_TYPE, customTitle: title };
}

/**
 * Titre enregistré par les éditeurs de créneau type : le type choisi, ou le
 * nom réel en « Autre » (tel quel). « Autre » sans nom reste « Autre », comme
 * avant l'ajout du champ.
 */
export function classTypeTitleToSave(form: { title: string; customTitle: string }): string {
  if (form.title !== OTHER_CLASS_TYPE) return form.title;
  return form.customTitle.trim() ? form.customTitle : OTHER_CLASS_TYPE;
}
