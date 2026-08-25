/**
 * Répartition des formules d'une box sur sa page publique.
 *
 * La règle est « on n'affiche publiquement que ce qui est vendable », donc les
 * formules à 0 € restent masquées. L'Essai est l'unique exception : il est
 * gratuit par construction (la base refuse un `trial` payant), et c'est une
 * offre d'acquisition, pas une vente. On lève l'exception, pas la règle — une
 * formule à 0 € d'un autre type reste invisible.
 *
 * Extrait de la page pour être vérifiable dans les deux sens : sans le second
 * cas (« la gratuite d'un autre type reste masquée »), un contrôle vert ne
 * distinguerait pas l'exception de l'ouverture générale.
 */

export type PublicPlanType = 'subscription' | 'drop_in' | 'pack' | 'trial';

export interface PlanLike {
  price_cents: number;
  plan_type: PublicPlanType | null;
}

/** Filtre PostgREST correspondant : payant, ou Essai. */
export const PUBLIC_PLAN_FILTER = 'price_cents.gt.0,plan_type.eq.trial';

export interface SplitPlans<T extends PlanLike> {
  /** Abonnements récurrents payants. */
  plans: T[];
  /** Drop-in et carnets payants. */
  creditOffers: T[];
  /** L'offre Essai active, au plus une par box (index partiel en base). */
  trialOffer: T | null;
}

export function splitPublicPlans<T extends PlanLike>(all: T[]): SplitPlans<T> {
  return {
    plans: all.filter(
      (pl) => (pl.plan_type ?? 'subscription') === 'subscription' && pl.price_cents > 0,
    ),
    creditOffers: all.filter(
      (pl) => (pl.plan_type === 'drop_in' || pl.plan_type === 'pack') && pl.price_cents > 0,
    ),
    trialOffer: all.find((pl) => pl.plan_type === 'trial') ?? null,
  };
}
