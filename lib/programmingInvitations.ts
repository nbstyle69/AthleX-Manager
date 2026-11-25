/**
 * Invitation box → box à une offre (nbstyle69/AthleX-Manager#461, PR 2 : Mes offres).
 * Logique d'affichage sans DOM, testée sous Jest : badges, dates, actions,
 * message serveur, prix. Les écritures passent toutes par les fonctions SQL
 * (send / cancel / revoke) ; rien ici n'écrit.
 */
import { parisDate } from '@/lib/datetime';
import { disciplineLabel } from '@/lib/disciplines';

export type Visibility = 'catalogue' | 'invitation';
export type InvitationPricing = 'offered' | 'offer_price';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'info';

/** Ligne de `list_programming_invitations_sent`. */
export interface SentInvitation {
  invitation_id: string;
  invited_box_id: string;
  invited_box_name: string | null;
  pricing: InvitationPricing;
  status: InvitationStatus;
  message: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  subscription_id: string | null;
  revoked_by_publisher_at: string | null;
  access_ends_at: string | null;
}

export interface OfferPrice { billing: 'free' | 'one_time' | 'monthly'; price_cents: number }

/** « 29€/mois », « 19€ », « 19,90€ » ou « Gratuit ». */
export function formatOfferPrice(o: OfferPrice): string {
  if (o.billing === 'free') return 'Gratuit';
  const c = o.price_cents;
  const euros = c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',');
  return `${euros}€${o.billing === 'monthly' ? '/mois' : ''}`;
}

/** Badge d'une offre dans Mes offres. */
export function offerBadge(o: { is_published: boolean; visibility?: Visibility | null }):
  { label: string; variant: BadgeVariant; kind: 'invitation' | 'published' | 'draft' } {
  if (!o.is_published) return { label: 'Brouillon', variant: 'neutral', kind: 'draft' };
  if (o.visibility === 'invitation') return { label: 'Sur invitation', variant: 'info', kind: 'invitation' };
  return { label: 'Publiée', variant: 'success', kind: 'published' };
}

export const INVITATION_ONLY_DETAIL = 'invisible du catalogue, réservée aux box invitées';

export function pricingLabel(p: InvitationPricing): string {
  return p === 'offered' ? 'Offerte' : 'Au prix de l’offre';
}

const STATUS_BADGE: Record<InvitationStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'En attente', variant: 'warning' },
  accepted: { label: 'Acceptée', variant: 'success' },
  declined: { label: 'Refusée', variant: 'neutral' },
  expired: { label: 'Expirée', variant: 'neutral' },
  cancelled: { label: 'Annulée', variant: 'neutral' },
};
export function statusBadge(s: InvitationStatus): { label: string; variant: BadgeVariant } {
  return STATUS_BADGE[s];
}

/** « 8 décembre » (année en cours, heure de Paris) ou « 8 décembre 2027 ». */
export function shortParisDate(iso: string, now: Date = new Date()): string {
  const sameYear = parisDate(iso, { year: 'numeric' }) === parisDate(now.toISOString(), { year: 'numeric' });
  return parisDate(iso, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « lundi 30 novembre » : le jour de la semaine en tête. */
export function weekdayParisDate(iso: string, now: Date = new Date()): string {
  const weekday = parisDate(iso, { weekday: 'long' });
  return `${weekday} ${shortParisDate(iso, now)}`;
}

/** Accès « Offert » accepté dont le retrait est déjà posé. */
export function isRevoked(i: SentInvitation): boolean {
  return i.status === 'accepted' && i.revoked_by_publisher_at !== null;
}

/** Ligne de date d'une invitation. */
export function invitationDateLine(i: SentInvitation, now: Date = new Date()): string {
  if (isRevoked(i) && i.access_ends_at) return `Accès retiré · fin le ${weekdayParisDate(i.access_ends_at, now)}`;
  switch (i.status) {
    case 'pending': return `expire le ${shortParisDate(i.expires_at, now)}`;
    case 'accepted':
    case 'declined': return `le ${shortParisDate(i.responded_at ?? i.created_at, now)}`;
    case 'expired': return `le ${shortParisDate(i.expires_at, now)}`;
    case 'cancelled': return `le ${shortParisDate(i.created_at, now)}`;
  }
}

export type InvitationAction = 'cancel' | 'resend' | 'revoke' | null;

/**
 * Action d'une ligne. « Retirer » seulement sur un accès « Offert » accepté,
 * encore lié à son abonnement et pas encore retiré (sinon le serveur refuse).
 */
export function invitationAction(i: SentInvitation): InvitationAction {
  switch (i.status) {
    case 'pending': return 'cancel';
    case 'declined':
    case 'expired':
    case 'cancelled': return 'resend';
    case 'accepted':
      return i.pricing === 'offered' && i.subscription_id !== null && i.revoked_by_publisher_at === null
        ? 'revoke' : null;
  }
}

/** Le bloc de suivi s'ouvre de lui-même quand une invitation attend. */
export function hasPending(list: SentInvitation[]): boolean {
  return list.some((i) => i.status === 'pending');
}

/**
 * Message serveur sans son code technique : « INVITATION_LIMITE : 20 … » →
 * « 20 … ». Seul un code en capitales est retiré (« Accès refusé : … » reste
 * entier) ; la première lettre passe en capitale.
 */
export function serverMessage(raw: string | null | undefined): string {
  const msg = (raw ?? '').trim();
  const m = /^[A-Z][A-Z0-9_]*\s*:\s*([\s\S]+)$/.exec(msg);
  const text = m ? m[1].trim() : msg;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 300;
export const MESSAGE_MAX = 280;

/** La recherche ne part qu'à partir de 2 caractères utiles. */
export function searchQuery(q: string): string | null {
  const t = q.trim();
  return t.length >= SEARCH_MIN_CHARS ? t : null;
}

/** Tarifs proposés : une offre gratuite ne s'invite qu'en « Offerte » (le serveur refuse l'autre). */
export function pricingChoices(o: OfferPrice): InvitationPricing[] {
  return o.billing === 'free' ? ['offered'] : ['offered', 'offer_price'];
}

/* ───────────── PR 3 : côté box invitée (Catalogue, paiement) ───────────── */

export const LEVEL_LABEL: Record<string, string> = {
  all: 'Tous niveaux', beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé',
};

/** Ligne de `list_my_programming_invitations` (invitations en attente et non échues). */
export interface ReceivedInvitation extends OfferPrice {
  invitation_id: string;
  programming_id: string;
  title: string;
  description: string | null;
  discipline: string | null;
  level: string | null;
  days_per_week: number | null;
  weeks_count: number;
  currency: string;
  publisher_box_id: string;
  publisher_box_name: string | null;
  goal: string | null;
  target_audience: string | null;
  equipment: string | null;
  wods_total: number;
  wods_per_week: number[] | null;
  preview_week1: { day: number; titles: string[] }[] | null;
  pricing: InvitationPricing;
  message: string | null;
  created_at: string;
  expires_at: string;
}

export const publisherName = (i: { publisher_box_name: string | null }) => i.publisher_box_name ?? 'Une box';

/** « Box Bravo t'invite à « Force Hiver 6 sem » ». */
export function receivedTitle(i: ReceivedInvitation): string {
  return `${publisherName(i)} t’invite à « ${i.title} »`;
}

/**
 * « Haltéro · Intermédiaire · 6 sem · reçue le 24 novembre · expire le 8 décembre ».
 * « sur invitation » n'y figure pas : la fonction ne rend pas la visibilité.
 */
export function receivedLine(i: ReceivedInvitation, now: Date = new Date()): string {
  return [
    i.discipline ? disciplineLabel(i.discipline) : null,
    i.level ? LEVEL_LABEL[i.level] ?? i.level : null,
    `${i.weeks_count} sem`,
    `reçue le ${shortParisDate(i.created_at, now)}`,
    `expire le ${shortParisDate(i.expires_at, now)}`,
  ].filter(Boolean).join(' · ');
}

/** Badge de la carte : « Offerte » (succès) ou le prix de l'offre (neutre). */
export function receivedBadge(i: ReceivedInvitation): { label: string; variant: BadgeVariant } {
  return i.pricing === 'offered' ? { label: 'Offerte', variant: 'success' } : { label: formatOfferPrice(i), variant: 'neutral' };
}

export function acceptLabel(p: InvitationPricing): string {
  return p === 'offered' ? 'Accepter' : 'Accepter et payer';
}

/** Ligne « Tarif » de la fenêtre Accepter. */
export function acceptTariff(i: ReceivedInvitation): string {
  return i.pricing === 'offered' ? `Offerte par ${publisherName(i)} — gratuit, sans date de fin` : formatOfferPrice(i);
}

/** Ligne « Contenu » : « 30 WOD · 6 semaines ». */
export function contentLine(i: { wods_total: number; weeks_count: number }): string {
  return `${i.wods_total} WOD · ${i.weeks_count} semaine${i.weeks_count > 1 ? 's' : ''}`;
}

/** Élément de la confirmation Refuser : « Force Hiver 6 sem · Box Bravo · Offerte ». */
export function declineElement(i: ReceivedInvitation): string {
  return `${i.title} · ${publisherName(i)} · ${i.pricing === 'offered' ? 'Offerte' : formatOfferPrice(i)}`;
}

/**
 * Lien de l'e-mail `/programming?invitation={id}` : `null` sans paramètre,
 * 'found' si l'invitation est dans la liste de la box active, sinon 'invalid'
 * (échue, annulée, déjà traitée, ou adressée à une autre box).
 */
export function invitationLinkState(param: string | null, list: { invitation_id: string }[]): 'found' | 'invalid' | null {
  if (!param) return null;
  return list.some((i) => i.invitation_id === param) ? 'found' : 'invalid';
}

/* ── Route de paiement : contrôles purs, appelés par create-programming-checkout ── */

export interface InvitationRow {
  id: string;
  programming_id: string;
  invited_box_id: string;
  pricing: string;
  status: string;
  expires_at: string;
}

export const OFFER_RESERVED_MESSAGE = 'Cette offre est réservée aux box invitées.';
export const INVITATION_TOO_SOON_MESSAGE = 'Cette invitation expire trop tôt pour payer : demande-lui de la renvoyer.';

/** Une invitation qui ouvre le paiement : en attente, non échue, au prix de l'offre, pour cette offre et cette box. */
export function checkCheckoutInvitation(
  inv: InvitationRow | null, programmingId: string, subscriberBoxId: string, now: Date = new Date(),
): string | null {
  if (!inv) return 'Invitation introuvable.';
  if (inv.programming_id !== programmingId || inv.invited_box_id !== subscriberBoxId) {
    return 'Cette invitation ne concerne pas cette offre ou cette box.';
  }
  if (inv.status !== 'pending') return 'Cette invitation n’attend plus de réponse.';
  if (new Date(inv.expires_at).getTime() <= now.getTime()) return 'Cette invitation a expiré.';
  if (inv.pricing !== 'offer_price') return 'Cette invitation est offerte : elle s’accepte sans paiement.';
  return null;
}

const MIN = 60_000;
/**
 * `expires_at` de la session Checkout (secondes) : 5 min avant l'échéance de
 * l'invitation, et au plus 24 h (Stripe accepte 30 min à 24 h). Une invitation
 * qui expire dans moins de 35 min est refusée.
 */
export function checkoutExpiresAt(invitationExpiresAt: string, now: Date = new Date()):
  { expiresAt: number } | { error: string } {
  const end = new Date(invitationExpiresAt).getTime() - 5 * MIN;
  if (end - now.getTime() < 30 * MIN) return { error: INVITATION_TOO_SOON_MESSAGE };
  return { expiresAt: Math.floor(Math.min(end, now.getTime() + 24 * 60 * MIN) / 1000) };
}
