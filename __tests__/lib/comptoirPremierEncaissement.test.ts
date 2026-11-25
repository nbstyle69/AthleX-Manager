// #463 — membre actif avec formule payante, jamais encaissé : il entre dans le
// bloc « À encaisser » d'Abonnés et porte « Encaissement reçu » dans Membres.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  cashPaymentError, counterBlocks, firstPaymentLine, needsFirstCashPayment, type CounterAccessMember,
} from '@/lib/comptoir/counter';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const NOW = new Date('2026-10-13T10:00:00Z');

// Le cas de l'issue : formule posée depuis Membres, aucun paiement.
const cas = (o: Partial<CounterAccessMember> = {}): CounterAccessMember => ({
  box_member_id: 'bm', member_id: 'm', status: 'active', joined_at: '2026-09-01T00:00:00Z',
  plan_id: 'p49', price_cents: 4900, subscription_status: null, payment_method_type: null,
  has_stripe_subscription: false, cash_access_until: null, has_counter_period: false, last_notice: null,
  pending_invitation: null, ...o,
});

describe('needsFirstCashPayment', () => {
  it('vrai : actif, formule à prix > 0, sans statut d’abonnement ni Stripe', () => {
    expect(needsFirstCashPayment(cas())).toBe(true);
  });
  it.each<[string, Partial<CounterAccessMember>]>([
    ['abonnement Stripe', { has_stripe_subscription: true }],
    ['paiement en ligne en attente', { subscription_status: 'pending_payment' }],
    ['sans formule', { plan_id: null, price_cents: null }],
    ['sans formule, prix résiduel', { plan_id: null, price_cents: 4900 }],
    ['formule à 0 €', { price_cents: 0 }],
    ['formule sans prix', { price_cents: null }],
    ['banni', { status: 'banned' }],
    ['inactif', { status: 'inactive' }],
    ['déjà encaissé', { subscription_status: 'active', payment_method_type: 'cash', cash_access_until: '2026-11-12' }],
    ['invité en pending_cash (autre cas du bloc)', { status: 'inactive', subscription_status: 'pending_cash' }],
  ])('faux : %s', (_, o) => {
    expect(needsFirstCashPayment(cas(o))).toBe(false);
  });
});

describe('counterBlocks : bloc « À encaisser »', () => {
  const ms = [
    cas({ box_member_id: 'nouveau', joined_at: '2026-10-05T00:00:00Z' }),
    cas({ box_member_id: 'invite', status: 'inactive', subscription_status: 'pending_cash', joined_at: '2026-10-01T00:00:00Z' }),
    cas({ box_member_id: 'stripe', has_stripe_subscription: true }),
    cas({ box_member_id: 'attente', subscription_status: 'pending_payment' }),
    cas({ box_member_id: 'gratuit', price_cents: 0 }),
    cas({ box_member_id: 'paye', subscription_status: 'active', cash_access_until: '2026-12-31' }),
  ];
  it('garde le cas pending_cash et ajoute le nouveau cas, triés par arrivée', () => {
    expect(counterBlocks(ms, NOW).toCollect.map((m) => m.box_member_id)).toEqual(['invite', 'nouveau']);
  });
  it('le nouveau cas n’entre pas dans « Fin d’accès proche »', () => {
    expect(counterBlocks(ms, NOW).ending.map((m) => m.box_member_id)).not.toContain('nouveau');
  });
  it('ligne : formule attribuée, aucun paiement', () => {
    expect(firstPaymentLine('2026-10-05T10:00:00Z')).toBe('Formule attribuée, aucun paiement enregistré · a rejoint la box le 5 oct. 2026');
    expect(firstPaymentLine(null)).toBe('Formule attribuée, aucun paiement enregistré');
  });
});

describe('cashPaymentError : les 5 refus de record_member_cash_payment', () => {
  it.each([
    ['FORBIDDEN: adhésion introuvable ou hors de votre box', 'Seuls le gérant et les co-gérants de la box enregistrent un encaissement.'],
    ['STRIPE_MEMBER: cette adhésion est prélevée par Stripe', 'Ce membre paie en ligne par Stripe : aucun encaissement au comptoir à enregistrer.'],
    ['STRIPE_PAYMENT_PENDING: paiement Stripe en attente', 'Ce membre a un paiement en ligne en attente : rien à encaisser au comptoir tant qu’il n’est pas réglé ou annulé.'],
    ['COUNTER_RENEWAL_DISABLED: la box ne renouvelle pas au comptoir', 'Renouvellement au comptoir désactivé : le membre passe au paiement en ligne (Réglages).'],
    ['NO_PLAN_PRICE: pas de formule tarifée', 'Ce membre n’a pas de formule payante : attribue-lui une formule avant d’encaisser.'],
  ])('%s', (raw, clair) => {
    const out = cashPaymentError(raw);
    expect(out).toBe(clair);
    expect(out).not.toMatch(/[A-Z]{3,}_|FORBIDDEN|adhésion introuvable/);
  });
});

describe('pages : prédicat partagé, cible « member », hors compteurs', () => {
  const abonnes = read('app/(dashboard)/subscribers/page.tsx');
  const membres = read('app/(dashboard)/members/page.tsx');
  it('Abonnés : lignes construites à part, jamais dans le tableau ni les compteurs', () => {
    expect(abonnes).toContain('filter(needsFirstCashPayment)');
    expect(abonnes).toContain('setRows([...memberships, ...programs]);');
    expect(abonnes).toContain('const activeCount = rows.filter(');
    expect(abonnes).toContain('[...rows, ...firstPayRows]');
  });
  it('Membres : même prédicat, même fenêtre, cible member, lu par la route serveur', () => {
    expect(membres).toContain('needsFirstCashPayment(counter)');
    expect(membres).toContain("target: { kind: 'member', boxMemberId: counter.box_member_id }");
    expect(membres).toContain('<CashPaymentDialog');
    expect(membres).toContain('/api/members/counter-access?box_id=');
    expect(membres).toMatch(/<button onClick=\{\(\) => setCashRequest[\s\S]{0,900}Encaissement reçu/);
  });
});
