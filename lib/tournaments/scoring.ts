import { formatCap } from '@/lib/wodFields';

/** Types d'un WOD de tournoi, tels qu'enregistrés dans `tournament_wods.type`. */
export const TOURNAMENT_WOD_TYPES = ['AMRAP', 'For Time', 'EMOM', 'Tabata', 'Max Reps', 'Strength'] as const;

export interface ScoringInputs {
  /** Durée d'un AMRAP, nombre de minutes d'un EMOM. */
  durationMinutes: number | null;
  /** Time cap d'un For Time ou d'un Max Reps, en secondes. */
  capSeconds: number | null;
}

/**
 * Libellé `scoring` d'un WOD de tournoi, dérivé de son type.
 *
 * Le libellé était un texte libre, sans lien avec le type : changer de type
 * ne le touchait pas, et rien n'empêchait « For time » sur un AMRAP (vu en
 * prod). Dérivé, il ne peut plus le contredire. `null` pour un type inconnu.
 */
export function scoringLabel(type: string, { durationMinutes, capSeconds }: ScoringInputs): string | null {
  const cap = capSeconds ? ` (cap ${formatCap(capSeconds)})` : '';
  switch (type) {
    case 'For Time': return `Temps total${cap}`;
    case 'AMRAP':    return durationMinutes ? `Tours complets + reps en ${durationMinutes} min` : 'Tours complets + reps';
    case 'EMOM':     return durationMinutes ? `Rounds complétés sur ${durationMinutes} min` : 'Rounds complétés';
    case 'Tabata':   return 'Total de reps';
    case 'Max Reps': return `Total de reps${cap}`;
    case 'Strength': return 'Charge max';
    default:         return null;
  }
}
