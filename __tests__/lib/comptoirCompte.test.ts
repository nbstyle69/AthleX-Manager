// Comptoir P1, PR 4 — /compte d'un membre au comptoir (maquettes 66:1553,
// 66:1620, 66:1693, 66:1760) et fenêtre « Passer au paiement en ligne » (66:2103).
// Sous Jest, `react` est un shim : ce fichier rend des composants, il lui faut le vrai React.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import ManageSubscription from '@/app/compte/ManageSubscription';
import MembershipSubscribeButton from '@/app/box/[slug]/MembershipSubscribeButton';
import { CashUntilNotice } from '@/components/membership/BillingDayRecap';
import { counterAccessView, daysUntilParis } from '@/lib/compte/counterAccess';
import type { MembershipOverview } from '@/lib/membership/screens';

(globalThis as unknown as { React: typeof React }).React = React;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();

// Aujourd'hui = 13 oct. 2026 (midi à Paris), comme les maquettes.
const NOW = new Date('2026-10-13T10:00:00Z');
const row = (o: Partial<Parameters<typeof counterAccessView>[0]> = {}) => ({
  has_stripe_subscription: false, cash_access_until: '2026-11-12', subscription_status: 'active', box_sells_online: true, ...o,
});
const view = (o: Partial<Parameters<typeof counterAccessView>[0]> = {}, payable = true, now = NOW) => counterAccessView(row(o), payable, now)!;

describe('jours restants au jour de Paris', () => {
  it('compte en jours calendaires de Paris, pas d’UTC', () => {
    // 22:30 UTC le 13 = 00:30 le 14 à Paris : il reste 6 jours jusqu'au 20, pas 7.
    expect(daysUntilParis('2026-10-20', new Date('2026-10-13T22:30:00Z'))).toBe(6);
    expect(daysUntilParis('2026-10-20', new Date('2026-10-13T21:59:00Z'))).toBe(7);
  });

  it('traverse le changement d’heure du 25 octobre sans perdre de jour', () => {
    expect(daysUntilParis('2026-10-27', new Date('2026-10-24T23:30:00Z'))).toBe(2);
    expect(daysUntilParis('2026-10-26', new Date('2026-10-25T22:59:00Z'))).toBe(1);
  });

  it('0 le dernier jour, négatif ensuite', () => {
    expect(daysUntilParis('2026-10-13', NOW)).toBe(0);
    expect(daysUntilParis('2026-10-12', NOW)).toBe(-1);
  });
});

describe('états de /compte', () => {
  it('accès en cours (66:1553)', () => {
    const v = view();
    expect(v.kind).toBe('running');
    expect(v.line).toBe('Accès payé à la box jusqu’au 12 nov. 2026');
    expect(v.notice).toBeNull();
    expect(v.cta).toBe('Passer au paiement en ligne');
    expect(v.hint).toBe('Rien à payer aujourd’hui : ton premier prélèvement aura lieu après la fin de ton accès. Un changement de formule au comptoir reste validé et encaissé par ta box.');
    expect(v.allowRequest).toBe(true);
  });

  it('fin proche à 7 jours (66:1620), pas à 8', () => {
    const v = view({ cash_access_until: '2026-10-20' });
    expect(v.kind).toBe('ending');
    expect(v.line).toBe('Accès payé à la box jusqu’au 20 oct. 2026');
    expect(v.notice).toBe('Ton accès se termine le 20 oct. 2026 (dans 7 jours). Passe au paiement en ligne pour continuer à réserver, sans payer deux fois.');
    expect(v.cta).toBe('Passer au paiement en ligne');
    expect(v.hint).toBe('Rien à payer aujourd’hui : ton premier prélèvement aura lieu après la fin de ton accès.');
    expect(v.allowRequest).toBe(true);

    const huit = view({ cash_access_until: '2026-10-21' });
    expect(huit.kind).toBe('running');
    expect(huit.notice).toBeNull();
  });

  it('vrai pluriel, jamais « jour(s) »', () => {
    expect(view({ cash_access_until: '2026-10-14' }).notice).toContain('(dans 1 jour).');
    expect(view({ cash_access_until: '2026-10-15' }).notice).toContain('(dans 2 jours).');
    expect(view({ cash_access_until: '2026-10-13' }).notice).toContain('(aujourd’hui).');
    for (let d = 13; d <= 20; d++) expect(view({ cash_access_until: `2026-10-${d}` }).notice).not.toMatch(/\(s\)/);
  });

  it('accès terminé (66:1693) : statut expired, ou fin passée avant la coupure horaire', () => {
    for (const v of [view({ cash_access_until: '2026-10-10', subscription_status: 'expired' }), view({ cash_access_until: '2026-10-10' })]) {
      expect(v.kind).toBe('ended');
      expect(v.line).toBe('Accès terminé le 10 oct. 2026 — tu ne peux plus réserver');
      expect(v.notice).toBeNull();
      expect(v.cta).toBe('Activer mon abonnement en ligne');
      expect(v.hint).toBe('Carte bancaire ou prélèvement SEPA, sur la page de paiement sécurisée de ta box.');
      expect(v.allowRequest).toBe(false);
    }
  });

  it('box sans paiement en ligne (66:1760) : pas de bouton, phrase « rapproche-toi d’elle »', () => {
    const v = view({ cash_access_until: '2026-10-20', box_sells_online: false });
    expect(v.notice).toBe('Ton accès se termine le 20 oct. 2026 (dans 7 jours).');
    expect(v.cta).toBeNull();
    expect(v.hint).toBe('Ta box ne propose pas le paiement en ligne : rapproche-toi d’elle pour renouveler.');
    expect(v.allowRequest).toBe(true);
    // Accès en cours sans paiement en ligne : rien de nouveau sous les boutons.
    expect(view({ box_sells_online: false }).hint).toBeNull();
    // Formule désactivée ou gratuite : même traitement qu'une box sans paiement en ligne.
    expect(view({}, false).cta).toBeNull();
  });

  it('formule gratuite ou attribuée (sans date de fin) et abonné Stripe : rien ne change', () => {
    expect(counterAccessView(row({ cash_access_until: null }), true, NOW)).toBeNull();
    expect(counterAccessView(row({ has_stripe_subscription: true }), true, NOW)).toBeNull();
  });
});

const OVERVIEW: MembershipOverview = {
  box: { id: 'box', name: 'AthleX Fitness' },
  plan: { id: 'p49', name: 'Mensuel illimité', description: null },
  price_cents: 4900, status: 'active', mode: 'counter', next_billing_at: null, payment_method: null,
  scheduled_change: null, pending_request: null,
  available_plans: [{ id: 'p35', name: '3 séances / semaine', price_cents: 3500, description: null }],
  block_reason: null, unpaid_invoice_url: null,
};
const SUBSCRIBE = { planId: 'p49', planName: 'Mensuel illimité', priceLabel: '49 €', otherPlansHref: '/box/athlex-fitness', cashUntil: '2026-11-12' };

function compte(v: ReturnType<typeof view>, subscribe: typeof SUBSCRIBE | null = SUBSCRIBE) {
  return text(renderToStaticMarkup(React.createElement(ManageSubscription, {
    overview: OVERVIEW, boxId: 'box', commitmentEndDate: null, paused: false, pauseResumesAt: null,
    counter: { view: v, subscribe },
  })));
}

describe('/compte rendu : ordre et libellés des cadres', () => {
  it('accès en cours : bouton blanc, puis la demande en secondaire, puis l’indication', () => {
    const t = compte(view());
    expect(t).toContain('Passer au paiement en ligne Demander un changement de formule Rien à payer aujourd’hui');
    expect(t).not.toContain('Tu paies au comptoir');
  });

  it('fin proche : encart ambre au-dessus des boutons', () => {
    const t = compte(view({ cash_access_until: '2026-10-20' }));
    expect(t).toContain('sans payer deux fois. Passer au paiement en ligne Demander un changement de formule Rien à payer aujourd’hui : ton premier prélèvement aura lieu après la fin de ton accès.');
  });

  it('accès terminé : Activer mon abonnement en ligne, sans demande de changement', () => {
    const t = compte(view({ cash_access_until: '2026-10-10', subscription_status: 'expired' }));
    expect(t).toContain('Activer mon abonnement en ligne Carte bancaire ou prélèvement SEPA');
    expect(t).not.toContain('Demander un changement de formule');
  });

  it('box sans paiement en ligne : encart court, demande, phrase de la box, aucun bouton blanc', () => {
    const t = compte(view({ cash_access_until: '2026-10-20', box_sells_online: false }), null);
    expect(t).toContain('Ton accès se termine le 20 oct. 2026 (dans 7 jours). Demander un changement de formule Ta box ne propose pas le paiement en ligne');
    expect(t).not.toContain('Passer au paiement en ligne');
  });

  it('accès en cours sans paiement en ligne : la note comptoir existante reste', () => {
    expect(compte(view({ box_sells_online: false }), null)).toContain('Tu paies au comptoir : ta box valide le changement et l’encaisse.');
  });
});

describe('fenêtre d’abonnement', () => {
  it('bloc de la maquette 66:2103 : date longue et lendemain', () => {
    expect(text(renderToStaticMarkup(React.createElement(CashUntilNotice, { until: '2026-11-12' }))))
      .toBe('Ton accès payé à la box court jusqu’au 12 novembre 2026 : rien ne sera prélevé avant le 13 novembre.');
    expect(text(renderToStaticMarkup(React.createElement(CashUntilNotice, { until: '2026-12-31' }))))
      .toContain('rien ne sera prélevé avant le 1er janvier.');
  });

  it('déclencheur fourni par /compte à la place de « S’abonner — prix » ; /box inchangé', () => {
    const avec = text(renderToStaticMarkup(React.createElement(MembershipSubscribeButton, {
      ...SUBSCRIBE, trigger: React.createElement<React.ButtonHTMLAttributes<HTMLButtonElement>>('button', { type: 'button' }, 'Passer au paiement en ligne'),
    })));
    expect(avec).toBe('Passer au paiement en ligne');
    const sans = text(renderToStaticMarkup(React.createElement(MembershipSubscribeButton, { planId: 'p49', planName: 'Mensuel illimité', priceLabel: '49 €' })));
    expect(sans).toBe('S\'abonner — 49 € / mois');
  });
});

describe('vocabulaire', () => {
  const FICHIERS = [
    'lib/compte/counterAccess.ts', 'lib/membershipCheckout.ts', 'app/compte/page.tsx', 'app/compte/ManageSubscription.tsx',
    'app/box/[slug]/MembershipSubscribeButton.tsx', 'components/membership/BillingDayRecap.tsx',
    'app/api/membership-checkout-preview/route.ts',
  ];
  it.each(FICHIERS)('%s : jamais « CrossFit » ni « Hyrox »', (f) => {
    expect(readFileSync(join(process.cwd(), f), 'utf8')).not.toMatch(/crossfit|hyrox/i);
  });

  it('les textes rendus non plus', () => {
    const tous = [
      compte(view()), compte(view({ cash_access_until: '2026-10-20' })),
      compte(view({ cash_access_until: '2026-10-10', subscription_status: 'expired' })),
      compte(view({ cash_access_until: '2026-10-20', box_sells_online: false }), null),
    ].join(' ');
    expect(tous).not.toMatch(/crossfit|hyrox/i);
  });
});

// ── La vraie page, données simulées ─────────────────────────────────────────
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
  redirect: (u: string) => { throw new Error(`redirect ${u}`); },
}));
const mockBilling = jest.fn();
jest.mock('@/lib/membership/overview', () => ({ readOverview: jest.fn(async () => OVERVIEW) }));
jest.mock('@/lib/membership/server', () => ({ getConnectStripe: () => ({}) }));
jest.mock('@/lib/supabase/server', () => {
  const chain = (data: unknown) => {
    const c: any = {};
    ['select', 'eq', 'order'].forEach((m) => (c[m] = () => c));
    c.maybeSingle = async () => ({ data });
    c.then = (r: Function) => Promise.resolve({ data: [] }).then(r as any);
    return c;
  };
  const PLAN = { name: 'Mensuel illimité', color: null, price_cents: 4900, is_active: true, plan_type: 'subscription', commitment_months: 0, description: null, max_sessions_per_week: null, terms: null };
  const BOX = { id: 'box', name: 'AthleX Fitness', slug: 'athlex-fitness', terms_pdf_url: null };
  const client = {
    rpc: async (fn: string) => ({ data: fn === 'get_my_membership_billing' ? mockBilling() : [], error: null }),
    from: (t: string) => chain(t === 'membership_plans' ? PLAN : t === 'boxes' ? BOX : null),
  };
  return {
    getServerUser: async () => ({ id: 'user-42', email: 'membre@b.com' }),
    createClient: async () => client,
    createServiceClient: () => ({}),
    getAdminBoxes: async () => [],
  };
});

import AccountPage from '@/app/compte/page';

const billing = (o: Record<string, unknown>) => [{
  id: 'bm', box_id: 'box', status: 'active', joined_at: '2026-09-01T00:00:00Z', plan_id: 'p49',
  subscription_status: 'active', subscription_current_period_end: null, subscription_cancel_at_period_end: false,
  subscription_paused: false, pause_resumes_at: null, commitment_end_date: null, amount_cents: null, past_due_since: null,
  has_stripe_subscription: false, cash_access_until: '2026-11-12', box_sells_online: true, ...o,
}];
const page = async () => text(renderToStaticMarkup(await AccountPage()));

describe('/compte, la page', () => {
  beforeAll(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); jest.setSystemTime(NOW); });
  afterAll(() => jest.useRealTimers());

  it('accès en cours : badge « Adhésion active » (et non « Actif »), ligne d’accès, bouton', async () => {
    mockBilling.mockReturnValue(billing({}));
    const t = await page();
    expect(t).toContain('Adhésion active');
    expect(t).not.toContain('Actif');
    expect(t).not.toContain('Prochaine échéance');
    expect(t).toContain('Accès payé à la box jusqu’au 12 nov. 2026');
    expect(t).toContain('Passer au paiement en ligne Demander un changement de formule');
  });

  it('accès terminé : badge rouge « Accès terminé » et sa ligne', async () => {
    mockBilling.mockReturnValue(billing({ subscription_status: 'expired', cash_access_until: '2026-10-10' }));
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toMatch(/bg-red-500\/10 text-red-400">Accès terminé</);
    expect(text(html)).toContain('Accès terminé le 10 oct. 2026 — tu ne peux plus réserver');
    expect(text(html)).toContain('Activer mon abonnement en ligne');
  });

  it('formule gratuite ou attribuée (sans fin d’accès) : texte actuel inchangé', async () => {
    mockBilling.mockReturnValue(billing({ subscription_status: null, cash_access_until: null }));
    const t = await page();
    expect(t).toContain('Sans abonnement en ligne — formule attribuée ou payée à la box');
    expect(t).not.toContain('Passer au paiement en ligne');
  });

  it('abonné Stripe : rien ne change', async () => {
    mockBilling.mockReturnValue(billing({ has_stripe_subscription: true, subscription_current_period_end: '2026-11-05T05:00:00Z' }));
    const t = await page();
    expect(t).toContain('Actif');
    expect(t).toContain('Prochaine échéance');
    expect(t).not.toContain('Accès payé');
  });
});
