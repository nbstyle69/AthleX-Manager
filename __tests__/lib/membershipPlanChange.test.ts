// Règles pures du changement de formule (lib/membership/planChange.ts,
// overview.ts) et textes du push de décision (lib/members/membershipPush.ts).

import {
  PLAN_CHANGE_MESSAGES, blockReason, codeFromDbError, modeOf, planChangeDoneMessage, planRefusal,
} from '@/lib/membership/planChange';
import { buildOverview, paymentMethodText } from '@/lib/membership/overview';
import { planChangeDecisionPush } from '@/lib/members/membershipPush';

const base = { subscription_status: 'active', past_due_since: null, subscription_paused: false, subscription_cancel_at_period_end: false };
const ouvert = { boxClosed: false, cancellationPending: false };

describe('blockReason : l’ordre de la base', () => {
  it('rien : null ; un engagement ne bloque pas', () => {
    expect(blockReason(base, ouvert)).toBeNull();
  });
  it.each([
    ['box fermée', base, { ...ouvert, boxClosed: true }, 'box_closed'],
    ['impayé (statut)', { ...base, subscription_status: 'past_due' }, ouvert, 'past_due'],
    ['impayé (date seule)', { ...base, past_due_since: '2026-10-01' }, ouvert, 'past_due'],
    ['pause', { ...base, subscription_paused: true }, ouvert, 'paused'],
    ['résiliation programmée', { ...base, subscription_cancel_at_period_end: true }, ouvert, 'cancel_scheduled'],
    ['demande de résiliation', base, { ...ouvert, cancellationPending: true }, 'cancel_scheduled'],
    ['box fermée avant impayé', { ...base, subscription_status: 'past_due' }, { ...ouvert, boxClosed: true }, 'box_closed'],
    ['impayé avant pause', { ...base, past_due_since: '2026-10-01', subscription_paused: true }, ouvert, 'past_due'],
  ])('%s', (_l, m, o, attendu) => {
    expect(blockReason(m as any, o)).toBe(attendu);
  });
});

describe('planRefusal', () => {
  const m = { box_id: 'b', plan_id: 'p1' };
  const p = { id: 'p2', box_id: 'b', name: 'X', price_cents: 5000, is_active: true, plan_type: 'subscription' };
  it.each([
    ['proposable', p, null],
    ['même formule', { ...p, id: 'p1' }, 'PLAN_CHANGE_SAME_PLAN'],
    ['gratuite', { ...p, price_cents: 0 }, 'PLAN_CHANGE_INVALID_PLAN'],
    ['inactive', { ...p, is_active: false }, 'PLAN_CHANGE_INVALID_PLAN'],
    ['autre box', { ...p, box_id: 'c' }, 'PLAN_CHANGE_INVALID_PLAN'],
    ['carnet', { ...p, plan_type: 'pack' }, 'PLAN_CHANGE_INVALID_PLAN'],
    ['absente', null, 'PLAN_CHANGE_INVALID_PLAN'],
  ])('%s', (_l, plan, attendu) => {
    expect(planRefusal(plan as any, m)).toBe(attendu);
  });
});

describe('codes de la base', () => {
  it('« CODE: message » → le code ; inconnu → null', () => {
    expect(codeFromDbError('PLAN_CHANGE_PAST_DUE: règle d’abord ton impayé')).toBe('PLAN_CHANGE_PAST_DUE');
    expect(codeFromDbError('PLAN_CHANGE_INCONNU: x')).toBeNull();
    expect(codeFromDbError('autre erreur')).toBeNull();
  });
  it('chaque code de la base a son message français', () => {
    for (const c of ['NOT_MEMBER', 'BOX_CLOSED', 'NOT_COUNTER', 'PAST_DUE', 'PAUSED', 'CANCEL_SCHEDULED', 'INVALID_PLAN', 'SAME_PLAN', 'PENDING_EXISTS', 'FORBIDDEN', 'NOT_FOUND']) {
      expect(PLAN_CHANGE_MESSAGES[`PLAN_CHANGE_${c}` as keyof typeof PLAN_CHANGE_MESSAGES]).toBeTruthy();
    }
  });
});

describe('mode', () => {
  it.each([
    ['sub_1', 'active', 'online'], ['sub_1', 'trialing', 'online'], ['sub_1', 'past_due', 'online'],
    ['sub_1', 'canceled', 'counter'], [null, 'active', 'counter'], [null, null, 'counter'],
  ])('%s / %s → %s', (sub, statut, attendu) => {
    expect(modeOf({ stripe_subscription_id: sub, subscription_status: statut })).toBe(attendu);
  });
});

describe('overview', () => {
  const membre = {
    id: 'bm', box_id: 'b', member_id: 'u', status: 'active', joined_at: null, plan_id: 'p1', subscription_status: null,
    stripe_subscription_id: null, subscription_current_period_end: null, subscription_cancel_at_period_end: false,
    subscription_paused: false, past_due_since: null, amount_cents: null, scheduled_plan_id: null, scheduled_change_at: null,
    stripe_schedule_id: null,
  };
  const plans = [
    { id: 'p1', box_id: 'b', name: 'Mensuel', price_cents: 5000, is_active: true, plan_type: 'subscription' },
    { id: 'p3', box_id: 'b', name: 'Premium', price_cents: 9000, is_active: true, plan_type: 'subscription' },
    { id: 'p2', box_id: 'b', name: 'Illimité', price_cents: 7000, is_active: true, plan_type: 'subscription' },
    { id: 'p0', box_id: 'b', name: 'Offerte', price_cents: 0, is_active: true, plan_type: 'subscription' },
  ];
  const o = (m: Record<string, unknown> = {}, x: Record<string, unknown> = {}) => buildOverview({
    member: { ...membre, ...m } as any, box: { id: 'b', name: 'Box' }, plans, pendingRequest: null,
    paymentMethod: null, block: null, unpaidInvoiceUrl: 'https://invoice', ...x,
  });

  it('prix : amount_cents sinon le prix de la formule', () => {
    expect(o().price_cents).toBe(5000);
    expect(o({ amount_cents: 4500 }).price_cents).toBe(4500);
  });
  it('formules proposables : payantes, hors formule actuelle, par prix croissant', () => {
    expect(o().available_plans.map((p) => p.id)).toEqual(['p2', 'p3']);
  });
  it('changement programmé nommé ; facture impayée seulement en impayé', () => {
    expect(o({ scheduled_plan_id: 'p2', scheduled_change_at: '2026-11-01' }).scheduled_change)
      .toEqual({ plan: { id: 'p2', name: 'Illimité' }, at: '2026-11-01' });
    expect(o().unpaid_invoice_url).toBeNull();
    expect(o({}, { block: 'past_due' }).unpaid_invoice_url).toBe('https://invoice');
  });
  it('moyen de paiement', () => {
    expect(paymentMethodText({ type: 'card', card: { last4: '4242' } })).toBe('Carte •••• 4242');
    expect(paymentMethodText({ type: 'sepa_debit', sepa_debit: { last4: '1234' } })).toBe('Prélèvement SEPA •••• 1234');
    expect(paymentMethodText({ type: 'paypal' })).toBeNull();
    expect(paymentMethodText(null)).toBeNull();
  });
});

describe('textes', () => {
  it('réponse de la route (site)', () => {
    expect(planChangeDoneMessage({ mode: 'counter', plan_name: 'Illimité' })).toBe('Ta demande de passage à « Illimité » est envoyée à ta box.');
    expect(planChangeDoneMessage({ mode: 'online', plan_name: 'Illimité', effective_at: '2026-11-01T12:00:00Z' }))
      .toBe("Ton passage à « Illimité » est programmé le 1 novembre 2026. Rien n'est facturé aujourd'hui.");
  });
  it('push de décision, FR et EN', () => {
    expect(planChangeDecisionPush({ accepted: true, planName: 'Illimité' })).toEqual({
      title: 'Changement de formule accepté', body: 'Ta box a accepté ton passage à Illimité.',
      en: { title: 'Plan change accepted', body: 'Your box accepted your switch to Illimité.' },
    });
    expect(planChangeDecisionPush({ accepted: false, planName: null })).toEqual({
      title: 'Changement de formule refusé', body: 'Ta box a refusé ta demande de changement de formule.',
      en: { title: 'Plan change declined', body: 'Your box declined your plan change request.' },
    });
  });
});

describe('envoi du push de décision', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withPushEnv, pushesOf } = require('../__fixtures__/pushEnv');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sendPlanChangeDecisionPush } = require('@/lib/members/membershipPush');
  withPushEnv();

  it('send-push, chemin serveur, annonces de la box, au seul membre', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ sent: 1 }) } as any);
    expect(await sendPlanChangeDecisionPush({ userId: 'ath-1', boxId: 'box-1', accepted: true, planName: 'Illimité' })).toBe(true);
    expect(JSON.parse((fetchSpy.mock.calls[0] as any)[1].body).category).toBe('box_announcements');
    expect(pushesOf(fetchSpy)).toEqual([expect.objectContaining({
      secret: 'cron_test', user_id: 'ath-1', body: 'Ta box a accepté ton passage à Illimité.',
      data: { type: 'membership_plan_change', box_id: 'box-1' },
    })]);
    fetchSpy.mockRestore();
  });
});
