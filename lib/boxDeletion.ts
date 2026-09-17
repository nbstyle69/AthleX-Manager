// ── Supprimer une box : ce qui partirait avec elle ──────────────────────────
//
// Trente-cinq tables référencent `boxes` en `ON DELETE CASCADE`. Un critère de
// vacuité qui n'en regarde que cinq laisserait passer une box qui emporte des
// encaissements comptoir, des invitations ou de l'historique ELO d'athlètes.
// La liste ci-dessous est relevée sur la base de production, pas devinée.
//
// Trois tables n'ont AUCUNE action de suppression (`NO ACTION`, donc RESTRICT) :
// `wod_scores`, `score_comments`, `message_replies`. Elles feraient échouer le
// DELETE sur une violation de contrainte — une erreur `23503` illisible. On les
// compte donc en amont, comme les autres, pour rendre un refus en français.

/** Une table qui part en cascade, avec le nom que l'écran doit afficher. */
export interface BlockingTable {
  /** Table Postgres. */
  table: string;
  /** Colonne portant la référence à la box. */
  column: string;
  /** Au singulier puis au pluriel, pour un décompte lisible. */
  label: [string, string];
  /**
   * `true` quand la FK n'a pas d'action de suppression : ces lignes ne partent
   * pas en cascade, elles BLOQUENT la requête. Elles doivent être comptées
   * avant, sinon Postgres rend un `23503` que personne ne lit.
   */
  restrict?: true;
}

/**
 * Tout ce qui disparaîtrait, dans l'ordre où on veut le lire : ce qui touche
 * les athlètes d'abord, la boutique ensuite, la mécanique en dernier.
 */
export const BLOCKING_TABLES: readonly BlockingTable[] = [
  { table: 'wod_scores', column: 'box_id', label: ['score', 'scores'], restrict: true },
  { table: 'score_comments', column: 'box_id', label: ['commentaire de score', 'commentaires de score'], restrict: true },
  { table: 'message_replies', column: 'box_id', label: ['réponse à un message', 'réponses aux messages'], restrict: true },
  { table: 'box_wods', column: 'box_id', label: ['WOD', 'WODs'] },
  { table: 'wod_completions', column: 'box_id', label: ['séance réalisée', 'séances réalisées'] },
  { table: 'elo_history', column: 'box_id', label: ['ligne d’historique ELO', 'lignes d’historique ELO'] },
  { table: 'box_elo_history', column: 'box_id', label: ['ligne d’ELO de box', 'lignes d’ELO de box'] },
  { table: 'box_elo', column: 'box_id', label: ['classement de box', 'classements de box'] },
  { table: 'tournaments', column: 'box_id', label: ['tournoi', 'tournois'] },
  { table: 'competitions', column: 'box_id', label: ['compétition', 'compétitions'] },
  { table: 'box_members', column: 'box_id', label: ['membre', 'membres'] },
  { table: 'box_invitations', column: 'box_id', label: ['invitation', 'invitations'] },
  { table: 'membership_plans', column: 'box_id', label: ['formule', 'formules'] },
  { table: 'membership_promo_codes', column: 'box_id', label: ['code promo', 'codes promo'] },
  { table: 'membership_cancellation_requests', column: 'box_id', label: ['demande de résiliation', 'demandes de résiliation'] },
  { table: 'box_cash_payments', column: 'box_id', label: ['encaissement comptoir', 'encaissements comptoir'] },
  { table: 'member_class_credits', column: 'box_id', label: ['crédit de séance', 'crédits de séance'] },
  { table: 'class_schedules', column: 'box_id', label: ['créneau', 'créneaux'] },
  { table: 'class_reservations', column: 'box_id', label: ['réservation', 'réservations'] },
  { table: 'schedule_templates', column: 'box_id', label: ['modèle d’horaire', 'modèles d’horaire'] },
  { table: 'box_appointment_slots', column: 'box_id', label: ['créneau de rendez-vous', 'créneaux de rendez-vous'] },
  { table: 'appointment_bookings', column: 'box_id', label: ['rendez-vous', 'rendez-vous'] },
  { table: 'session_followups', column: 'box_id', label: ['suivi de séance', 'suivis de séance'] },
  { table: 'box_prospects', column: 'box_id', label: ['prospect', 'prospects'] },
  { table: 'programs', column: 'box_id', label: ['programme', 'programmes'] },
  { table: 'box_programming', column: 'publisher_box_id', label: ['offre publiée', 'offres publiées'] },
  { table: 'box_programming_subscriptions', column: 'subscriber_box_id', label: ['abonnement Marketplace', 'abonnements Marketplace'] },
  { table: 'box_articles', column: 'box_id', label: ['actualité', 'actualités'] },
  { table: 'box_messages', column: 'box_id', label: ['message', 'messages'] },
  { table: 'messages', column: 'box_id', label: ['message de groupe', 'messages de groupe'] },
  { table: 'message_groups', column: 'box_id', label: ['groupe', 'groupes'] },
  { table: 'box_notifications', column: 'box_id', label: ['notification', 'notifications'] },
  { table: 'box_documents', column: 'box_id', label: ['document', 'documents'] },
  { table: 'events', column: 'box_id', label: ['événement', 'événements'] },
  { table: 'support_tickets', column: 'box_id', label: ['ticket de support', 'tickets de support'] },
  { table: 'box_auto_programming_runs', column: 'box_id', label: ['génération automatique', 'générations automatiques'] },
];

export interface BlockingCount {
  table: string;
  label: string;
  count: number;
  restrict: boolean;
}

/**
 * Les seuls habitants tolérés d'une box « vide » : le gérant lui-même, et une
 * ligne d'abonnement qui n'est rattachée à aucun abonnement Stripe.
 */
export interface EmptinessInput {
  counts: BlockingCount[];
  /** Membres qui ne sont pas le gérant. */
  otherMembers: number;
  /** Abonnements réellement rattachés à Stripe (essai local non compris). */
  stripeSubscriptions: number;
}

export interface Emptiness {
  empty: boolean;
  /** Postes non vides, du plus gros au plus petit, déjà formulés. */
  blockers: string[];
  /** `true` si au moins un poste bloque par contrainte, pas par cascade. */
  hasRestrict: boolean;
}

export function pluralLabel(t: BlockingTable, n: number): string {
  return `${n} ${n > 1 ? t.label[1] : t.label[0]}`;
}

/**
 * Une box est supprimable quand rien ne partirait avec elle.
 *
 * Un abonnement en essai sans identifiant Stripe ne bloque pas : c'est la ligne
 * qu'une création de box pose d'office, et l'exiger vide rendrait toute box
 * fantôme insupprimable — précisément le cas qu'on veut traiter.
 */
export function assessEmptiness(input: EmptinessInput): Emptiness {
  const blockers: string[] = [];
  let hasRestrict = false;

  for (const c of [...input.counts].sort((a, b) => b.count - a.count)) {
    if (c.count <= 0) continue;
    // `box_members` est compté à part : la ligne du gérant ne bloque pas.
    if (c.table === 'box_members') continue;
    blockers.push(c.label);
    if (c.restrict) hasRestrict = true;
  }

  if (input.otherMembers > 0) {
    blockers.push(`${input.otherMembers} membre${input.otherMembers > 1 ? 's' : ''} autre${input.otherMembers > 1 ? 's' : ''} que le gérant`);
  }
  if (input.stripeSubscriptions > 0) {
    blockers.push(`${input.stripeSubscriptions} abonnement${input.stripeSubscriptions > 1 ? 's' : ''} Stripe`);
  }

  return { empty: blockers.length === 0, blockers, hasRestrict };
}
