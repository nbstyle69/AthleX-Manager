import {
  formatOfferPrice, offerBadge, pricingLabel, statusBadge, shortParisDate, weekdayParisDate,
  invitationDateLine, invitationAction, hasPending, serverMessage, searchQuery, pricingChoices,
  type SentInvitation,
} from '@/lib/programmingInvitations';

const NOW = new Date('2026-11-25T14:00:00Z');

function inv(p: Partial<SentInvitation>): SentInvitation {
  return {
    invitation_id: 'i', invited_box_id: 'b', invited_box_name: 'Box Delta', pricing: 'offered',
    status: 'pending', message: null, created_at: '2026-11-24T10:00:00Z', expires_at: '2026-12-08T10:00:00Z',
    responded_at: null, subscription_id: null, revoked_by_publisher_at: null, access_ends_at: null, ...p,
  };
}

describe('prix', () => {
  it('mensuel, unique, centimes, gratuit', () => {
    expect(formatOfferPrice({ billing: 'monthly', price_cents: 2900 })).toBe('29€/mois');
    expect(formatOfferPrice({ billing: 'one_time', price_cents: 1900 })).toBe('19€');
    expect(formatOfferPrice({ billing: 'one_time', price_cents: 1990 })).toBe('19,90€');
    expect(formatOfferPrice({ billing: 'free', price_cents: 0 })).toBe('Gratuit');
  });
});

describe('badge de l’offre', () => {
  it('publiée sur invitation → « Sur invitation » info', () => {
    expect(offerBadge({ is_published: true, visibility: 'invitation' })).toEqual({ label: 'Sur invitation', variant: 'info', kind: 'invitation' });
  });
  it('publiée catalogue (ou sans valeur) → « Publiée »', () => {
    expect(offerBadge({ is_published: true, visibility: 'catalogue' }).label).toBe('Publiée');
    expect(offerBadge({ is_published: true }).label).toBe('Publiée');
  });
  it('brouillon reste « Brouillon », même sur invitation', () => {
    expect(offerBadge({ is_published: false, visibility: 'invitation' }).label).toBe('Brouillon');
  });
});

describe('libellés', () => {
  it('tarifs', () => {
    expect(pricingLabel('offered')).toBe('Offerte');
    expect(pricingLabel('offer_price')).toBe('Au prix de l’offre');
  });
  it('statuts et variantes', () => {
    expect(statusBadge('pending')).toEqual({ label: 'En attente', variant: 'warning' });
    expect(statusBadge('accepted')).toEqual({ label: 'Acceptée', variant: 'success' });
    expect(statusBadge('declined')).toEqual({ label: 'Refusée', variant: 'neutral' });
    expect(statusBadge('expired')).toEqual({ label: 'Expirée', variant: 'neutral' });
    expect(statusBadge('cancelled')).toEqual({ label: 'Annulée', variant: 'neutral' });
  });
});

describe('dates en heure de Paris', () => {
  it('sans l’année l’année en cours, avec sinon', () => {
    expect(shortParisDate('2026-12-08T10:00:00Z', NOW)).toBe('8 décembre');
    expect(shortParisDate('2027-01-04T10:00:00Z', NOW)).toBe('4 janvier 2027');
  });
  it('lit le jour à Paris (23 h 30 UTC le 30 → 1er à Paris)', () => {
    expect(shortParisDate('2026-11-30T23:30:00Z', NOW)).toBe('1 décembre');
  });
  it('lundi minuit à Paris (dimanche 23:00 UTC) → lundi', () => {
    expect(weekdayParisDate('2026-11-29T23:00:00Z', NOW)).toBe('lundi 30 novembre');
  });
});

describe('ligne de date', () => {
  it('en attente → expiration', () => {
    expect(invitationDateLine(inv({}), NOW)).toBe('expire le 8 décembre');
  });
  it('acceptée et refusée → réponse', () => {
    expect(invitationDateLine(inv({ status: 'accepted', responded_at: '2026-11-20T09:00:00Z' }), NOW)).toBe('le 20 novembre');
    expect(invitationDateLine(inv({ status: 'declined', responded_at: '2026-11-18T09:00:00Z' }), NOW)).toBe('le 18 novembre');
  });
  it('expirée → échéance ; annulée → création', () => {
    expect(invitationDateLine(inv({ status: 'expired', expires_at: '2026-11-10T09:00:00Z' }), NOW)).toBe('le 10 novembre');
    expect(invitationDateLine(inv({ status: 'cancelled', created_at: '2026-11-02T09:00:00Z' }), NOW)).toBe('le 2 novembre');
  });
  it('accès retiré → fin lue dans access_ends_at', () => {
    expect(invitationDateLine(inv({
      status: 'accepted', responded_at: '2026-11-12T09:00:00Z', subscription_id: 's',
      revoked_by_publisher_at: '2026-11-25T10:00:00Z', access_ends_at: '2026-11-29T23:00:00Z',
    }), NOW)).toBe('Accès retiré · fin le lundi 30 novembre');
  });
});

describe('actions', () => {
  it('en attente → annuler', () => expect(invitationAction(inv({}))).toBe('cancel'));
  it('refusée, expirée, annulée → renvoyer', () => {
    for (const status of ['declined', 'expired', 'cancelled'] as const) expect(invitationAction(inv({ status }))).toBe('resend');
  });
  it('acceptée offerte, abonnement lié, non retirée → retirer', () => {
    expect(invitationAction(inv({ status: 'accepted', subscription_id: 's' }))).toBe('revoke');
  });
  it('acceptée au prix de l’offre → rien', () => {
    expect(invitationAction(inv({ status: 'accepted', pricing: 'offer_price', subscription_id: 's' }))).toBeNull();
  });
  it('acceptée sans abonnement (désabonnée) → rien', () => {
    expect(invitationAction(inv({ status: 'accepted', subscription_id: null }))).toBeNull();
  });
  it('accès déjà retiré → rien', () => {
    expect(invitationAction(inv({ status: 'accepted', subscription_id: 's', revoked_by_publisher_at: '2026-11-25T10:00:00Z' }))).toBeNull();
  });
  it('bloc ouvert seulement avec une invitation en attente', () => {
    expect(hasPending([inv({ status: 'accepted' }), inv({})])).toBe(true);
    expect(hasPending([inv({ status: 'accepted' }), inv({ status: 'expired' })])).toBe(false);
  });
});

describe('message serveur', () => {
  it('retire le code et met une capitale', () => {
    expect(serverMessage('INVITATION_EN_ATTENTE : une invitation à cette offre attend déjà la réponse de cette box'))
      .toBe('Une invitation à cette offre attend déjà la réponse de cette box');
  });
  it('message sans « : » tel quel', () => {
    expect(serverMessage('Programmation introuvable')).toBe('Programmation introuvable');
  });
  it('« Accès refusé : … » garde son début (pas un code)', () => {
    expect(serverMessage('Accès refusé : gérant requis')).toBe('Accès refusé : gérant requis');
  });
  it('garde un « : » du texte', () => {
    expect(serverMessage('ACCES_NON_OFFERT : seul un accès « Offert » : retiré')).toBe('Seul un accès « Offert » : retiré');
  });
  it('vide', () => expect(serverMessage(null)).toBe(''));
});

describe('recherche et tarifs', () => {
  it('2 caractères utiles au moins', () => {
    expect(searchQuery(' d ')).toBeNull();
    expect(searchQuery(' De ')).toBe('De');
  });
  it('offre gratuite : « Offerte » seulement', () => {
    expect(pricingChoices({ billing: 'free', price_cents: 0 })).toEqual(['offered']);
    expect(pricingChoices({ billing: 'monthly', price_cents: 2900 })).toEqual(['offered', 'offer_price']);
  });
});
