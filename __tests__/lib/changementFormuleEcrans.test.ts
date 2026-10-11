// Sous Jest, `react` est un shim (__mocks__/react-shim.js) qui ne porte que
// `cache` : ce fichier rend des composants, il lui faut le vrai React.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser: () => new Promise(() => {}) } }) }));

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import ManageSubscription, { PlanChoice } from '@/app/compte/ManageSubscription';
import MembershipManageButton, { isActiveMemberOf } from '@/app/box/[slug]/MembershipManageButton';
import PlanChangeRequestsPanel from '@/components/PlanChangeRequestsPanel';
import {
  cancelPlanChange, compteActions, decidePlanChange, effectiveDateNotice, paymentPortalUrl, scheduledRowLabel,
  type MembershipOverview,
} from '@/lib/membership/screens';

(globalThis as unknown as { React: typeof React }).React = React;

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** Texte visible, sans balises ni espaces multiples. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();

const PLANS = [
  { id: 'p35', name: '3 séances / semaine', price_cents: 3500, description: null },
  { id: 'p39', name: 'Mensuel étudiant', price_cents: 3900, description: null },
];

function ov(o: Partial<MembershipOverview> = {}): MembershipOverview {
  return {
    box: { id: 'box', name: 'AthleX Fitness' },
    plan: { id: 'p49', name: 'Mensuel illimité', description: null },
    price_cents: 4900,
    status: 'active',
    mode: 'online',
    next_billing_at: '2026-11-01T09:00:00Z',
    payment_method: 'Carte •••• 4242',
    scheduled_change: null,
    pending_request: null,
    available_plans: PLANS,
    block_reason: null,
    unpaid_invoice_url: null,
    ...o,
  };
}

function compte(o: Partial<MembershipOverview>, extra: Partial<React.ComponentProps<typeof ManageSubscription>> = {}) {
  return renderToStaticMarkup(React.createElement(ManageSubscription, {
    overview: ov(o), boxId: 'box', commitmentEndDate: null, paused: false, pauseResumesAt: null, ...extra,
  }));
}

describe('/compte — les états de la maquette', () => {
  it('en ligne : Changer de formule, Gérer mon paiement, Résilier', () => {
    const t = text(compte({}));
    expect(t).toContain('Changer de formule Gérer mon paiement Résilier');
    expect(t).not.toContain('Annuler ce changement');
  });

  it('en ligne, choix de formule : encart de date d’effet au mot près', () => {
    const t = text(renderToStaticMarkup(React.createElement(PlanChoice, {
      overview: ov(), planId: 'p35', onPick: () => {}, onConfirm: () => {}, onCancel: () => {}, loading: false, error: null,
    })));
    expect(t).toContain('Nouvelle formule — à partir de ta prochaine échéance');
    expect(t).toContain('Tu gardes Mensuel illimité jusqu’au 31 oct. Ta nouvelle formule, 3 séances / semaine à 35 € /mois, sera prélevée à partir du 01 nov. 2026. Aucun prorata, rien n’est facturé aujourd’hui.');
    expect(t).toContain('Confirmer le changement Annuler');
  });

  it('en ligne, changement programmé : encart, Annuler ce changement, sans Changer de formule', () => {
    const t = text(compte({ scheduled_change: { plan: { id: 'p35', name: '3 séances / semaine' }, at: '2026-11-01T09:00:00Z' } }));
    expect(t).toContain('Changement programmé : 3 séances / semaine à 35 € /mois à partir du 01 nov. 2026. Tu gardes Mensuel illimité jusque-là.');
    expect(t).toContain('Annuler ce changement Gérer mon paiement Résilier');
    expect(t).not.toContain('Changer de formule');
  });

  it('en ligne, impayé : encart, Mettre à jour mon paiement en premier, Changer de formule grisé avec sa phrase, facture', () => {
    const html = compte(
      { block_reason: 'past_due', unpaid_invoice_url: 'https://invoice.stripe.com/i/x' },
      { pastDueSince: '2026-10-01T06:00:00Z' },
    );
    const t = text(html);
    expect(t).toContain('Ton dernier prélèvement a échoué le 01 oct. 2026. Mets ton moyen de paiement à jour pour garder l’accès aux réservations.');
    expect(t).toContain('Mettre à jour mon paiement Changer de formule Résilier');
    expect(t).toContain('Le changement de formule est indisponible tant que le paiement n’est pas régularisé.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="changement-indisponible"/);
    expect(html).toContain('href="https://invoice.stripe.com/i/x"');
    expect(t).toContain('Régler la facture en attente');
    expect(t).not.toContain('Gérer mon paiement');
  });

  it('impayé sans facture ouverte : pas de lien', () => {
    expect(text(compte({ block_reason: 'past_due' }))).not.toContain('Régler la facture en attente');
  });

  it('comptoir : Demander un changement de formule et sa phrase, ni paiement ni résiliation', () => {
    const t = text(compte({ mode: 'counter', next_billing_at: null, payment_method: null }));
    expect(t).toContain('Demander un changement de formule');
    expect(t).toContain('Tu paies au comptoir : ta box valide le changement et l’encaisse.');
    expect(t).not.toMatch(/Gérer mon paiement|Résilier|Changer de formule/);
  });

  it('comptoir, demande : Formule demandée à ta box, encart, Envoyer ma demande', () => {
    const t = text(renderToStaticMarkup(React.createElement(PlanChoice, {
      overview: ov({ mode: 'counter' }), planId: 'p35', onPick: () => {}, onConfirm: () => {}, onCancel: () => {}, loading: false, error: null,
    })));
    expect(t).toContain('Formule demandée à ta box');
    expect(t).toContain('Ta box reçoit ta demande. Le changement s’applique dès qu’elle l’accepte ; tu règles la différence au comptoir.');
    expect(t).toContain('Envoyer ma demande Annuler');
  });

  it('comptoir, demande envoyée : encart et Annuler ma demande', () => {
    const t = text(compte({ mode: 'counter', pending_request: { plan: { id: 'p35', name: '3 séances / semaine' }, at: '2026-10-05T10:00:00Z' } }));
    expect(t).toContain('Demande envoyée à ta box le 05 oct. 2026 : 3 séances / semaine à 35 € /mois. Ta box te confirmera le changement.');
    expect(t).toContain('Annuler ma demande');
    expect(t).not.toContain('Demander un changement de formule');
  });

  it.each(['cancel_scheduled', 'paused', 'box_closed'] as const)('« Changer de formule » absent (%s)', (block_reason) => {
    const t = text(compte({ block_reason }, { cancelAtPeriodEnd: block_reason === 'cancel_scheduled', paused: block_reason === 'paused' }));
    expect(t).not.toContain('Changer de formule');
    expect(t).toContain('Gérer mon paiement');
  });

  it('résiliation programmée : ni Changer de formule ni Résilier', () => {
    const t = text(compte({ block_reason: 'cancel_scheduled' }, { cancelAtPeriodEnd: true, periodEnd: '2026-11-01T09:00:00Z' }));
    expect(t).toContain('Résiliation programmée le 01 novembre 2026');
    expect(t).not.toMatch(/Changer de formule|Résilier /);
  });

  it('aucune formule proposable : pas de bouton de changement', () => {
    expect(compteActions(ov({ available_plans: [] })).change).toBeNull();
    expect(compteActions(ov({ mode: 'counter', available_plans: [] })).request).toBe(false);
  });

  it('sans date d’échéance, l’encart reste juste', () => {
    expect(effectiveDateNotice(ov({ next_billing_at: null }), PLANS[0]).replace(/\s/g, ' ')).toBe(
      'Tu gardes Mensuel illimité jusqu’à ta prochaine échéance. Ta nouvelle formule, 3 séances / semaine à 35 € /mois, sera prélevée ensuite. Aucun prorata, rien n’est facturé aujourd’hui.',
    );
  });

  it('page : moyen de paiement lu de l’overview, même lecture serveur, plus de confirmation native', () => {
    const page = read('app/compte/page.tsx');
    expect(page).toContain('readOverview(createServiceClient(), getConnectStripe(), user.id)');
    expect(page).toContain('Moyen de paiement : {overview.payment_method}');
    const comp = read('app/compte/ManageSubscription.tsx');
    expect(comp).not.toMatch(/window\.confirm|confirm\(/);
  });
});

describe('/compte — appels', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });
  const reply = (status: number, body: unknown) =>
    (global.fetch = jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }) as any);

  it('portail : POST /api/membership/payment-portal, puis l’URL', async () => {
    reply(200, { url: 'https://billing.stripe.com/p/session/x' });
    await expect(paymentPortalUrl()).resolves.toBe('https://billing.stripe.com/p/session/x');
    expect(global.fetch).toHaveBeenCalledWith('/api/membership/payment-portal', expect.objectContaining({ method: 'POST' }));
  });

  it('portail refusé : le message de la route', async () => {
    reply(409, { error: "Ton abonnement n'est pas payé en ligne : vois ton moyen de paiement avec ta box." });
    await expect(paymentPortalUrl()).rejects.toThrow("Ton abonnement n'est pas payé en ligne");
  });

  it('annulation : POST /api/change-membership-plan/cancel ; rien à annuler → message de la route', async () => {
    reply(200, { ok: true, mode: 'online' });
    await expect(cancelPlanChange()).resolves.toEqual({ ok: true, mode: 'online' });
    expect(global.fetch).toHaveBeenCalledWith('/api/change-membership-plan/cancel', expect.objectContaining({ method: 'POST' }));
    reply(409, { error: "Aucun changement de formule n'est en attente.", code: 'PLAN_CHANGE_NOTHING_TO_CANCEL' });
    await expect(cancelPlanChange()).rejects.toThrow("Aucun changement de formule n'est en attente.");
  });

  it('les boutons appellent ces fonctions et confirment par la boîte', () => {
    const comp = read('app/compte/ManageSubscription.tsx');
    expect(comp).toContain('window.location.href = await paymentPortalUrl()');
    expect(comp).toContain('await cancelPlanChange()');
    expect(comp).toMatch(/ask\(online/);
  });
});

describe('Abonnés — demandes de changement de formule', () => {
  const REQ = { id: 'r1', username: 'Nora_Box', fromPlan: 'Mensuel illimité', toPlan: '3 séances / semaine', createdAt: '2026-10-05T10:00:00Z' };
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('liste : membre, formule actuelle → demandée, date, Accepter / Refuser', () => {
    const t = text(renderToStaticMarkup(React.createElement(PlanChangeRequestsPanel, { requests: [REQ], busyId: null, onDecide: () => {} })));
    expect(t).toContain('Demandes de changement de formule (1)');
    expect(t).toContain('Nora_Box Mensuel illimité → 3 séances / semaine');
    expect(t).toContain('5 oct. 2026');
    expect(t).toContain('Accepter Refuser');
  });

  it('liste vide : rien', () => {
    expect(renderToStaticMarkup(React.createElement(PlanChangeRequestsPanel, { requests: [], busyId: null, onDecide: () => {} }))).toBe('');
  });

  it.each([[true, 'accepted'], [false, 'refused']])('décision (accept=%s) : POST decide', async (accept, status) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, decided: true, status }) }) as any;
    await expect(decidePlanChange('r1', accept)).resolves.toEqual({ ok: true, decided: true, status });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/members/plan-change-requests/decide');
    expect(JSON.parse(init.body)).toEqual({ request_id: 'r1', accept });
  });

  it('refus de la base (coach) : le message de la route', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Seuls le gérant et les co-gérants de la box décident.' }) }) as any;
    await expect(decidePlanChange('r1', true)).rejects.toThrow('Seuls le gérant et les co-gérants');
  });

  it('page : section réservée au gérant et aux co-gérants, confirmée, liste rafraîchie', () => {
    const page = read('app/(dashboard)/subscribers/page.tsx');
    const lecture = page.slice(page.indexOf("if (box.my_role === 'owner')"), page.indexOf('// Achats de programmes.'));
    expect(lecture).toContain(".from('box_plan_change_requests')");
    expect(lecture).toContain('setPlanReqs([])');
    const decide = page.slice(page.indexOf('function askDecidePlanChange'), page.indexOf('async function viewDoc'));
    expect(decide).toContain('ask(accept');
    expect(decide).toContain('await decidePlanChange(req.id, accept)');
    expect(decide).toContain('await load({ silent: true })');
    // Entre les demandes de résiliation et les filtres.
    expect(page.indexOf('Demandes de résiliation (')).toBeLessThan(page.indexOf('<PlanChangeRequestsPanel'));
    expect(page.indexOf('<PlanChangeRequestsPanel')).toBeLessThan(page.indexOf('{/* Filters */}'));
  });

  it('ligne du membre : changement programmé', () => {
    expect(scheduledRowLabel('3 séances / semaine', '2026-11-01T09:00:00Z')).toBe('→ 3 séances / semaine le 1 nov.');
    expect(read('app/(dashboard)/subscribers/page.tsx')).toContain('<span className="sr-only">Changement programmé </span>{scheduledRowLabel(');
  });
});

describe('/box/[slug] — Changer de formule mène à /compte', () => {
  it('membre actif de cette box seulement', () => {
    expect(isActiveMemberOf([{ box_id: 'b1', status: 'active' }], 'b1')).toBe(true);
    expect(isActiveMemberOf([{ box_id: 'b2', status: 'active' }], 'b1')).toBe(false);
    expect(isActiveMemberOf([{ box_id: 'b1', status: 'inactive' }], 'b1')).toBe(false);
    expect(isActiveMemberOf(null, 'b1')).toBe(false);
  });

  it('rien tant que l’adhésion n’est pas vérifiée (visiteur)', () => {
    expect(renderToStaticMarkup(React.createElement(MembershipManageButton, { boxId: 'b1' }))).toBe('');
  });

  it('un lien vers /compte, sans modale ni appel de changement', () => {
    const s = read('app/box/[slug]/MembershipManageButton.tsx');
    expect(s).toContain('href="/compte"');
    expect(s).toContain('Changer de formule');
    expect(s).not.toContain('/api/change-membership-plan');
    expect(s).not.toContain('fixed inset-0');
    expect(read('app/box/[slug]/BoxPublicView.tsx')).toContain('<MembershipManageButton boxId={b.id} />');
  });
});
