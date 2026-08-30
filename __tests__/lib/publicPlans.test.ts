import fs from 'fs';
import path from 'path';
import { PUBLIC_PLAN_FILTER, splitPublicPlans, type PlanLike } from '@/lib/publicPlans';

/**
 * L'Essai est une exception à « on n'affiche que ce qui est vendable ». Un
 * contrôle qui ne vérifie que l'apparition de l'Essai ne distingue pas
 * l'exception de la levée de la règle : les deux sens sont donc testés.
 */
interface Plan extends PlanLike {
  name: string;
}

const essai: Plan = { name: 'Séance découverte', price_cents: 0, plan_type: 'trial' };
const abo: Plan = { name: '3x / semaine', price_cents: 8900, plan_type: 'subscription' };
const dropIn: Plan = { name: 'Drop-in', price_cents: 1500, plan_type: 'drop_in' };
const carnet: Plan = { name: 'Carnet 10', price_cents: 12000, plan_type: 'pack' };
const aboGratuit: Plan = { name: 'Staff', price_cents: 0, plan_type: 'subscription' };
const carnetGratuit: Plan = { name: 'Carnet offert', price_cents: 0, plan_type: 'pack' };

describe('splitPublicPlans', () => {
  it('montre l’offre Essai gratuite', () => {
    expect(splitPublicPlans([essai, abo]).trialOffer?.name).toBe('Séance découverte');
  });

  it('masque une formule gratuite qui n’est pas un Essai', () => {
    const { plans, creditOffers, trialOffer } = splitPublicPlans([aboGratuit, carnetGratuit]);
    expect(plans).toHaveLength(0);
    expect(creditOffers).toHaveLength(0);
    expect(trialOffer).toBeNull();
  });

  it('garde les offres payantes dans leurs seaux respectifs', () => {
    const { plans, creditOffers } = splitPublicPlans([essai, abo, dropIn, carnet]);
    expect(plans.map(p => p.name)).toEqual(['3x / semaine']);
    expect(creditOffers.map(p => p.name)).toEqual(['Drop-in', 'Carnet 10']);
  });

  it('ne range jamais l’Essai parmi les offres à payer', () => {
    const { plans, creditOffers } = splitPublicPlans([essai]);
    expect(plans).toHaveLength(0);
    expect(creditOffers).toHaveLength(0);
  });

  it('traite un type absent comme un abonnement (données anciennes)', () => {
    const ancien: Plan = { name: 'Historique', price_cents: 5000, plan_type: null };
    expect(splitPublicPlans([ancien]).plans.map(p => p.name)).toEqual(['Historique']);
  });

  it('la page publique lit la base avec ce filtre, pas un autre', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app', 'box', '[slug]', 'page.tsx'),
      'utf8',
    );
    expect(source).toContain('PUBLIC_PLAN_FILTER');
    expect(source).not.toContain(".gt('price_cents', 0)");
    expect(PUBLIC_PLAN_FILTER).toBe('price_cents.gt.0,plan_type.eq.trial');
  });
});
