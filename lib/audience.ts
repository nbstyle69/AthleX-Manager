/**
 * Visibilité explicite d'un WOD (`box_wods.audience`) et abonnements
 * Marketplace : vocabulaire, palette et calculs partagés par le Whiteboard,
 * le formulaire WOD et la page Marketplace.
 *
 * Le serveur (migration `20261209`) est la frontière : la colonne porte un
 * CHECK, `apply_program_week` exige `p_audience`, et les triggers repassent un
 * WOD en `'groups'` / `'all'` selon ses lignes `wod_group_access`. Ce module
 * ne fait que nommer et compter.
 */

export type Audience = 'all' | 'groups' | 'none';

export const AUDIENCES: readonly Audience[] = ['all', 'groups', 'none'];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Toute la box',
  groups: 'Ces groupes',
  none: 'Personne encore',
};

export function isAudience(v: unknown): v is Audience {
  return v === 'all' || v === 'groups' || v === 'none';
}

/** Badge « Visible par … » d'une carte, à partir de la colonne et des groupes nommés. */
export function audienceBadgeLabel(audience: Audience, groupNames: string[]): string {
  if (audience === 'all') return 'Visible par toute la box';
  if (audience === 'none') return 'Visible par personne';
  return groupNames.length > 0 ? `Visible par ${groupNames.join(', ')}` : 'Visible par personne (aucun groupe)';
}

/** Palette des abonnements (clés stables en base, rendu ici). Pas d'émeraude ni de rouge : déjà pris. */
export type SubscriptionColor = 'sky' | 'violet' | 'amber' | 'rose' | 'teal' | 'orange' | 'lime' | 'fuchsia';

export const SUBSCRIPTION_COLORS: readonly SubscriptionColor[] = [
  'sky', 'violet', 'amber', 'rose', 'teal', 'orange', 'lime', 'fuchsia',
];

export const SUBSCRIPTION_COLOR_HEX: Record<SubscriptionColor, string> = {
  sky: '#38BDF8',
  violet: '#8B5CF6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  teal: '#14B8A6',
  orange: '#F97316',
  lime: '#84CC16',
  fuchsia: '#D946EF',
};

export function subscriptionColorHex(color: string | null | undefined): string {
  return SUBSCRIPTION_COLOR_HEX[color as SubscriptionColor] ?? SUBSCRIPTION_COLOR_HEX.sky;
}

/** Lundi (ISO) de la semaine contenant la date locale donnée. */
export function mondayOfISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toLocalISO(d);
}

/** Lundi suivant strictement une date locale (un lundi donne le lundi d'après). */
export function nextMondayISO(fromISO: string): string {
  const d = new Date(mondayOfISO(fromISO) + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return toLocalISO(d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date locale. */
export function isoDow(iso: string): number {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow === 0 ? 7 : dow;
}

/**
 * Numéro de la semaine d'offre qui se posera sur `targetMonday`, selon l'ancre
 * de l'abonnement : `((lundi_cible − week_anchor) / 7 mod weeks_count) + 1`.
 * Même formule que `materialize_box_programming` côté serveur.
 */
export function weekNumberFor(weekAnchor: string, targetMonday: string, weeksCount: number): number {
  const n = Math.max(1, weeksCount);
  const a = new Date(weekAnchor + 'T00:00:00').getTime();
  const t = new Date(targetMonday + 'T00:00:00').getTime();
  const weeks = Math.round((t - a) / (7 * 24 * 3600 * 1000));
  return ((weeks % n) + n) % n + 1;
}

export interface RecapInput {
  audience: Audience | '';
  groupNames: string[];
  programNames: string[];
  /** Offres cochées avec leur semaine cible. */
  offers: { title: string; week: number }[];
}

/**
 * Ligne de récapitulatif du formulaire WOD, mise à jour en direct :
 * « Visible par K+ Perf · Prog Muscu · copié dans ATHX BLOC 2, semaine 1 ».
 * Retourne `null` tant que la visibilité n'est pas choisie.
 */
export function recapLine(i: RecapInput): string | null {
  if (i.audience === '') return null;
  const parts: string[] = [];
  parts.push(audienceBadgeLabel(i.audience, i.groupNames));
  if (i.programNames.length > 0) parts.push(i.programNames.join(', '));
  if (i.offers.length > 0) {
    parts.push(`copié dans ${i.offers.map(o => `${o.title}, semaine ${o.week}`).join(' ; ')}`);
  }
  return parts.join(' · ');
}

/** Clé localStorage : dernier numéro de semaine choisi pour une offre. */
export function offerWeekStorageKey(programmingId: string): string {
  return `athlex:offerWeek:${programmingId}`;
}
