-- billing_source : d'où vient l'abonnement d'une box (ou d'un owner)
-- ------------------------------------------------------------------
--   • 'stripe' (défaut) : ligne pilotée par Stripe — webhook et
--     verify-subscription la mettent à jour (statut, période).
--   • 'manual'          : ligne offerte / saisie à la main — aucun mécanisme
--     Stripe ne la touche, jamais.
--
-- Avant cette colonne, la convention implicite « pas d'identifiant Stripe =
-- offert » servait de garde. Elle est fragile (un identifiant posé par erreur
-- fait basculer la ligne) : on la rend explicite.
--
-- Idempotente : rejouable sans effet au second passage.
-- ------------------------------------------------------------------

-- box_subscriptions -------------------------------------------------
ALTER TABLE public.box_subscriptions
  ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'stripe';

ALTER TABLE public.box_subscriptions
  DROP CONSTRAINT IF EXISTS box_subscriptions_billing_source_check;
ALTER TABLE public.box_subscriptions
  ADD CONSTRAINT box_subscriptions_billing_source_check
  CHECK (billing_source IN ('stripe', 'manual'));

-- Backfill : une ligne active sans aucun identifiant Stripe est offerte
-- (en prod : AthleX Fitness). NBS2 et RAW PERFORMANCE ont des identifiants
-- et restent 'stripe'.
UPDATE public.box_subscriptions
   SET billing_source = 'manual'
 WHERE status = 'active'
   AND stripe_customer_id IS NULL
   AND stripe_subscription_id IS NULL
   AND billing_source <> 'manual';

-- owner_subscriptions : mêmes règles ---------------------------------
ALTER TABLE public.owner_subscriptions
  ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'stripe';

ALTER TABLE public.owner_subscriptions
  DROP CONSTRAINT IF EXISTS owner_subscriptions_billing_source_check;
ALTER TABLE public.owner_subscriptions
  ADD CONSTRAINT owner_subscriptions_billing_source_check
  CHECK (billing_source IN ('stripe', 'manual'));

UPDATE public.owner_subscriptions
   SET billing_source = 'manual'
 WHERE status = 'active'
   AND stripe_customer_id IS NULL
   AND stripe_subscription_id IS NULL
   AND billing_source <> 'manual';

-- Contrôle après application (lecture seule) :
--   select b.name, s.status, s.billing_source, s.stripe_subscription_id
--     from box_subscriptions s join boxes b on b.id = s.box_id order by b.name;
-- Attendu : AthleX Fitness = manual ; NBS2, RAW PERFORMANCE, Crossfit AX = stripe.
