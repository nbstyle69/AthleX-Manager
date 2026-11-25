/**
 * Invitation box → box à une offre (nbstyle69/AthleX-Manager#461, PR 2 : Mes offres).
 * Logique d'affichage sans DOM, testée sous Jest : badges, dates, actions,
 * message serveur, prix. Les écritures passent toutes par les fonctions SQL
 * (send / cancel / revoke) ; rien ici n'écrit.
 */
import { parisDate } from '@/lib/datetime';

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
