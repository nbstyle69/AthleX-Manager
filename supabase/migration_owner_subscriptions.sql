-- Owner-level SaaS billing (Solo vs Multi-box)
-- ------------------------------------------------------------------
-- Historique : facturation 1 abonnement par box (`box_subscriptions`,
-- UNIQUE(box_id)). Nouveau : offre au niveau OWNER.
--   • Solo  = 1 box   → tarif de base (inchangé, reste sur box_subscriptions)
--   • Multi = N box    → une seule souscription owner qui déverrouille toutes
--                        ses box. Prix = base + 29 €/box supplémentaire.
--
-- Règle produit : la 2e box (et suivantes) reste VERROUILLÉE tant que l'owner
-- n'a pas de `owner_subscriptions` Multi active couvrant le nombre de box.
-- La box primaire (la plus ancienne) garde son abo solo historique.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.owner_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_tier              text NOT NULL DEFAULT 'multi' CHECK (plan_tier IN ('solo', 'multi')),
  box_quota              integer NOT NULL DEFAULT 1,
  status                 text NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_subscriptions_owner ON public.owner_subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_subscriptions_customer ON public.owner_subscriptions(stripe_customer_id);

ALTER TABLE public.owner_subscriptions ENABLE ROW LEVEL SECURITY;

-- L'owner lit sa propre ligne. Écriture réservée au service-role (webhook Stripe).
DROP POLICY IF EXISTS owner_subscriptions_select_own ON public.owner_subscriptions;
CREATE POLICY owner_subscriptions_select_own ON public.owner_subscriptions
  FOR SELECT USING (owner_id = auth.uid());

-- Nombre de box possédées par un owner (owner direct uniquement — la facturation
-- suit la propriété, pas le co-owning).
CREATE OR REPLACE FUNCTION public.owner_box_count(p_owner_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT count(*)::int FROM public.boxes WHERE owner_id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public.owner_box_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_box_count(uuid) TO authenticated;
