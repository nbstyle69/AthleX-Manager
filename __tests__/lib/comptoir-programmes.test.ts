import fs from 'fs';
import path from 'path';
import { RETRAIT_COMPTOIR_CONFIRMATION } from '@/lib/programAccessCopy';

/**
 * Lot 5-D côté web : « payé au comptoir » pour les programmes.
 *
 * Ce qui est vérifié ici est structurel — la porte emprunté par le geste, et la
 * classification de l'argent. Une capture d'écran montrerait un bouton ; elle ne
 * dirait ni par quelle RPC il passe, ni dans quel seau tombe l'euro encaissé.
 *
 * Le double comptage est le défaut central du lot : les deux surfaces d'argent
 * comptaient TOUT le journal de caisse en « comptoir ». Un encaissement de
 * programme y entrait sans qu'une ligne change — et s'il entre aussi dans
 * « Programmes », le même euro est compté deux fois, le total du graphe étant
 * membership + program + cash.
 */
const RACINE = process.cwd();
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const PAGE = 'app/(dashboard)/programs/page.tsx';
const ROUTE_REVENUS = 'app/api/box-revenue/route.ts';
const CARTE = 'components/stats/MoneyBlock.tsx';
const SIDEBAR = 'components/layout/Sidebar.tsx';
const LAYOUT = 'app/(dashboard)/layout.tsx';

describe('encaissement comptoir d’un programme — le geste (lot 5-D)', () => {
  const page = lire(PAGE);

  it('le gérant a deux gestes distincts, offert et payé au comptoir', () => {
    expect(page).toContain('Assigner (offert)');
    expect(page).toContain('Assigner — payé au comptoir');
  });

  it('l’encaissement passe par assign_program_cash, jamais par join_program', () => {
    // Un `join_program('cash')` direct poserait un accès payé sans ligne de
    // journal : le serveur le refuse, et la page ne le tente même pas.
    expect(page).toContain("rpc('assign_program_cash'");
    expect(page).toMatch(/p_amount_cents: cents/);
    expect(page).not.toContain("p_source: 'cash'");
    expect(page).not.toMatch(/from\('box_cash_payments'\)[\s\S]{0,80}\.insert\(/);
  });

  it('le montant est pré-rempli au prix du programme et modifiable', () => {
    expect(page).toMatch(/setAccessCashAmount\(\(p\.price_cents \/ 100\)\.toFixed\(2\)\)/);
    expect(page).toMatch(/value=\{accessCashAmount\}/);
    expect(page).toMatch(/onChange=\{e => setAccessCashAmount\(e\.target\.value\)\}/);
  });

  it('une remise descend, elle ne monte pas', () => {
    // Le journal est en ajout seul : un montant supérieur au prix serait un CA
    // définitif et faux. La borne serveur est la vraie garde ; celle-ci évite
    // au gérant un aller-retour.
    expect(page).toMatch(/cents > accessProgram\.price_cents/);
    expect(page).toMatch(/cents <= 0/);
  });

  it('un programme sans prix ne s’encaisse pas', () => {
    expect(page).toMatch(/accessProgram\.price_cents > 0 &&/);
  });

  it('la provenance comptoir est affichée telle qu’elle est stockée', () => {
    expect(page).toMatch(/cash: 'Payé au comptoir'/);
  });
});

describe('retrait d’un accès payé au comptoir (lot 5-D)', () => {
  const page = lire(PAGE);

  it('la confirmation dit la vérité, mot pour mot', () => {
    expect(RETRAIT_COMPTOIR_CONFIRMATION).toBe(
      "Cet accès a été payé au comptoir. Le remboursement éventuel est à ta charge, l'app ne peut pas le faire pour toi.",
    );
  });

  it('la confirmation est demandée avant le retrait, et seulement pour le comptoir', () => {
    expect(page).toMatch(
      /row\.provenance === 'cash' && !window\.confirm\(RETRAIT_COMPTOIR_CONFIRMATION\)\) return;/,
    );
    // L'ordre compte : une confirmation posée après l'UPDATE informerait d'un
    // geste déjà fait.
    expect(page).toMatch(
      /RETRAIT_COMPTOIR_CONFIRMATION[\s\S]{0,400}from\('program_members'\)[\s\S]{0,120}status: 'cancelled'/,
    );
  });

  it('le bouton Retirer reste présent sur une ligne comptoir', () => {
    // Il n'est retiré que sur `stripe` : le comptoir se retire, il ne se
    // rembourse simplement pas tout seul.
    expect(page).toMatch(/r\.provenance !== 'stripe'[\s\S]{0,200}retirerAcces\(r\)/);
  });
});

describe('les deux surfaces d’argent comptent le même euro une seule fois', () => {
  const route = lire(ROUTE_REVENUS);
  const carte = lire(CARTE);

  it('la route lit la source du journal, sinon elle ne peut pas classer', () => {
    expect(route).toMatch(/from\('box_cash_payments'\)[\s\S]{0,120}select\('amount_cents, collected_at, source'\)/);
  });

  it('un encaissement de programme entre dans « Programmes », pas dans « comptoir »', () => {
    expect(route).toMatch(/c\.source === 'program' \? 'program_cents' : 'cash_cents'/);
    // Le défaut d'avant : tout le journal versé en `cash_cents` sans regarder
    // la source.
    expect(route).not.toMatch(/add\(c\.collected_at\.slice\(0, 7\), 'cash_cents', c\.amount_cents\)/);
  });

  it('les achats Stripe de programme restent comptés', () => {
    expect(route).toMatch(/eq\('provenance', 'stripe'\)/);
    expect(route).toMatch(/'program_cents'/);
  });

  it('un accès offert ne produit aucune recette', () => {
    // Ni la route ni la RPC ne comptent `staff` : la seule provenance lue sur
    // `program_members` est `stripe`, et le journal ne reçoit pas de ligne.
    expect(route).not.toContain("'staff'");
  });

  it('les cartes n’annoncent pas un périmètre qu’elles n’ont pas', () => {
    expect(carte).toMatch(/vente\(s\), Stripe et comptoir/);
    expect(carte).toMatch(/encaissement\(s\) d'adhésion ce mois/);
  });
});

describe('l’état d’abonnement de la box est une information d’argent', () => {
  const sidebar = lire(SIDEBAR);
  const layout = lire(LAYOUT);

  it('le badge de plan n’est rendu que pour le gérant et le co-gérant', () => {
    expect(sidebar).toMatch(/\{isOwnerAdmin && \([\s\S]{0,400}\{planLabel\}/);
  });

  it('le coach reçoit isOwnerAdmin=false, donc pas de badge', () => {
    expect(layout).toMatch(/my_role === 'coach'[\s\S]{0,900}isOwnerAdmin=\{false\}/);
  });
});
