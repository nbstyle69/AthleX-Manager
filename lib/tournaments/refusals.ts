import { countOf } from '@/lib/plural';

/**
 * Refus de la base sur les tournois, dits en français clair : jamais un code
 * brut à l'écran. La base répond « CODE: texte » ; `generate_bracket_round_1`
 * répond encore en anglais, sans code (reconnu par son texte, en attendant
 * des codes côté athlex-app).
 */

export const GENERIC_REFUSAL = 'L’action n’a pas abouti. Réessaie, ou contacte le support si ça continue.';

// Les codes absents (TOURNOI_COMPLET, HORS_BOX, GENRE_CIBLE, STATUT_RECUL,
// TOURNOI_CLOTURE…) s'affichent par le texte de la base, sans le code : il est
// déjà le texte validé.
const BY_CODE: Record<string, string> = {
  MATCH_TERMINE: 'Ce match est terminé : il ne peut pas être supprimé. Pour corriger le résultat, remets-le à jouer ou choisis le vainqueur ; l’ELO est recalculé.',
  TOURNOI_INCONNU: 'Ce tournoi n’existe plus.',
  TOURNOI_ARCHIVE: 'Ce tournoi est archivé : les inscriptions sont fermées. Désarchive-le pour ajouter un participant.',
  TABLEAU_DEJA_TIRE: 'Le tableau est déjà tiré : les inscriptions sont closes.',
  DIVISION_PLEINE: 'La division d’entrée de la ligue est complète.',
  DIVISION_INDISPONIBLE: 'La ligue n’a pas de division ouverte aux inscriptions.',
  FORMAT_FIGE: 'Le format d’un tournoi ne change pas après sa création.',
  CLOTURE_DEDIEE: 'Un tournoi se clôture par sa clôture dédiée, qui calcule l’ELO final.',
};

const NOT_ALLOWED = 'Tu n’as pas les droits pour gérer ce tournoi.';

/** Le tournoi a un résultat validé : on propose l'archivage, sans message. */
export function isResultsRefusal(message: string | null | undefined): boolean {
  return /^TOURNOI_AVEC_RESULTATS\s*:/.test(message ?? '');
}

export function tournamentRefusal(message: string | null | undefined, code?: string | null): string {
  const m = (message ?? '').trim();
  if (m.startsWith('Cannot regenerate')) {
    return 'Le tableau ne peut plus être régénéré : un match est déjà joué. Pour corriger un résultat, remets le match à jouer ou choisis le vainqueur.';
  }
  if (m.startsWith('Need at least 2 participants')) return 'Il faut au moins 2 participants pour tirer le tableau.';
  // advance_bracket_round : « Round 3 has 2 unfinished matches ».
  const unfinished = /^Round (\d+) has (\d+) unfinished match/.exec(m);
  if (unfinished) return `Le tour ${unfinished[1]} a encore ${countOf(Number(unfinished[2]), 'match', 'matchs')} à décider.`;
  if (m.startsWith('Not authorized') || m.startsWith('Accès refusé') || code === '42501') return NOT_ALLOWED;

  const coded = /^([A-Z][A-Z_]{3,})\s*:\s*([\s\S]*)$/.exec(m);
  if (!coded) {
    // TOURNOI_INCONNU part aussi sans texte.
    return BY_CODE[m] ?? GENERIC_REFUSAL;
  }
  const [, c, text] = coded;
  if (c === 'INSCRIPTIONS_FERMEES') {
    return text.includes('terminé')
      ? 'Le tournoi est terminé : les inscriptions sont closes.'
      : 'Le tournoi a démarré : les inscriptions sont closes.';
  }
  if (BY_CODE[c]) return BY_CODE[c];
  // Code inconnu : le texte de la base, sans le code.
  const t = text.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : GENERIC_REFUSAL;
}

/**
 * Fenêtre « Refaire tout le tableau ? » : la base vide le tableau et en tire un
 * nouveau, et refuse un tableau déjà joué. Plus aucun résultat ni ELO effacé.
 */
export const REGENERATE_BODY = 'Les matchs du tableau seront effacés, puis un nouveau premier tour sera tiré au sort. Les scores envoyés sur les WOD sont conservés. Un tableau où un match est déjà joué ne peut pas être refait : pour corriger un résultat, remets le match à jouer ou choisis le vainqueur.';
