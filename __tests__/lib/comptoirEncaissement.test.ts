// Comptoir P1, PR 5 — calculs et écrans de l'encaissement avec durée : règle
// « vend en ligne », période (miroir de internal.periode_comptoir), montant,
// blocs d'Abonnés, libellés, erreurs, appels RPC, fenêtre, Invitations,
// Réglages, format du prix mensuel, vocabulaire.
// Sous Jest, `react` est un shim : ce fichier rend des composants, il lui faut le vrai React.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  boxSellsOnline, cashAmountCents, cashPaymentError, counterBlocks, counterPeriod, endingLine, inDaysLabel,
  noticeLabel, periodLabel, renewalBlocked, tableDueNote, toCollectLine, COUNTER_RENEWAL_DISABLED_MESSAGE,
  type CounterAccessMember,
} from '@/lib/comptoir/counter';
import { recordCashPayment } from '@/lib/comptoir/cashPayment';
import { euros, monthlyPrice, perMonthSuffix } from '@/lib/monthlyPrice';
import CashPaymentDialog from '@/components/comptoir/CashPaymentDialog';
import CounterRenewalField from '@/components/comptoir/CounterRenewalField';
import MembershipSubscribeButton from '@/app/box/[slug]/MembershipSubscribeButton';
import { PlanChoice } from '@/app/compte/ManageSubscription';
import type { MembershipOverview } from '@/lib/membership/screens';

(globalThis as unknown as { React: typeof React }).React = React;

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
// Aujourd'hui = 13 oct. 2026 à midi (Paris), comme les maquettes.
const NOW = new Date('2026-10-13T10:00:00Z');

describe('règle « vend en ligne » (copie de internal.box_vend_en_ligne)', () => {
  const BOX = { stripe_account_id: 'acct_1', stripe_onboarding_complete: true };
  const PLAN = { is_active: true, stripe_price_id: 'price_1' };
  it('vraie quand les trois conditions tiennent', () => {
    expect(boxSellsOnline(BOX, [PLAN])).toBe(true);
  });
  it('compte Stripe absent', () => {
    expect(boxSellsOnline({ ...BOX, stripe_account_id: null }, [PLAN])).toBe(false);
  });
  it('onboarding non terminé', () => {
    expect(boxSellsOnline({ ...BOX, stripe_onboarding_complete: false }, [PLAN])).toBe(false);
    expect(boxSellsOnline({ ...BOX, stripe_onboarding_complete: null }, [PLAN])).toBe(false);
  });
  it('aucune formule active avec un prix Stripe', () => {
    expect(boxSellsOnline(BOX, [])).toBe(false);
    expect(boxSellsOnline(BOX, [{ ...PLAN, is_active: false }, { is_active: true, stripe_price_id: null }])).toBe(false);
  });
});

describe('période (miroir de internal.periode_comptoir), au jour de Paris', () => {
  it('13/10 → 12/11 sans accès en cours', () => {
    expect(counterPeriod(null, 1, NOW)).toEqual({ from: '2026-10-13', until: '2026-11-12' });
  });
  it('31/01 → 27/02 (mois court, comme Postgres)', () => {
    expect(counterPeriod(null, 1, new Date('2027-01-31T10:00:00Z'))).toEqual({ from: '2027-01-31', until: '2027-02-27' });
  });
  it('prolongation : la nouvelle période commence le lendemain de la fin en cours', () => {
    expect(counterPeriod('2026-10-20', 1, NOW)).toEqual({ from: '2026-10-21', until: '2026-11-20' });
    expect(counterPeriod('2026-10-13', 1, NOW)).toEqual({ from: '2026-10-14', until: '2026-11-13' });
  });
  it('fin passée : la période part d’aujourd’hui', () => {
    expect(counterPeriod('2026-10-12', 1, NOW)).toEqual({ from: '2026-10-13', until: '2026-11-12' });
  });
  it('3 et 12 mois', () => {
    expect(counterPeriod(null, 3, NOW).until).toBe('2027-01-12');
    expect(counterPeriod(null, 12, NOW).until).toBe('2027-10-12');
  });
  it('jour de Paris : 22:30 UTC le 13 = le 14 à Paris', () => {
    expect(counterPeriod(null, 1, new Date('2026-10-13T22:30:00Z')).from).toBe('2026-10-14');
  });
  it('libellé de la nouvelle période', () => {
    expect(periodLabel('2026-10-21', '2026-11-20')).toBe('du 21 oct. au 20 nov. 2026');
    expect(periodLabel('2026-12-20', '2027-01-19')).toBe('du 20 déc. 2026 au 19 janv. 2027');
  });
});

describe('montant encaissé : prix × mois', () => {
  it.each([[1, 4900], [3, 14700], [12, 58800]])('%i mois → %i centimes', (m, c) => {
    expect(cashAmountCents(4900, m)).toBe(c);
  });
});

describe('libellés de jours', () => {
  it('vrai pluriel, demain, aujourd’hui', () => {
    expect(inDaysLabel(0)).toBe('aujourd’hui');
    expect(inDaysLabel(1)).toBe('demain');
    expect(inDaysLabel(2)).toBe('dans 2 jours');
    expect(inDaysLabel(7)).toBe('dans 7 jours');
    for (let d = 0; d < 15; d++) expect(inDaysLabel(d)).not.toMatch(/\(s\)|dans [01] jour/);
  });
});

describe('« Prévenu le »', () => {
  it.each([['j7', 'J-7'], ['j1', 'J-1'], ['fin', 'fin d’accès']])('%s', (kind, label) => {
    expect(noticeLabel({ kind, sent_at: '2026-10-13T07:41:00Z' })).toBe(`Prévenu le 13 oct. 2026 (${label})`);
  });
  it('rien quand aucun message n’est parti', () => {
    expect(noticeLabel(null)).toBeNull();
    expect(noticeLabel({ kind: 'j7', sent_at: null })).toBeNull();
  });
});

describe('renouvellement refusé (COUNTER_RENEWAL_DISABLED prévu à l’avance)', () => {
  const box = { allowCounterRenewal: false, sellsOnline: true };
  it('période déjà payée, réglage faux, box qui vend en ligne', () => {
    expect(renewalBlocked({ hasCounterPeriod: true }, box)).toBe(true);
  });
  it('premier paiement, réglage vrai ou box sans vente en ligne : permis', () => {
    expect(renewalBlocked({ hasCounterPeriod: false }, box)).toBe(false);
    expect(renewalBlocked({ hasCounterPeriod: true }, { ...box, allowCounterRenewal: true })).toBe(false);
    expect(renewalBlocked({ hasCounterPeriod: true }, { ...box, sellsOnline: false })).toBe(false);
  });
});

const member = (o: Partial<CounterAccessMember>): CounterAccessMember => ({
  box_member_id: o.box_member_id ?? 'bm', member_id: 'm', status: 'active', joined_at: '2026-01-01T00:00:00Z',
  plan_id: 'p49', price_cents: 4900, subscription_status: 'active', payment_method_type: 'cash',
  has_stripe_subscription: false, cash_access_until: null, has_counter_period: true, last_notice: null,
  pending_invitation: null, ...o,
});

describe('sélection des blocs d’Abonnés', () => {
  it('fin d’accès dans 14 jours au plus, ou terminée depuis moins de 30 jours, triée par date', () => {
    const ms = [
      member({ box_member_id: 'j15', cash_access_until: '2026-10-28' }),
      member({ box_member_id: 'j14', cash_access_until: '2026-10-27' }),
      member({ box_member_id: 'j1', cash_access_until: '2026-10-14' }),
      member({ box_member_id: 'moins29', cash_access_until: '2026-09-14', subscription_status: 'expired' }),
      member({ box_member_id: 'moins30', cash_access_until: '2026-09-13', subscription_status: 'expired' }),
      member({ box_member_id: 'stripe', cash_access_until: '2026-10-14', has_stripe_subscription: true }),
      member({ box_member_id: 'arrete', cash_access_until: '2026-10-14', status: 'inactive' }),
      member({ box_member_id: 'gratuit', cash_access_until: null }),
    ];
    expect(counterBlocks(ms, NOW).ending.map((m) => m.box_member_id)).toEqual(['moins29', 'j1', 'j14']);
  });
  it('« À encaisser » : membres inactifs en pending_cash', () => {
    const ms = [
      member({ box_member_id: 'zoe', status: 'inactive', subscription_status: 'pending_cash', joined_at: '2026-10-09T00:00:00Z' }),
      member({ box_member_id: 'ana', status: 'inactive', subscription_status: 'pending_cash', joined_at: '2026-10-01T00:00:00Z' }),
      member({ box_member_id: 'stripe', status: 'inactive', subscription_status: 'pending_payment' }),
      member({ box_member_id: 'actif', status: 'active', subscription_status: 'pending_cash' }),
    ];
    expect(counterBlocks(ms, NOW).toCollect.map((m) => m.box_member_id)).toEqual(['ana', 'zoe']);
  });
  it('lignes : accès en cours, demain, terminé ; à encaisser', () => {
    expect(endingLine(member({ cash_access_until: '2026-10-20' }), NOW)).toEqual({ text: 'Accès jusqu’au 20 oct. 2026 · dans 7 jours · au comptoir', ended: false });
    expect(endingLine(member({ cash_access_until: '2026-10-14' }), NOW).text).toBe('Accès jusqu’au 14 oct. 2026 · demain · au comptoir');
    expect(endingLine(member({ cash_access_until: '2026-10-10', subscription_status: 'expired' }), NOW))
      .toEqual({ text: 'Accès terminé le 10 oct. 2026 · ne peut plus réserver', ended: true });
    expect(toCollectLine('2026-10-09T10:00:00Z')).toBe('Invitée avec paiement à la box · a rejoint la box le 9 oct. 2026 · inactive tant que l’encaissement n’est pas reçu');
  });
  it('tableau : « fin d’accès · dans N jours », ambre à 7 jours, pas à 8 ; « accès terminé »', () => {
    expect(tableDueNote(member({ cash_access_until: '2026-10-20' }), NOW)).toEqual({ text: 'fin d’accès · dans 7 jours', amber: true });
    expect(tableDueNote(member({ cash_access_until: '2026-10-21' }), NOW)).toEqual({ text: 'fin d’accès · dans 8 jours', amber: false });
    expect(tableDueNote(member({ cash_access_until: '2026-10-10', subscription_status: 'expired' }), NOW)).toEqual({ text: 'accès terminé', amber: false });
  });
});

describe('messages d’erreur clairs, jamais le texte de la base', () => {
  it.each([
    ['COUNTER_RENEWAL_DISABLED: cette box ne renouvelle pas au comptoir, le membre passe au paiement en ligne', COUNTER_RENEWAL_DISABLED_MESSAGE],
    ['STRIPE_MEMBER: cette adhésion est prélevée par Stripe', 'Ce membre paie en ligne par Stripe : aucun encaissement au comptoir à enregistrer.'],
    ['NO_PLAN_PRICE: cette adhésion n\'a pas de formule tarifée', 'Ce membre n’a pas de formule payante : attribue-lui une formule avant d’encaisser.'],
    ['FORBIDDEN: adhésion introuvable ou hors de votre box', 'Seuls le gérant et les co-gérants de la box enregistrent un encaissement.'],
    ['relation "x" does not exist', 'L’encaissement n’a pas pu être enregistré. Réessaie dans un instant.'],
  ])('%s', (raw, clair) => {
    expect(cashPaymentError(raw)).toBe(clair);
    expect(cashPaymentError(raw)).not.toMatch(/[A-Z]{3,}_|relation|adhésion introuvable/);
  });
  it('le libellé exact du refus de renouvellement', () => {
    expect(COUNTER_RENEWAL_DISABLED_MESSAGE).toBe('Renouvellement au comptoir désactivé : le membre passe au paiement en ligne (Réglages).');
  });
});

describe('appels RPC avec p_months', () => {
  const client = (data: unknown, error: { message: string } | null = null) => ({ rpc: jest.fn(async () => ({ data, error })) });
  it('membre → record_member_cash_payment', async () => {
    const c = client({ ok: true, access_until: '2027-01-20' });
    expect(await recordCashPayment(c, { kind: 'member', boxMemberId: 'bm-1' }, 3)).toEqual({ ok: true, accessUntil: '2027-01-20' });
    expect(c.rpc).toHaveBeenCalledWith('record_member_cash_payment', { p_box_member_id: 'bm-1', p_months: 3 });
  });
  it('invitation → mark_box_invitation_paid', async () => {
    const c = client({ ok: true, access_until: null });
    expect(await recordCashPayment(c, { kind: 'invitation', invitationId: 'inv-1' }, 12)).toEqual({ ok: true, accessUntil: null });
    expect(c.rpc).toHaveBeenCalledWith('mark_box_invitation_paid', { p_invitation_id: 'inv-1', p_months: 12 });
  });
  it('refus de la base → phrase claire', async () => {
    const c = client(null, { message: 'COUNTER_RENEWAL_DISABLED: …' });
    expect(await recordCashPayment(c, { kind: 'member', boxMemberId: 'bm-1' }, 1)).toEqual({ ok: false, error: COUNTER_RENEWAL_DISABLED_MESSAGE });
  });
});

describe('fenêtre « Encaissement reçu » (65:21994)', () => {
  const render = (o: Record<string, unknown>) => text(renderToStaticMarkup(React.createElement(CashPaymentDialog, {
    request: { target: { kind: 'member', boxMemberId: 'bm' }, who: 'Léo_Rox', planName: 'Mensuel illimité', priceCents: 4900, currentUntil: '2026-10-20', ...o },
    onClose: () => {}, onDone: () => {}, now: NOW,
  })));

  it('prolongation : ligne, durée (1 mois par défaut), récapitulatif, phrase du lendemain, note, boutons', () => {
    const t = render({});
    expect(t).toContain('Encaissement reçu Léo_Rox · Mensuel illimité · 49 € / mois. Accès en cours jusqu’au 20 oct. 2026.');
    expect(t).toContain('Durée 1 mois 3 mois 12 mois');
    expect(t).toContain('Montant encaissé 49 € Nouvelle période du 21 oct. au 20 nov. 2026 Accès jusqu’au 20 nov. 2026');
    expect(t).toContain('L’accès en cours se termine le 20 oct. : la nouvelle période commence le lendemain, aucun jour n’est perdu.');
    expect(t).toContain('Montant = prix de la formule × durée, lu par la base. Il entre dans le journal des encaissements, non modifiable. Le membre est prévenu avant la fin de la nouvelle période.');
    expect(t).toContain('Annuler Enregistrer l’encaissement');
    expect(renderToStaticMarkup(React.createElement(CashPaymentDialog, {
      request: { target: { kind: 'member', boxMemberId: 'bm' }, who: 'L', planName: 'M', priceCents: 4900, currentUntil: null },
      onClose: () => {}, onDone: () => {}, now: NOW,
    }))).toMatch(/aria-checked="true"[^>]*>1 mois/);
  });

  it('sans accès en cours (ou terminé) : ni « Accès en cours » ni phrase du lendemain', () => {
    for (const currentUntil of [null, '2026-10-10']) {
      const t = render({ currentUntil });
      expect(t).toContain('Léo_Rox · Mensuel illimité · 49 € / mois.');
      expect(t).not.toContain('Accès en cours');
      expect(t).not.toContain('aucun jour n’est perdu');
      expect(t).toContain('Nouvelle période du 13 oct. au 12 nov. 2026');
    }
  });

  it('formule gratuite ou absente : pas de durée, « Formule gratuite : aucune date de fin. »', () => {
    for (const priceCents of [0, null]) {
      const t = render({ priceCents, currentUntil: null });
      expect(t).toContain('Formule gratuite : aucune date de fin.');
      expect(t).not.toContain('Durée');
      expect(t).not.toContain('Montant encaissé');
    }
  });

  it('l’encaissement ne part que du bouton « Enregistrer l’encaissement »', () => {
    const src = read('components/comptoir/CashPaymentDialog.tsx');
    expect(src).toMatch(/onClick=\{submit\}[^>]*>[\s\S]{0,120}Enregistrer l’encaissement/);
    expect(src.match(/recordCashPayment\(/g)).toHaveLength(1);
  });
});

describe('Invitations (67:869)', () => {
  const src = read('app/(dashboard)/invitations/page.tsx');
  it('« Prochaine échéance » masquée en encaissement box, et non envoyée', () => {
    expect(src).toMatch(/\{paymentMode === 'stripe' && \(\s*<div[^>]*data-testid="prochaine-echeance"/);
    expect(src).toContain("p_next_due_date: paymentMode === 'stripe' ? dueDate || null : null,");
  });
  it('durée payée envoyée à create_box_invitation', () => {
    expect(src).toMatch(/rpc\('create_box_invitation', \{[\s\S]{0,600}p_cash_months: cashMonths,/);
  });
  it('« Encaissé » ouvre la fenêtre, plus d’appel direct', () => {
    expect(src).toContain('onClick={() => askMarkPaid(inv)}');
    expect(src).not.toContain("rpc('mark_box_invitation_paid'");
  });
  it('formule gratuite : pas de durée, la phrase', () => {
    expect(src).toMatch(/if \(!isPayablePlan\(price\)\) return <p[^>]*>\{FREE_PLAN_NOTE\}<\/p>;/);
  });
});

describe('Réglages (67:1290)', () => {
  const render = (allow: boolean, sellsOnline: boolean) =>
    renderToStaticMarkup(React.createElement(CounterRenewalField, { allow, sellsOnline, onToggle: () => {} }));
  it('désactivé, activé : interrupteur cliquable et l’aide', () => {
    expect(render(false, true)).toMatch(/role="switch" aria-checked="false"/);
    expect(render(true, true)).toMatch(/role="switch" aria-checked="true"/);
    expect(render(false, true)).not.toContain('disabled=""');
    expect(text(render(false, true))).toContain('Renouvellement au comptoir Autoriser le renouvellement au comptoir Désactivé : après un premier paiement au comptoir, tes membres passent au paiement en ligne avant la fin de leur période. Activé : tu peux encaisser une nouvelle période à la main (espèces, chèque, chèques sport…).');
  });
  it('box qui ne vend pas en ligne : activé et grisé, avec sa phrase', () => {
    const html = render(false, false);
    expect(html).toMatch(/role="switch" aria-checked="true"[^>]*disabled=""/);
    expect(text(html)).toContain('Ta box ne vend pas encore en ligne : le comptoir reste ouvert.');
  });
  it('enregistré avec le bouton de la carte, seulement si la box vend en ligne et que la valeur change', () => {
    expect(read('app/(dashboard)/settings/page.tsx')).toMatch(/if \(counterRenewal && counterRenewal\.sellsOnline && counterRenewal\.allow !== counterRenewal\.saved\) \{\s*const renewalRes = await fetch\('\/api\/box\/counter-renewal', \{\s*method: 'POST'/);
  });
});

describe('prix mensuel « 49 € / mois » (une seule fois)', () => {
  const once = (s: string) => (s.match(/mois/g) ?? []).length === 1;
  it('la fonction de formatage', () => {
    // Espace avant « € » : insécable (fine ou non selon la version d'ICU).
    expect(monthlyPrice(4900)).toMatch(/^49[\u00a0\u202f]€\u00a0\/ mois$/);
    expect(monthlyPrice(3990)).toMatch(/^39,90[\u00a0\u202f]€\u00a0\/ mois$/);
    expect(perMonthSuffix()).toBe('\u00a0/ mois');
    expect(monthlyPrice(4900, 'month')).toMatch(/^49[\u00a0\u202f]€\u00a0\/ month$/);
    expect(euros(4900)).toMatch(/^49[\u00a0\u202f]€$/);
  });
  it('bouton de la fenêtre d’abonnement sur /box/[slug]', () => {
    const t = text(renderToStaticMarkup(React.createElement(MembershipSubscribeButton, { planId: 'p', planName: 'M', priceLabel: euros(4900) })));
    expect(t).toBe('S\'abonner — 49 € / mois');
    expect(once(t)).toBe(true);
  });
  it('en-tête et récapitulatif de la fenêtre : le même prix, sans second « mois »', () => {
    const src = read('app/box/[slug]/MembershipSubscribeButton.tsx');
    expect(src).toContain('const price = oneShot ? priceLabel : `${priceLabel}${perMonthSuffix()}`;');
    expect(src).toContain(': `${price} — abonnement mensuel.');
    expect(src).toContain('<span className="text-ax-text font-semibold">{price}</span>');
    expect(src).not.toMatch(/\{priceLabel\} \/ mois|\{cta\} — \{priceLabel\}|\$\{priceLabel\} — abonnement/);
  });
  it('cartes des formules sur /box/[slug] : montant seul passé à la fenêtre', () => {
    const src = read('app/box/[slug]/BoxPublicView.tsx');
    expect(src).toContain("priceLabel={pl.price_cents > 0 ? euros(pl.price_cents) : formatPrice(pl.price_cents)}");
    expect(src).toContain("{perMonthSuffix(p.perMonth.replace('/', '').trim())}");
    expect(src).not.toContain('priceLabel={`${formatPrice(pl.price_cents)}${p.perMonth}`}');
  });
  it('/compte : en-tête et choix de formule', () => {
    expect(read('app/compte/page.tsx')).toContain('<span className="text-[10px] text-gray-500">{perMonthSuffix()}</span>');
    const ov = {
      mode: 'online', available_plans: [{ id: 'p35', name: '3 séances / semaine', price_cents: 3500, description: null }],
      plan: { id: 'p49', name: 'Mensuel illimité', description: null }, next_billing_at: null,
    } as unknown as MembershipOverview;
    const t = text(renderToStaticMarkup(React.createElement(PlanChoice, {
      overview: ov, planId: 'p35', onPick: () => {}, onConfirm: () => {}, onCancel: () => {}, loading: false, error: null,
    })));
    expect(t).toContain('3 séances / semaine 35 € / mois');
    expect(t).toContain('à 35 € / mois, sera prélevée');
    expect(t).not.toMatch(/\/mois|mois \/ mois/);
  });
});

describe('vocabulaire', () => {
  const FICHIERS = [
    'lib/comptoir/counter.ts', 'lib/comptoir/cashPayment.ts', 'lib/monthlyPrice.ts',
    'components/comptoir/CashPaymentDialog.tsx', 'components/comptoir/CounterRenewalField.tsx',
    'app/api/members/counter-access/route.ts', 'app/api/box/counter-renewal/route.ts',
    'app/(dashboard)/subscribers/page.tsx', 'app/(dashboard)/invitations/page.tsx', 'app/(dashboard)/settings/page.tsx',
  ];
  it.each(FICHIERS)('%s : jamais « CrossFit » ni « Hyrox »', (f) => {
    expect(read(f)).not.toMatch(/crossfit|hyrox/i);
  });
});

describe('statut du tableau d’Abonnés', () => {
  // Import tardif : module pur, sans React.
  const { statusBadge, TO_COLLECT_LABEL } = require('@/lib/subscriberStatus') as typeof import('@/lib/subscriberStatus');
  it('pending_cash : badge Alerte « À encaisser », jamais le code brut', () => {
    expect(statusBadge('pending_cash')).toEqual({ label: 'À encaisser', variant: 'warning' });
    expect(TO_COLLECT_LABEL).toBe('À encaisser');
  });
  it('le bloc et le badge partagent le libellé', () => {
    const src = read('app/(dashboard)/subscribers/page.tsx');
    expect(src).toContain('{TO_COLLECT_LABEL} ({toCollect.length})');
    expect(src.match(/const st = statusBadge\(r\.status\);/g)).toHaveLength(2);
  });
  it('libellés existants inchangés ; statut inconnu affiché tel quel, en gris', () => {
    expect(statusBadge('active')).toEqual({ label: 'Actif', variant: 'success' });
    expect(statusBadge('expired')).toEqual({ label: 'Accès terminé', variant: 'neutral' });
    expect(statusBadge('statut_inconnu')).toEqual({ label: 'statut_inconnu', variant: 'neutral' });
  });
  it('pending_payment (adhésion) et pending (programme) : badge Alerte « Paiement en attente »', () => {
    expect(statusBadge('pending_payment')).toEqual({ label: 'Paiement en attente', variant: 'warning' });
    expect(statusBadge('pending')).toEqual({ label: 'Paiement en attente', variant: 'warning' });
  });
});
