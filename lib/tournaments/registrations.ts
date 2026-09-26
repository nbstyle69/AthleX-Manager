/**
 * « Inscriptions ouvertes pendant le tournoi » (athlex-app PR 10, migration
 * `20270125`) : la base démarre seule un tournoi ouvert à sa date (00:00 heure
 * de Paris) ou à l'ouverture de son premier WOD ; la case dit si les
 * inscriptions restent ouvertes ensuite, selon le format. La règle est en
 * base : le Manager écrit la case et l'explique, sans rien recalculer.
 */

export const REGISTRATIONS_LABEL = 'Inscriptions ouvertes pendant le tournoi';

export const START_DATE_HINT = 'Le tournoi démarre automatiquement ce jour-là à 00:00 (heure de Paris), ou à l’ouverture du premier WOD si elle vient avant.';

/** Texte sous la case, selon le format du tournoi. */
export function registrationsHint(format: string): string {
  if (format === 'bracket' || format === 'swiss') return 'Les inscriptions restent ouvertes jusqu’au tirage du premier tour.';
  if (format === 'league_div') return 'Les nouveaux inscrits entrent dans la division la plus basse, tant qu’elle a de la place. Ensuite, les inscriptions sont refusées.';
  return 'Les athlètes peuvent s’inscrire après le démarrage. Les WOD déjà fermés le restent pour eux : 0 point.';
}

/** Fenêtre « Démarrer le tournoi ? » : texte et bouton selon la case. */
export function startDialogTexts(registrationsOpen: boolean): { body: string; confirmLabel: string } {
  return registrationsOpen
    ? {
        body: 'Le tournoi démarre. Les inscriptions restent ouvertes selon son format (voir la case « Inscriptions ouvertes pendant le tournoi »). Les inscrits recevront l’annonce du démarrage dès qu’un WOD sera ouvert.',
        confirmLabel: 'Démarrer le tournoi',
      }
    : {
        body: 'Les inscriptions seront fermées : plus personne ne pourra s’inscrire. Les inscrits recevront l’annonce du démarrage dès qu’un WOD sera ouvert. Tu ne pourras pas rouvrir les inscriptions depuis cet écran.',
        confirmLabel: 'Démarrer et fermer les inscriptions',
      };
}

/** Fenêtre « Ouvrir maintenant » d'un WOD programmé. */
export function openNowBody(registrationsOpen: boolean, when: string): string {
  return registrationsOpen
    ? `Ouvrir maintenant : le WOD devient visible tout de suite et les scores sont acceptés. Si le tournoi n’a pas encore démarré, il démarre ; les inscriptions restent ouvertes selon son format. Garder la date : il s’ouvrira le ${when}.`
    // Case décochée : le texte d'avant, inchangé.
    : `Ouvrir maintenant : le WOD devient visible tout de suite et les scores sont acceptés. Si le tournoi n’a pas encore démarré, il démarre et les inscriptions se ferment. Garder la date : il s’ouvrira le ${when}, et les inscrits sont prévenus de cette date.`;
}
