import {
  receivedTitle, receivedLine, receivedBadge, acceptLabel, acceptTariff, contentLine, declineElement,
  invitationLinkState, checkCheckoutInvitation, checkoutExpiresAt, INVITATION_TOO_SOON_MESSAGE,
  type ReceivedInvitation, type InvitationRow,
} from '@/lib/programmingInvitations';

const NOW = new Date('2026-11-25T14:00:00Z');

function rec(p: Partial<ReceivedInvitation> = {}): ReceivedInvitation {
  return {
    invitation_id: 'i1', programming_id: 'p1', title: 'Force Hiver 6 sem', description: null, discipline: 'haltero',
    level: 'intermediate', days_per_week: 5, weeks_count: 6, billing: 'monthly', price_cents: 3900, currency: 'eur',
    publisher_box_id: 'b9', publisher_box_name: 'Box Bravo', goal: null, target_audience: null, equipment: null,
    wods_total: 30, wods_per_week: null, preview_week1: null, pricing: 'offered', message: null,
    created_at: '2026-11-24T09:00:00Z', expires_at: '2026-12-08T09:00:00Z', ...p,
  };
}

describe('carte d’une invitation reçue', () => {
  it('titre', () => expect(receivedTitle(rec())).toBe('Box Bravo t’invite à « Force Hiver 6 sem »'));
  it('titre sans nom de box', () => expect(receivedTitle(rec({ publisher_box_name: null }))).toBe('Une box t’invite à « Force Hiver 6 sem »'));
  it('ligne : discipline, niveau, semaines, reçue, expire (heure de Paris)', () => {
    expect(receivedLine(rec(), NOW)).toBe('Haltéro · Intermédiaire · 6 sem · reçue le 24 novembre · expire le 8 décembre');
  });
  it('ligne sans discipline ni niveau', () => {
    expect(receivedLine(rec({ discipline: null, level: null }), NOW)).toBe('6 sem · reçue le 24 novembre · expire le 8 décembre');
  });
  it('badge : Offerte (succès) ou prix (neutre)', () => {
    expect(receivedBadge(rec())).toEqual({ label: 'Offerte', variant: 'success' });
    expect(receivedBadge(rec({ pricing: 'offer_price' }))).toEqual({ label: '39€/mois', variant: 'neutral' });
  });
  it('bouton', () => {
    expect(acceptLabel('offered')).toBe('Accepter');
    expect(acceptLabel('offer_price')).toBe('Accepter et payer');
  });
});

describe('fenêtre Accepter et confirmation Refuser', () => {
  it('tarif', () => {
    expect(acceptTariff(rec())).toBe('Offerte par Box Bravo — gratuit, sans date de fin');
    expect(acceptTariff(rec({ pricing: 'offer_price' }))).toBe('39€/mois');
  });
  it('contenu, singulier et pluriel', () => {
    expect(contentLine({ wods_total: 30, weeks_count: 6 })).toBe('30 WOD · 6 semaines');
    expect(contentLine({ wods_total: 4, weeks_count: 1 })).toBe('4 WOD · 1 semaine');
  });
  it('élément de Refuser', () => {
    expect(declineElement(rec())).toBe('Force Hiver 6 sem · Box Bravo · Offerte');
    expect(declineElement(rec({ pricing: 'offer_price' }))).toBe('Force Hiver 6 sem · Box Bravo · 39€/mois');
  });
});

describe('lien ?invitation=', () => {
  const list = [{ invitation_id: 'i1' }];
  it('sans paramètre : rien', () => expect(invitationLinkState(null, list)).toBeNull());
  it('dans la liste : valable', () => expect(invitationLinkState('i1', list)).toBe('found'));
  it('absente (échue, annulée, autre box) : plus valable', () => expect(invitationLinkState('i2', list)).toBe('invalid'));
});

describe('route de paiement : contrôle de l’invitation', () => {
  const inv = (p: Partial<InvitationRow> = {}): InvitationRow => ({
    id: 'i1', programming_id: 'p1', invited_box_id: 'b1', pricing: 'offer_price', status: 'pending',
    expires_at: '2026-12-08T09:00:00Z', ...p,
  });
  it('valable', () => expect(checkCheckoutInvitation(inv(), 'p1', 'b1', NOW)).toBeNull());
  it('introuvable', () => expect(checkCheckoutInvitation(null, 'p1', 'b1', NOW)).toBe('Invitation introuvable.'));
  it('autre offre', () => expect(checkCheckoutInvitation(inv({ programming_id: 'p2' }), 'p1', 'b1', NOW)).toMatch(/ne concerne pas/));
  it('autre box', () => expect(checkCheckoutInvitation(inv({ invited_box_id: 'b2' }), 'p1', 'b1', NOW)).toMatch(/ne concerne pas/));
  it('plus en attente', () => expect(checkCheckoutInvitation(inv({ status: 'declined' }), 'p1', 'b1', NOW)).toMatch(/n’attend plus/));
  it('expirée (statut pas encore passé par la tâche)', () => {
    expect(checkCheckoutInvitation(inv({ expires_at: '2026-11-25T13:59:59Z' }), 'p1', 'b1', NOW)).toBe('Cette invitation a expiré.');
  });
  it('échéance exactement maintenant : expirée', () => {
    expect(checkCheckoutInvitation(inv({ expires_at: NOW.toISOString() }), 'p1', 'b1', NOW)).toBe('Cette invitation a expiré.');
  });
  it('offerte : pas de paiement', () => expect(checkCheckoutInvitation(inv({ pricing: 'offered' }), 'p1', 'b1', NOW)).toMatch(/sans paiement/));
});

describe('expiration de la session Checkout', () => {
  const at = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();
  it('invitation lointaine : 24 h au plus', () => {
    expect(checkoutExpiresAt(at(14 * 24 * 60), NOW)).toEqual({ expiresAt: NOW.getTime() / 1000 + 24 * 3600 });
  });
  it('échéance dans 10 h : 5 min avant', () => {
    expect(checkoutExpiresAt(at(600), NOW)).toEqual({ expiresAt: NOW.getTime() / 1000 + 595 * 60 });
  });
  it('35 min pile : accepté (session de 30 min)', () => {
    expect(checkoutExpiresAt(at(35), NOW)).toEqual({ expiresAt: NOW.getTime() / 1000 + 30 * 60 });
  });
  it('moins de 35 min : refusé', () => {
    expect(checkoutExpiresAt(at(34.9), NOW)).toEqual({ error: INVITATION_TOO_SOON_MESSAGE });
  });
  it('24 h 05 pile : 24 h', () => {
    expect(checkoutExpiresAt(at(24 * 60 + 5), NOW)).toEqual({ expiresAt: NOW.getTime() / 1000 + 24 * 3600 });
  });
});
